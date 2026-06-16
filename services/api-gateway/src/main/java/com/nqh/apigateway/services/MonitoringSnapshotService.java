package com.nqh.apigateway.services;

import com.fasterxml.jackson.databind.JsonNode;
import com.nqh.apigateway.dtos.MonitoringSnapshot;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.admin.AdminClientConfig;
import org.apache.kafka.clients.admin.ConsumerGroupListing;
import org.apache.kafka.clients.admin.ListOffsetsResult;
import org.apache.kafka.clients.admin.OffsetSpec;
import org.apache.kafka.clients.admin.TopicDescription;
import org.apache.kafka.clients.consumer.OffsetAndMetadata;
import org.apache.kafka.common.TopicPartition;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

@Service
public class MonitoringSnapshotService {

    private static final Duration PROBE_TIMEOUT = Duration.ofSeconds(4);
    private static final int KAFKA_TIMEOUT_SECONDS = 4;

    private final WebClient webClient;
    private final ObjectProvider<RedisConnectionFactory> redisConnectionFactoryProvider;
    private final MonitoringStreamState monitoringStreamState;
    private final List<ServiceTarget> serviceTargets;
    private final String kafkaBootstrapServers;
    private final boolean gatewayHttp2Enabled;
    private final String grpcTarget;

    public MonitoringSnapshotService(
            WebClient.Builder webClientBuilder,
            ObjectProvider<RedisConnectionFactory> redisConnectionFactoryProvider,
            MonitoringStreamState monitoringStreamState,
            @Value("${app.monitoring.gateway-uri:http://localhost:8080}") String gatewayUri,
            @Value("${AUTH_SERVICE_URI:http://localhost:8081}") String authServiceUri,
            @Value("${ORDER_SERVICE_URI:http://localhost:8082}") String orderServiceUri,
            @Value("${INVENTORY_SERVICE_URI:http://localhost:8083}") String inventoryServiceUri,
            @Value("${PAYMENT_SERVICE_URI:http://localhost:8084}") String paymentServiceUri,
            @Value("${NOTIFICATION_SERVICE_URI:http://localhost:8085}") String notificationServiceUri,
            @Value("${spring.kafka.bootstrap-servers:localhost:9092}") String kafkaBootstrapServers,
            @Value("${server.http2.enabled:false}") boolean gatewayHttp2Enabled,
            @Value("${app.notification.grpc.host:localhost}") String grpcHost,
            @Value("${app.notification.grpc.port:9095}") int grpcPort
    ) {
        this.webClient = webClientBuilder.build();
        this.redisConnectionFactoryProvider = redisConnectionFactoryProvider;
        this.monitoringStreamState = monitoringStreamState;
        this.kafkaBootstrapServers = kafkaBootstrapServers;
        this.gatewayHttp2Enabled = gatewayHttp2Enabled;
        this.grpcTarget = grpcHost + ":" + grpcPort;
        this.serviceTargets = List.of(
                new ServiceTarget("gateway", "API Gateway", normalizeBaseUri(gatewayUri)),
                new ServiceTarget("auth", "Auth Service", normalizeBaseUri(authServiceUri)),
                new ServiceTarget("order", "Order Service", normalizeBaseUri(orderServiceUri)),
                new ServiceTarget("inventory", "Inventory Service", normalizeBaseUri(inventoryServiceUri)),
                new ServiceTarget("payment", "Payment Service", normalizeBaseUri(paymentServiceUri)),
                new ServiceTarget("notification", "Notification Service", normalizeBaseUri(notificationServiceUri))
        );
    }

