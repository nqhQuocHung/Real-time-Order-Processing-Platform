package com.nqh.notificationservice.consumers;

import com.nqh.notificationservice.services.NotificationService;
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

    private final NotificationService notificationService;

    @KafkaListener(
            topics = "${app.notification.topic.payment-succeeded}",
            groupId = "${spring.kafka.consumer.group-id}"
    )
    public void consumePaymentSucceeded(
            String message,
            @Header(KafkaHeaders.RECEIVED_TOPIC) String topic
    ) {
        consumeEvent(topic, "PAYMENT_SUCCEEDED", message);
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
    }

    private void consumeEvent(String topic, String eventType, String message) {
        try {
            notificationService.logNotificationFromEvent(topic, eventType, message);
        } catch (Exception ex) {
            LOGGER.error("Failed to log notification event. topic={}, eventType={}", topic, eventType, ex);
        }
    }
}
