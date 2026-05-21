package com.nqh.notificationservice.consumers;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;
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
            topics = "${app.notification.topic.payment-refund-succeeded}",
            groupId = "${spring.kafka.consumer.group-id}"
    )
    public void consumePaymentRefundSucceeded(
            String message,
            @Header(KafkaHeaders.RECEIVED_TOPIC) String topic
    ) {
        consumeEvent(topic, "PAYMENT_REFUND_SUCCEEDED", message);
        pushToUserIfPossible(message, "payment.refund.succeeded");
    }

    @KafkaListener(
            topics = "${app.notification.topic.payment-refund-failed}",
            groupId = "${spring.kafka.consumer.group-id}"
    )
    public void consumePaymentRefundFailed(
            String message,
            @Header(KafkaHeaders.RECEIVED_TOPIC) String topic
    ) {
        consumeEvent(topic, "PAYMENT_REFUND_FAILED", message);
        pushToUserIfPossible(message, "payment.refund.failed");
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

    @KafkaListener(
            topics = "${app.notification.topic.order-refund-requested}",
            groupId = "${spring.kafka.consumer.group-id}"
    )
    public void consumeOrderRefundRequested(
            String message,
            @Header(KafkaHeaders.RECEIVED_TOPIC) String topic
    ) {
        consumeEvent(topic, "ORDER_REFUND_REQUESTED", message);
        pushToUserIfPossible(message, "order.refund.requested", false);
    }

    @KafkaListener(
            topics = "${app.notification.topic.order-refund-approved}",
            groupId = "${spring.kafka.consumer.group-id}"
    )
    public void consumeOrderRefundApproved(
            String message,
            @Header(KafkaHeaders.RECEIVED_TOPIC) String topic
    ) {
        consumeEvent(topic, "ORDER_REFUND_APPROVED", message);
        pushToUserIfPossible(message, "order.refund.approved", true, true);
    }

    @KafkaListener(
            topics = "${app.notification.topic.order-refund-rejected}",
            groupId = "${spring.kafka.consumer.group-id}"
    )
    public void consumeOrderRefundRejected(
            String message,
            @Header(KafkaHeaders.RECEIVED_TOPIC) String topic
    ) {
        consumeEvent(topic, "ORDER_REFUND_REJECTED", message);
        pushToUserIfPossible(message, "order.refund.rejected", true, true);
    }

    @KafkaListener(
            topics = "${app.notification.topic.order-refund-completed}",
            groupId = "${spring.kafka.consumer.group-id}"
    )
    public void consumeOrderRefundCompleted(
            String message,
            @Header(KafkaHeaders.RECEIVED_TOPIC) String topic
    ) {
        consumeEvent(topic, "ORDER_REFUND_COMPLETED", message);
        pushToUserIfPossible(message, "order.refund.completed", true, true);
    }

    @KafkaListener(
            topics = "${app.notification.topic.order-refund-failed}",
            groupId = "${spring.kafka.consumer.group-id}"
    )
    public void consumeOrderRefundFailed(
            String message,
            @Header(KafkaHeaders.RECEIVED_TOPIC) String topic
    ) {
        consumeEvent(topic, "ORDER_REFUND_FAILED", message);
        pushToUserIfPossible(message, "order.refund.failed", true, true);
    }

    private void consumeEvent(String topic, String eventType, String message) {
        try {
            notificationService.logNotificationFromEvent(topic, eventType, message);
        } catch (Exception ex) {
            LOGGER.error("Failed to log notification event. topic={}, eventType={}", topic, eventType, ex);
        }
    }

    private void pushToUserIfPossible(String message, String eventName) {
        pushToUserIfPossible(message, eventName, true);
    }

    private void pushToUserIfPossible(String message, String eventName, boolean includeCustomerRecipient) {
        pushToUserIfPossible(message, eventName, includeCustomerRecipient, false);
    }

    private void pushToUserIfPossible(
            String message,
            String eventName,
            boolean includeCustomerRecipient,
            boolean excludeActorRecipient
    ) {
        try {
            JsonNode rootNode = objectMapper.readTree(message);
            JsonNode payloadNode = rootNode.path("payload");
            String customerId = firstNonBlank(
                    payloadNode.path("customerId").asText(null),
                    payloadNode.path("userId").asText(null)
            );
            String actorUserId = firstNonBlank(payloadNode.path("actor").asText(null));

            Map<String, Object> outboundPayload = new LinkedHashMap<>();
            outboundPayload.put("eventId", rootNode.path("eventId").asText(null));
            outboundPayload.put("eventType", rootNode.path("eventType").asText(null));
            outboundPayload.put("occurredAt", rootNode.path("occurredAt").asText(null));
            Map<String, Object> payloadMap = payloadNode.isMissingNode()
                    ? Map.of()
                    : objectMapper.convertValue(payloadNode, new TypeReference<Map<String, Object>>() {});
            outboundPayload.putAll(payloadMap);
            outboundPayload.put("customerId", customerId);

            Set<String> recipients = new LinkedHashSet<>();
            if (includeCustomerRecipient && customerId != null) {
                recipients.add(customerId);
            }
            try {
                recipients.addAll(partnerRealtimeTargetResolver.resolvePartnerUserIds(message));
            } catch (Exception resolverError) {
                LOGGER.warn(
                        "Failed to resolve partner recipients for realtime push. eventName={}",
                        eventName,
                        resolverError
                );
            }

            if (excludeActorRecipient && actorUserId != null) {
                String normalizedActorUserId = actorUserId.trim();
                boolean actorIsCustomer = customerId != null && normalizedActorUserId.equals(customerId);
                if (!actorIsCustomer) {
                    recipients.remove(normalizedActorUserId);
                }
            }

            for (String recipientUserId : recipients) {
                if (recipientUserId != null && !recipientUserId.isBlank()) {
                    Map<String, Object> targetedPayload = new LinkedHashMap<>(outboundPayload);
                    targetedPayload.put("navigatePath", resolveNavigatePath(recipientUserId, customerId));
                    adminSseService.sendToUser(recipientUserId, eventName, targetedPayload);
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

    private String resolveNavigatePath(String recipientUserId, String customerId) {
        if (customerId != null && customerId.equals(recipientUserId)) {
            return "/user/orders";
        }
        return "/partner/orders";
    }
}
