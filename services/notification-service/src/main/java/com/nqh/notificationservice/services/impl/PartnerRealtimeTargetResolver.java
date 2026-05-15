package com.nqh.notificationservice.services.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.http.HttpClient;
import java.util.LinkedHashSet;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

@Slf4j
@Component
public class PartnerRealtimeTargetResolver {

    private static final String INTERNAL_TOKEN_HEADER = "X-Internal-Token";

    private final ObjectMapper objectMapper;
    private final RestClient orderRpcClient;
    private final RestClient inventoryRpcClient;
    private final String internalToken;

    public PartnerRealtimeTargetResolver(
            ObjectMapper objectMapper,
            @Value("${app.notification.rpc.order-base-url:http://localhost:8082}") String orderBaseUrl,
            @Value("${app.notification.rpc.inventory-base-url:http://localhost:8083}") String inventoryBaseUrl,
            @Value("${app.notification.rpc.internal-token:change-me}") String internalToken
    ) {
        this.objectMapper = objectMapper;
        this.orderRpcClient = buildHttp2RestClient(orderBaseUrl);
        this.inventoryRpcClient = buildHttp2RestClient(inventoryBaseUrl);
        this.internalToken = internalToken;
    }

    public Set<String> resolvePartnerUserIds(String kafkaEventMessage) {
        try {
            String orderCode = extractOrderCode(kafkaEventMessage);
            if (!StringUtils.hasText(orderCode)) {
                return Set.of();
            }

            Set<String> productIds = fetchOrderProductIds(orderCode);
            if (productIds.isEmpty()) {
                return Set.of();
            }

            return fetchShopUserIdsByProductIds(productIds);
        } catch (Exception ex) {
            log.warn("Failed to resolve partner targets for realtime event.", ex);
            return Set.of();
        }
    }

    private String extractOrderCode(String kafkaEventMessage) throws Exception {
        JsonNode rootNode = objectMapper.readTree(kafkaEventMessage);
        JsonNode payloadNode = rootNode.path("payload");
        String orderCode = payloadNode.path("orderCode").asText(null);
        if (!StringUtils.hasText(orderCode)) {
            return null;
        }
        return orderCode.trim();
    }

    private Set<String> fetchOrderProductIds(String orderCode) throws Exception {
        String rawResponse = orderRpcClient.get()
                .uri("/internal/v1/orders/{orderCode}/products", orderCode)
                .header(INTERNAL_TOKEN_HEADER, internalToken)
                .retrieve()
                .body(String.class);

        if (!StringUtils.hasText(rawResponse)) {
            return Set.of();
        }

        JsonNode dataNode = objectMapper.readTree(rawResponse).path("data");
        JsonNode productIdsNode = dataNode.path("productIds");
        if (!productIdsNode.isArray()) {
            return Set.of();
        }

        Set<String> productIds = new LinkedHashSet<>();
        for (JsonNode productIdNode : productIdsNode) {
            String productId = productIdNode.asText(null);
            if (StringUtils.hasText(productId)) {
                productIds.add(productId.trim());
            }
        }
        return productIds;
    }

    private Set<String> fetchShopUserIdsByProductIds(Set<String> productIds) throws Exception {
        String rawResponse = inventoryRpcClient.post()
                .uri("/internal/v1/inventories/product-owners")
                .header(INTERNAL_TOKEN_HEADER, internalToken)
                .contentType(MediaType.APPLICATION_JSON)
                .body(java.util.Map.of("productIds", productIds))
                .retrieve()
                .body(String.class);

        if (!StringUtils.hasText(rawResponse)) {
            return Set.of();
        }

        JsonNode dataNode = objectMapper.readTree(rawResponse).path("data");
        if (!dataNode.isArray()) {
            return Set.of();
        }

        Set<String> shopUserIds = new LinkedHashSet<>();
        for (JsonNode ownerNode : dataNode) {
            String shopId = ownerNode.path("shopId").asText(null);
            if (StringUtils.hasText(shopId)) {
                shopUserIds.add(shopId.trim());
            }
        }
        return shopUserIds;
    }

    private RestClient buildHttp2RestClient(String baseUrl) {
        HttpClient httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_2)
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        return RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .build();
    }
}