    public Mono<MonitoringSnapshot> collectSnapshot() {
        Mono<List<MonitoringSnapshot.ServiceHealth>> servicesMono = Flux.fromIterable(serviceTargets)
                .flatMap(this::probeService, 6)
                .collectList();

        Mono<MonitoringSnapshot.RedisMetrics> redisMono = Mono.fromCallable(this::collectRedisMetrics)
                .subscribeOn(Schedulers.boundedElastic())
                .onErrorResume(error -> Mono.just(new MonitoringSnapshot.RedisMetrics(
                        "DOWN", null, null, null, null, null, null, null, null, null, null, error.getMessage()
                )));

        Mono<MonitoringSnapshot.KafkaMetrics> kafkaMono = Mono.fromCallable(this::collectKafkaMetrics)
                .subscribeOn(Schedulers.boundedElastic())
                .onErrorResume(error -> Mono.just(new MonitoringSnapshot.KafkaMetrics(
                        "DOWN", 0, 0, 0, List.of(), List.of(), List.of(), error.getMessage()
                )));

        return Mono.zip(servicesMono, redisMono, kafkaMono)
                .map(tuple -> {
                    List<MonitoringSnapshot.ServiceHealth> services = tuple.getT1().stream()
                            .sorted(Comparator.comparingInt(service -> serviceOrder(service.key())))
                            .toList();
                    MonitoringSnapshot.RedisMetrics redis = tuple.getT2();
                    MonitoringSnapshot.KafkaMetrics kafka = tuple.getT3();
                    MonitoringSnapshot.RuntimeMetrics runtime = buildRuntimeMetrics(services);
                    MonitoringSnapshot.RealtimeMetrics realtime = new MonitoringSnapshot.RealtimeMetrics(
                            monitoringStreamState.activeNotificationSseConnections(),
                            monitoringStreamState.activeMonitoringSseConnections(),
                            gatewayHttp2Enabled,
                            grpcTarget,
                            "HTTP/2 per-connection stream counts require Netty/channel-level instrumentation; active SSE streams are counted in Gateway."
                    );
                    return new MonitoringSnapshot(
                            Instant.now(),
                            resolveOverallStatus(services, redis, kafka),
                            services,
                            runtime,
                            redis,
                            kafka,
                            realtime,
                            buildInternalApiStatuses(services)
                    );
                });
    }

    private Mono<MonitoringSnapshot.ServiceHealth> probeService(ServiceTarget target) {
        long startedAt = System.nanoTime();
        Mono<JsonNode> healthMono = getJson(target.baseUri() + "/actuator/health");

        return healthMono
                .flatMap(health -> Mono.zip(
                        Mono.just(health),
                        getMetricValue(target, "jvm.memory.used?tag=area:heap", "VALUE").defaultIfEmpty(Double.NaN),
                        getMetricValue(target, "jvm.memory.max?tag=area:heap", "VALUE").defaultIfEmpty(Double.NaN),
                        getMetricValue(target, "process.cpu.usage", "VALUE").defaultIfEmpty(Double.NaN),
                        getMetricValue(target, "system.cpu.usage", "VALUE").defaultIfEmpty(Double.NaN),
                        getMetricValue(target, "jvm.threads.live", "VALUE").defaultIfEmpty(Double.NaN),
                        getMetricValue(target, "http.server.requests", "COUNT").defaultIfEmpty(Double.NaN),
                        getMetricValue(target, "http.server.requests", "MAX").defaultIfEmpty(Double.NaN)
                ))
                .map(tuple -> new MonitoringSnapshot.ServiceHealth(
                        target.key(),
                        target.name(),
                        target.baseUri(),
                        normalizeStatus(tuple.getT1().path("status").asText("UNKNOWN")),
                        elapsedMs(startedAt),
                        bytesToMb(nullableFinite(tuple.getT2())),
                        bytesToMb(nullableFinite(tuple.getT3())),
                        nullableFinite(tuple.getT4()),
                        nullableFinite(tuple.getT5()),
                        nullableFinite(tuple.getT6()),
                        nullableFinite(tuple.getT7()),
                        secondsToMs(nullableFinite(tuple.getT8())),
                        null
                ))
                .onErrorResume(error -> Mono.just(new MonitoringSnapshot.ServiceHealth(
                        target.key(),
                        target.name(),
                        target.baseUri(),
                        "DOWN",
                        elapsedMs(startedAt),
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        error.getMessage()
                )));
    }

    private Mono<JsonNode> getJson(String uri) {
        return webClient.get()
                .uri(uri)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .timeout(PROBE_TIMEOUT);
    }

    private Mono<Double> getMetricValue(ServiceTarget target, String metricPath, String statistic) {
        return getJson(target.baseUri() + "/actuator/metrics/" + metricPath)
                .map(json -> extractMeasurement(json, statistic));
    }

    private double extractMeasurement(JsonNode json, String statistic) {
        JsonNode measurements = json.path("measurements");
        if (!measurements.isArray()) {
            return Double.NaN;
        }
        for (JsonNode measurement : measurements) {
            if (statistic.equalsIgnoreCase(measurement.path("statistic").asText())) {
                return measurement.path("value").asDouble(Double.NaN);
            }
        }
        return Double.NaN;
    }

