package com.nqh.notificationservice.kafka.consumers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nqh.notificationservice.kafka.events.PartnerRequestDecidedEvent;
import com.nqh.notificationservice.services.AdminSseService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class PartnerRequestDecidedConsumer {

    private final ObjectMapper objectMapper;
    private final AdminSseService adminSseService;

    @KafkaListener(
            topics = "${app.partner.topic.request-decided}",
            groupId = "${spring.kafka.consumer.group-id}"
    )
    public void consume(String message) {
        try {
            PartnerRequestDecidedEvent event = objectMapper.readValue(message, PartnerRequestDecidedEvent.class);
            log.info(
                    "Consumed partner request decided event. eventId={}, requestId={}, userId={}, status={}, decision={}",
                    event.eventId(),
                    event.requestId(),
                    event.userId(),
                    event.status(),
                    event.decision()
            );
            adminSseService.sendToUser(event.userId().toString(), "partner.request.decided", event);
        } catch (Exception ex) {
            log.error("Failed to consume partner request decided event. payload={}", message, ex);
        }
    }
}
