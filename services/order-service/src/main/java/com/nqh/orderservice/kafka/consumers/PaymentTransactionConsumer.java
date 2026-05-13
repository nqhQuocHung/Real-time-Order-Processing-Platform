package com.nqh.orderservice.kafka.consumers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nqh.orderservice.common.exception.AppException;
import com.nqh.orderservice.dtos.OrderActionRequest;
import com.nqh.orderservice.kafka.events.EventEnvelope;
import com.nqh.orderservice.services.OrderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class PaymentTransactionConsumer {

    private static final String PAYMENT_EVENT_ACTOR = "PAYMENT_EVENT_CONSUMER";

    private final ObjectMapper objectMapper;
    private final OrderService orderService;

    @KafkaListener(
            topics = "${app.order.topic.payment-succeeded}",
            groupId = "${spring.kafka.consumer.group-id}"
    )
    public void consumePaymentSucceeded(String message) {
        consumeEvent(message, true);
    }

    @KafkaListener(
            topics = "${app.order.topic.payment-failed}",
            groupId = "${spring.kafka.consumer.group-id}"
    )
    public void consumePaymentFailed(String message) {
        consumeEvent(message, false);
    }

    private void consumeEvent(String message, boolean success) {
        try {
            EventEnvelope envelope = objectMapper.readValue(message, EventEnvelope.class);
            String orderCode = envelope.payload() != null ? envelope.payload().path("orderCode").asText("") : "";
            if (orderCode.isBlank()) {
                log.warn("Skip payment event because orderCode is missing. payload={}", message);
                return;
            }

            OrderActionRequest actionRequest = new OrderActionRequest();
            actionRequest.setActor(PAYMENT_EVENT_ACTOR);
            actionRequest.setReferenceId(envelope.eventId());
            actionRequest.setNote(success
                    ? "Order status updated by payment success event"
                    : "Order status updated by payment failed event");

            if (success) {
                orderService.confirmPayment(orderCode, actionRequest);
            } else {
                orderService.failPayment(orderCode, actionRequest);
            }
        } catch (AppException ex) {
            if (ex.getStatus() == HttpStatus.CONFLICT || ex.getStatus() == HttpStatus.NOT_FOUND) {
                log.info("Skip payment event due to current order state. message={}", ex.getMessageCode().getCode());
                return;
            }
            log.error("Failed to apply payment event to order state. payload={}", message, ex);
        } catch (Exception ex) {
            log.error("Failed to consume payment event. payload={}", message, ex);
        }
    }
}
