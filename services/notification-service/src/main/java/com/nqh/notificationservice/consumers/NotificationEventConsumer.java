package com.nqh.notificationservice.consumers;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nqh.notificationservice.services.impl.PartnerRealtimeTargetResolver;
import com.nqh.notificationservice.services.AdminSseService;
import com.nqh.notificationservice.services.NotificationService;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class NotificationEventConsumer {

    private static final Logger LOGGER = LoggerFactory.getLogger(NotificationEventConsumer.class);

    private final ObjectMapper objectMapper;
    private final NotificationService notificationService;
    private final AdminSseService adminSseService;
    private final PartnerRealtimeTargetResolver partnerRealtimeTargetResolver;

    @KafkaListener(
            topics = "${app.notification.topic.payment-succeeded}",
            groupId = "${spring.kafka.consumer.group-id}"
    )
    public void consumePaymentSucceeded(
            String message,
            @Header(KafkaHeaders.RECEIVED_TOPIC) String topic
    ) {
        consumeEvent(topic, "PAYMENT_SUCCEEDED", message);
        pushToUserIfPossible(message, "payment.transaction.succeeded");
    }

    @KafkaListener(
            topics = "${app.notification.topic.payment-failed}",
            groupId = "${spring.kafka.consumer.group-id}"
    )
    public void consumePaymentFailed(
            String message,
            @Header(KafkaHeaders.RECEIVED_TOPIC) String topic
    ) {
        consumeEvent(topic, "PAYMENT_FAILED", message);
        pushToUserIfPossible(message, "payment.transaction.failed");
    }

    @KafkaListener(
            topics = "${app.notification.topic.order-paid}",
            groupId = "${spring.kafka.consumer.group-id}"
    )
    public void consumeOrderPaid(
            String message,
            @Header(KafkaHeaders.RECEIVED_TOPIC) String topic
    ) {
        consumeEvent(topic, "ORDER_PAID", message);
        pushToUserIfPossible(message, "order.lifecycle.paid");
    }

    @KafkaListener(
            topics = "${app.notification.topic.order-completed}",
            groupId = "${spring.kafka.consumer.group-id}"
    )
    public void consumeOrderCompleted(
            String message,
            @Header(KafkaHeaders.RECEIVED_TOPIC) String topic
    ) {
        consumeEvent(topic, "ORDER_COMPLETED", message);
        pushToUserIfPossible(message, "order.lifecycle.completed");
    }

    @KafkaListener(
            topics = "${app.notification.topic.order-failed}",
            groupId = "${spring.kafka.consumer.group-id}"
    )
    public void consumeOrderFailed(
            String message,
            @Header(KafkaHeaders.RECEIVED_TOPIC) String topic
    ) {
        consumeEvent(topic, "ORDER_FAILED", message);
        pushToUserIfPossible(message, "order.lifecycle.failed");
    }

    private void consumeEvent(String topic, String eventType, String message) {
        try {
            notificationService.logNotificationFromEvent(topic, eventType, message);
        } catch (Exception ex) {
            LOGGER.error("Failed to log notification event. topic={}, eventType={}", topic, eventType, ex);
        }
    }

    private void pushToUserIfPossible(String message, String eventName) {
        try {
            JsonNode rootNode = objectMapper.readTree(message);
            JsonNode payloadNode = rootNode.path("payload");
            String customerId = firstNonBlank(
                    payloadNode.path("customerId").asText(null),
                    payloadNode.path("userId").asText(null)
            );

            Map<String, Object> outboundPayload = new LinkedHashMap<>();
            outboundPayload.put("eventId", rootNode.path("eventId").asText(null));
            outboundPayload.put("eventType", rootNode.path("eventType").asText(null));
            outboundPayload.put("occurredAt", rootNode.path("occurredAt").asText(null));
            outboundPayload.put("orderCode", payloadNode.path("orderCode").asText(null));
            outboundPayload.put("customerId", customerId);
            outboundPayload.put("status", payloadNode.path("status").asText(null));
            outboundPayload.put("amount", payloadNode.path("amount").isMissingNode() ? null : payloadNode.path("amount").asText(null));
            outboundPayload.put("currency", payloadNode.path("currency").asText(null));
            outboundPayload.put("method", payloadNode.path("method").asText(null));
            outboundPayload.put("note", payloadNode.path("note").asText(null));

            Set<String> recipients = new LinkedHashSet<>();
            if (customerId != null) {
                recipients.add(customerId);
            }
            recipients.addAll(partnerRealtimeTargetResolver.resolvePartnerUserIds(message));

            for (String recipientUserId : recipients) {
                if (recipientUserId != null && !recipientUserId.isBlank()) {
                    adminSseService.sendToUser(recipientUserId, eventName, outboundPayload);
                }
            }
        } catch (Exception ex) {
            LOGGER.warn("Failed to push realtime notification event. eventName={}", eventName, ex);
        }
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.trim().isEmpty()) {
                return value.trim();
            }
        }
        return null;
    }
}
