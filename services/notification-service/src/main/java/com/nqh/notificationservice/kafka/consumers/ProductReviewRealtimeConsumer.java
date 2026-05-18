package com.nqh.notificationservice.kafka.consumers;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nqh.notificationservice.services.AdminSseService;
import com.nqh.notificationservice.services.NotificationService;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
    private final NotificationService notificationService;

    @KafkaListener(
            topics = "${app.notification.topic.product-review-created}",
            groupId = "${spring.kafka.consumer.group-id}"
    )
    public void consumeProductReviewCreated(String message) {
        logNotification(message, "product.review.created", "product.review.created");
        pushToRealtimeUsers(message, "product.review.created");
    }

    @KafkaListener(
            topics = "${app.notification.topic.product-review-updated}",
            groupId = "${spring.kafka.consumer.group-id}"
    )
    public void consumeProductReviewUpdated(String message) {
        logNotification(message, "product.review.updated", "product.review.updated");
        pushToRealtimeUsers(message, "product.review.updated");
    }

    @KafkaListener(
            topics = "${app.notification.topic.product-review-comment-created}",
            groupId = "${spring.kafka.consumer.group-id}"
    )
    public void consumeProductReviewCommentCreated(String message) {
        logNotification(message, "product.review.comment.created", "product.review.comment.created");
        pushToRealtimeUsers(message, "product.review.comment.created");
    }

    private void logNotification(String message, String topic, String eventType) {
        try {
            notificationService.logNotificationFromEvent(topic, eventType, message);
        } catch (Exception ex) {
            log.warn("Failed to persist product review notification log. eventType={}", eventType, ex);
        }
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

            List<Map<String, Object>> recipients = extractRecipients(payloadMap.get("recipients"));
            if (recipients.isEmpty()) {
                log.debug("Product review realtime event has no targeted recipients. eventName={}", eventName);
                adminSseService.sendToAllUsers(eventName, outboundPayload);
                adminSseService.sendToAdmins(eventName, outboundPayload);
                return;
            }

            Set<String> sentRecipientIds = new LinkedHashSet<>();
            for (Map<String, Object> recipient : recipients) {
                String recipientUserId = firstNonBlank(
                        readAsTrimmedString(recipient.get("userId")),
                        readAsTrimmedString(recipient.get("recipientUserId"))
                );
                if (recipientUserId == null || !sentRecipientIds.add(recipientUserId)) {
                    continue;
                }

                Map<String, Object> targetedPayload = new LinkedHashMap<>(outboundPayload);
                targetedPayload.put("recipientRole", readAsTrimmedString(recipient.get("role")));
                targetedPayload.put("navigatePath", readAsTrimmedString(recipient.get("navigatePath")));
                adminSseService.sendToUser(recipientUserId, eventName, targetedPayload);
            }
            log.debug(
                    "Product review realtime event pushed to {} recipient(s). eventName={}",
                    sentRecipientIds.size(),
                    eventName
            );
            adminSseService.sendToAdmins(eventName, outboundPayload);
        } catch (Exception ex) {
            log.warn("Failed to push product review realtime event. eventName={}", eventName, ex);
        }
    }

    private List<Map<String, Object>> extractRecipients(Object rawRecipients) {
        if (!(rawRecipients instanceof List<?> recipientList) || recipientList.isEmpty()) {
            return List.of();
        }

        List<Map<String, Object>> normalizedRecipients = new ArrayList<>();
        for (Object recipient : recipientList) {
            if (recipient instanceof Map<?, ?> rawRecipientMap) {
                Map<String, Object> normalized = new LinkedHashMap<>();
                for (Map.Entry<?, ?> entry : rawRecipientMap.entrySet()) {
                    if (entry.getKey() instanceof String key) {
                        normalized.put(key, entry.getValue());
                    }
                }
                normalizedRecipients.add(normalized);
            }
        }

        return normalizedRecipients;
    }

    private String readAsTrimmedString(Object value) {
        if (value == null) {
            return null;
        }
        String text = value.toString().trim();
        return text.isEmpty() ? null : text;
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }
}
