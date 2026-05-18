package com.nqh.notificationservice.kafka.consumers;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nqh.notificationservice.services.AdminSseService;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class ProductReviewRealtimeConsumer {

    private final ObjectMapper objectMapper;
    private final AdminSseService adminSseService;

    @KafkaListener(
            topics = "${app.notification.topic.product-review-created}",
            groupId = "${spring.kafka.consumer.group-id}"
    )
    public void consumeProductReviewCreated(String message) {
        pushToRealtimeUsers(message, "product.review.created");
    }

    @KafkaListener(
            topics = "${app.notification.topic.product-review-updated}",
            groupId = "${spring.kafka.consumer.group-id}"
    )
    public void consumeProductReviewUpdated(String message) {
        pushToRealtimeUsers(message, "product.review.updated");
    }

    @KafkaListener(
            topics = "${app.notification.topic.product-review-comment-created}",
            groupId = "${spring.kafka.consumer.group-id}"
    )
    public void consumeProductReviewCommentCreated(String message) {
        pushToRealtimeUsers(message, "product.review.comment.created");
    }

    private void pushToRealtimeUsers(String message, String eventName) {
        try {
            JsonNode rootNode = objectMapper.readTree(message);
            JsonNode payloadNode = rootNode.path("payload");
            Map<String, Object> payloadMap = payloadNode.isMissingNode()
                    ? new LinkedHashMap<>()
                    : objectMapper.convertValue(payloadNode, new TypeReference<Map<String, Object>>() {
                    });

            Map<String, Object> outboundPayload = new LinkedHashMap<>();
            outboundPayload.put("eventId", rootNode.path("eventId").asText(null));
            outboundPayload.put("eventType", rootNode.path("eventType").asText(null));
            outboundPayload.put("occurredAt", rootNode.path("occurredAt").asText(null));
            outboundPayload.putAll(payloadMap);

            adminSseService.sendToAllUsers(eventName, outboundPayload);
            adminSseService.sendToAdmins(eventName, outboundPayload);
        } catch (Exception ex) {
            log.warn("Failed to push product review realtime event. eventName={}", eventName, ex);
        }
    }
}