    private MonitoringSnapshot.RedisMetrics collectRedisMetrics() {
        RedisConnectionFactory connectionFactory = redisConnectionFactoryProvider.getIfAvailable();
        if (connectionFactory == null) {
            return new MonitoringSnapshot.RedisMetrics(
                    "UNKNOWN", null, null, null, null, null, null, null, null, null, null,
                    "Redis connection factory is not configured."
            );
        }

        try (RedisConnection connection = connectionFactory.getConnection()) {
            Properties memory = connection.serverCommands().info("memory");
            Properties stats = connection.serverCommands().info("stats");
            Properties clients = connection.serverCommands().info("clients");

            Long hits = parseLong(stats, "keyspace_hits");
            Long misses = parseLong(stats, "keyspace_misses");
            Double hitRate = null;
            if (hits != null && misses != null && hits + misses > 0) {
                hitRate = (hits * 100.0) / (hits + misses);
            }

            return new MonitoringSnapshot.RedisMetrics(
                    "UP",
                    parseLong(memory, "used_memory"),
                    parseLong(memory, "maxmemory"),
                    hits,
                    misses,
                    hitRate,
                    parseLong(stats, "evicted_keys"),
                    parseLong(stats, "expired_keys"),
                    parseLong(clients, "connected_clients"),
                    parseLong(stats, "total_commands_processed"),
                    parseLong(stats, "instantaneous_ops_per_sec"),
                    null
            );
        }
    }

