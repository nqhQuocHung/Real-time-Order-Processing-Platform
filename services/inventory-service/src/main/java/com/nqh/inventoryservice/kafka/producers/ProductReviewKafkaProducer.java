package com.nqh.inventoryservice.kafka.producers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nqh.inventoryservice.dtos.ProductReviewCommentResponse;
import com.nqh.inventoryservice.dtos.ProductReviewResponse;
import com.nqh.inventoryservice.dtos.ProductReviewStatsResponse;
import java.time.LocalDateTime;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProductReviewKafkaProducer {

    private static final String EVENT_VERSION = "v1";

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    @Value("${app.inventory.topic.product-review-created:product.review.created.v1}")
    private String productReviewCreatedTopic;

    @Value("${app.inventory.topic.product-review-updated:product.review.updated.v1}")
    private String productReviewUpdatedTopic;

    @Value("${app.inventory.topic.product-review-comment-created:product.review.comment.created.v1}")
    private String productReviewCommentCreatedTopic;

    public void publishReviewCreated(
            ProductReviewResponse review,
            ProductReviewStatsResponse stats,
            UUID actorUserId,
            String actorUserName,
            List<Map<String, Object>> recipients
    ) {
        publish(
                productReviewCreatedTopic,
                review != null ? review.getProductId() : null,
                "ProductReviewCreated",
                buildPayload(
                        review != null ? review.getProductId() : null,
                        review,
                        null,
                        stats,
                        actorUserId,
                        actorUserName,
                        recipients
                )
        );
    }

    public void publishReviewUpdated(
            ProductReviewResponse review,
            ProductReviewStatsResponse stats,
            UUID actorUserId,
            String actorUserName,
            List<Map<String, Object>> recipients
    ) {
        publish(
                productReviewUpdatedTopic,
                review != null ? review.getProductId() : null,
                "ProductReviewUpdated",
                buildPayload(
                        review != null ? review.getProductId() : null,
                        review,
                        null,
                        stats,
                        actorUserId,
                        actorUserName,
                        recipients
                )
        );
    }

    public void publishCommentCreated(
            UUID productId,
            ProductReviewCommentResponse comment,
            ProductReviewStatsResponse stats,
            UUID actorUserId,
            String actorUserName,
            List<Map<String, Object>> recipients
    ) {
        publish(
                productReviewCommentCreatedTopic,
                productId,
                "ProductReviewCommentCreated",
                buildPayload(productId, null, comment, stats, actorUserId, actorUserName, recipients)
        );
    }

    private Map<String, Object> buildPayload(
            UUID productId,
            ProductReviewResponse review,
            ProductReviewCommentResponse comment,
            ProductReviewStatsResponse stats,
            UUID actorUserId,
            String actorUserName,
            List<Map<String, Object>> recipients
    ) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("productId", productId);
        payload.put("review", review);
        payload.put("comment", comment);
        payload.put("stats", stats);
        payload.put("actorUserId", actorUserId);
        payload.put("actorUserName", actorUserName);
        payload.put("recipients", recipients == null ? List.of() : recipients);
        return payload;
    }

    private void publish(String topic, UUID productId, String eventType, Map<String, Object> payload) {
        if (!StringUtils.hasText(topic) || productId == null || payload == null) {
            return;
        }

        String key = productId.toString();
        try {
            Map<String, Object> eventEnvelope = new LinkedHashMap<>();
            eventEnvelope.put("eventId", UUID.randomUUID().toString());
            eventEnvelope.put("eventType", eventType);
            eventEnvelope.put("eventVersion", EVENT_VERSION);
            eventEnvelope.put("occurredAt", LocalDateTime.now());
            eventEnvelope.put("source", "inventory-service");
            eventEnvelope.put("correlationId", key);
            eventEnvelope.put("payload", payload);

            String message = objectMapper.writeValueAsString(eventEnvelope);
            kafkaTemplate.send(topic, key, message);
        } catch (Exception ex) {
            log.warn("Failed to publish product review event. topic={}, eventType={}, key={}", topic, eventType, key, ex);
        }
    }
}
