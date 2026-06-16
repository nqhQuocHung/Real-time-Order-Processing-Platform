package com.nqh.apigateway.dtos;

import java.time.Instant;
import java.util.List;

public record MonitoringSnapshot(
        Instant capturedAt,
        String overallStatus,
        List<ServiceHealth> services,
        RuntimeMetrics runtime,
        RedisMetrics redis,
        KafkaMetrics kafka,
        RealtimeMetrics realtime,
        List<InternalApiStatus> internalApis
) {
    public record ServiceHealth(
            String key,
            String name,
            String uri,
            String status,
            long probeMs,
            Double heapUsedMb,
            Double heapMaxMb,
            Double processCpuUsage,
            Double systemCpuUsage,
            Double liveThreads,
            Double httpRequestCount,
            Double httpRequestMaxMs,
            String error
    ) {
    }

    public record RuntimeMetrics(
            double heapUsedMb,
            double heapMaxMb,
            double heapUsagePercent,
            double avgProcessCpuUsage,
            double liveThreads,
            double totalHttpRequests,
            double maxHttpRequestMs
    ) {
    }

    public record RedisMetrics(
            String status,
            Long usedMemoryBytes,
            Long maxMemoryBytes,
            Long keyspaceHits,
            Long keyspaceMisses,
            Double hitRatePercent,
            Long evictedKeys,
            Long expiredKeys,
            Long connectedClients,
            Long totalCommandsProcessed,
            Long instantaneousOpsPerSecond,
            String error
    ) {
    }

    public record KafkaMetrics(
            String status,
            int topicCount,
            int consumerGroupCount,
            long totalLag,
            List<ConsumerGroupLag> consumerGroups,
            List<String> topics,
            List<TopicMetric> topicMetrics,
            String error
    ) {
    }

    public record ConsumerGroupLag(
            String groupId,
            long lag
    ) {
    }

    public record TopicMetric(
            String topic,
            int partitions,
            long messages
    ) {
    }

    public record RealtimeMetrics(
            int activeNotificationSseConnections,
            int activeMonitoringSseConnections,
            boolean gatewayHttp2Enabled,
            String grpcTarget,
            String note
    ) {
    }

    public record InternalApiStatus(
            String source,
            String target,
            String operation,
            String contract,
            String status,
            String evidence
    ) {
    }
}