    private MonitoringSnapshot.KafkaMetrics collectKafkaMetrics() throws Exception {
        Map<String, Object> config = new HashMap<>();
        config.put(AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG, kafkaBootstrapServers);
        config.put(AdminClientConfig.REQUEST_TIMEOUT_MS_CONFIG, "3500");
        config.put(AdminClientConfig.DEFAULT_API_TIMEOUT_MS_CONFIG, "4000");

        try (AdminClient adminClient = AdminClient.create(config)) {
            Set<String> topics = adminClient.listTopics()
                    .names()
                    .get(KAFKA_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            Collection<ConsumerGroupListing> groups = adminClient.listConsumerGroups()
                    .all()
                    .get(KAFKA_TIMEOUT_SECONDS, TimeUnit.SECONDS);

            List<MonitoringSnapshot.ConsumerGroupLag> groupLags = new ArrayList<>();
            long totalLag = 0;
            for (ConsumerGroupListing group : groups) {
                long lag = collectGroupLag(adminClient, group.groupId());
                totalLag += lag;
                groupLags.add(new MonitoringSnapshot.ConsumerGroupLag(group.groupId(), lag));
            }

            groupLags.sort(Comparator.comparing(MonitoringSnapshot.ConsumerGroupLag::groupId));

            List<String> topicList = topics.stream()
                    .sorted()
                    .limit(40)
                    .toList();
            List<MonitoringSnapshot.TopicMetric> topicMetrics = collectTopicMetrics(adminClient, topicList);

            return new MonitoringSnapshot.KafkaMetrics(
                    "UP",
                    topics.size(),
                    groups.size(),
                    totalLag,
                    groupLags,
                    topicList,
                    topicMetrics,
                    null
            );
        }
    }

    private List<MonitoringSnapshot.TopicMetric> collectTopicMetrics(
            AdminClient adminClient,
            List<String> topics
    ) {
        if (topics == null || topics.isEmpty()) {
            return List.of();
        }

        try {
            Map<String, TopicDescription> descriptions = adminClient.describeTopics(topics)
                    .allTopicNames()
                    .get(KAFKA_TIMEOUT_SECONDS, TimeUnit.SECONDS);

            List<TopicPartition> partitions = descriptions.entrySet().stream()
                    .flatMap(entry -> entry.getValue().partitions().stream()
                            .map(partition -> new TopicPartition(entry.getKey(), partition.partition())))
                    .toList();

            if (partitions.isEmpty()) {
                return topics.stream()
                        .map(topic -> new MonitoringSnapshot.TopicMetric(topic, 0, 0))
                        .toList();
            }

            Map<TopicPartition, OffsetSpec> earliestOffsetRequests = partitions.stream()
                    .collect(Collectors.toMap(partition -> partition, partition -> OffsetSpec.earliest()));
            Map<TopicPartition, OffsetSpec> latestOffsetRequests = partitions.stream()
                    .collect(Collectors.toMap(partition -> partition, partition -> OffsetSpec.latest()));

            Map<TopicPartition, ListOffsetsResult.ListOffsetsResultInfo> earliestOffsets = adminClient
                    .listOffsets(earliestOffsetRequests)
                    .all()
                    .get(KAFKA_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            Map<TopicPartition, ListOffsetsResult.ListOffsetsResultInfo> latestOffsets = adminClient
                    .listOffsets(latestOffsetRequests)
                    .all()
                    .get(KAFKA_TIMEOUT_SECONDS, TimeUnit.SECONDS);

            Map<String, Long> messageCountByTopic = new LinkedHashMap<>();
            Map<String, Integer> partitionCountByTopic = new LinkedHashMap<>();
            for (String topic : topics) {
                messageCountByTopic.put(topic, 0L);
                partitionCountByTopic.put(topic, 0);
            }

            for (TopicPartition partition : partitions) {
                long earliest = earliestOffsets.get(partition) == null
                        ? 0
                        : earliestOffsets.get(partition).offset();
                long latest = latestOffsets.get(partition) == null
                        ? earliest
                        : latestOffsets.get(partition).offset();
                messageCountByTopic.computeIfPresent(
                        partition.topic(),
                        (topic, count) -> count + Math.max(0, latest - earliest)
                );
                partitionCountByTopic.computeIfPresent(
                        partition.topic(),
                        (topic, count) -> count + 1
                );
            }

            return topics.stream()
                    .map(topic -> new MonitoringSnapshot.TopicMetric(
                            topic,
                            partitionCountByTopic.getOrDefault(topic, 0),
                            messageCountByTopic.getOrDefault(topic, 0L)
                    ))
                    .toList();
        } catch (Exception ignored) {
            return topics.stream()
                    .map(topic -> new MonitoringSnapshot.TopicMetric(topic, 0, 0))
                    .toList();
        }
    }

    private long collectGroupLag(AdminClient adminClient, String groupId) {
        try {
            Map<TopicPartition, OffsetAndMetadata> committedOffsets = adminClient
                    .listConsumerGroupOffsets(groupId)
                    .partitionsToOffsetAndMetadata()
                    .get(KAFKA_TIMEOUT_SECONDS, TimeUnit.SECONDS);

            if (committedOffsets.isEmpty()) {
                return 0;
            }

            Map<TopicPartition, OffsetSpec> latestOffsetRequests = committedOffsets.keySet().stream()
                    .collect(Collectors.toMap(partition -> partition, partition -> OffsetSpec.latest()));
            Map<TopicPartition, ListOffsetsResult.ListOffsetsResultInfo> latestOffsets = adminClient
                    .listOffsets(latestOffsetRequests)
                    .all()
                    .get(KAFKA_TIMEOUT_SECONDS, TimeUnit.SECONDS);

            long lag = 0;
            for (Map.Entry<TopicPartition, OffsetAndMetadata> entry : committedOffsets.entrySet()) {
                long committed = entry.getValue() == null ? 0 : entry.getValue().offset();
                long latest = latestOffsets.get(entry.getKey()) == null
                        ? committed
                        : latestOffsets.get(entry.getKey()).offset();
                lag += Math.max(0, latest - committed);
            }
            return lag;
        } catch (Exception ignored) {
            return 0;
        }
    }

    private MonitoringSnapshot.RuntimeMetrics buildRuntimeMetrics(
            List<MonitoringSnapshot.ServiceHealth> services
    ) {
        double heapUsed = services.stream().map(MonitoringSnapshot.ServiceHealth::heapUsedMb).mapToDouble(this::safe).sum();
        double heapMax = services.stream().map(MonitoringSnapshot.ServiceHealth::heapMaxMb).mapToDouble(this::safe).sum();
        double avgCpu = services.stream()
                .map(MonitoringSnapshot.ServiceHealth::processCpuUsage)
                .filter(value -> value != null)
                .mapToDouble(Double::doubleValue)
                .average()
                .orElse(0);
        double threads = services.stream().map(MonitoringSnapshot.ServiceHealth::liveThreads).mapToDouble(this::safe).sum();
        double requestCount = services.stream().map(MonitoringSnapshot.ServiceHealth::httpRequestCount).mapToDouble(this::safe).sum();
        double maxRequestMs = services.stream().map(MonitoringSnapshot.ServiceHealth::httpRequestMaxMs).mapToDouble(this::safe).max().orElse(0);

        return new MonitoringSnapshot.RuntimeMetrics(
                heapUsed,
                heapMax,
                heapMax > 0 ? (heapUsed * 100.0) / heapMax : 0,
                avgCpu,
                threads,
                requestCount,
                maxRequestMs
        );
    }

    private List<MonitoringSnapshot.InternalApiStatus> buildInternalApiStatuses(
            List<MonitoringSnapshot.ServiceHealth> services
    ) {
        Map<String, String> statusByService = services.stream()
                .collect(Collectors.toMap(MonitoringSnapshot.ServiceHealth::key, MonitoringSnapshot.ServiceHealth::status));
        return List.of(
                internalApi("Order", "Inventory", "reserve / release / confirm-deduct", "/internal/v1/inventories/*", statusByService.get("order"), statusByService.get("inventory")),
                internalApi("Order", "Payment", "intent / confirm / fail", "/internal/v1/payments/*", statusByService.get("order"), statusByService.get("payment")),
                internalApi("Notification", "Order", "order products lookup", "/internal/v1/orders/{orderCode}/products", statusByService.get("notification"), statusByService.get("order")),
                internalApi("Notification", "Inventory", "product owners lookup", "/internal/v1/inventories/product-owners", statusByService.get("notification"), statusByService.get("inventory"))
        );
    }

    private MonitoringSnapshot.InternalApiStatus internalApi(
            String source,
            String target,
            String operation,
            String contract,
            String sourceStatus,
            String targetStatus
    ) {
        String status = "UP".equalsIgnoreCase(sourceStatus) && "UP".equalsIgnoreCase(targetStatus)
                ? "READY"
                : "WATCH";
        return new MonitoringSnapshot.InternalApiStatus(
                source,
                target,
                operation,
                contract,
                status,
                "Derived from source/target Actuator health; add synthetic probes with sample payloads for full contract validation."
        );
    }

    private String resolveOverallStatus(
            List<MonitoringSnapshot.ServiceHealth> services,
            MonitoringSnapshot.RedisMetrics redis,
            MonitoringSnapshot.KafkaMetrics kafka
    ) {
        boolean serviceDown = services.stream().anyMatch(service -> !"UP".equalsIgnoreCase(service.status()));
        boolean dependencyDown = "DOWN".equalsIgnoreCase(redis.status()) || "DOWN".equalsIgnoreCase(kafka.status());
        if (serviceDown || dependencyDown) {
            return "WATCH";
        }
        return "HEALTHY";
    }

    private Long parseLong(Properties properties, String key) {
        if (properties == null) {
            return null;
        }
        String raw = properties.getProperty(key);
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return Long.parseLong(raw.trim());
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private Double nullableFinite(Double value) {
        if (value == null || value.isNaN() || value.isInfinite()) {
            return null;
        }
        return value;
    }

    private Double bytesToMb(Double value) {
        return value == null ? null : value / 1024.0 / 1024.0;
    }

    private Double secondsToMs(Double value) {
        return value == null ? null : value * 1000.0;
    }

    private double safe(Double value) {
        return value == null ? 0 : value;
    }

    private long elapsedMs(long startedAt) {
        return TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAt);
    }

    private String normalizeStatus(String status) {
        String normalized = status == null ? "" : status.trim().toUpperCase(Locale.ROOT);
        if ("UP".equals(normalized)) {
            return "UP";
        }
        if ("DOWN".equals(normalized) || "OUT_OF_SERVICE".equals(normalized)) {
            return "DOWN";
        }
        return "UNKNOWN";
    }

    private int serviceOrder(String key) {
        Map<String, Integer> order = new LinkedHashMap<>();
        order.put("gateway", 0);
        order.put("auth", 1);
        order.put("order", 2);
        order.put("inventory", 3);
        order.put("payment", 4);
        order.put("notification", 5);
        return order.getOrDefault(key, 99);
    }

    private String normalizeBaseUri(String value) {
        String normalized = value == null || value.isBlank() ? "http://localhost" : value.trim();
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }

    private record ServiceTarget(String key, String name, String baseUri) {
    }
}
