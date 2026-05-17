package com.nqh.notificationservice.kafka.consumers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nqh.notificationservice.kafka.events.PartnerRequestCreatedEvent;
import com.nqh.notificationservice.services.AdminSseService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class PartnerRequestCreatedConsumer {

    private final ObjectMapper objectMapper;
    private final AdminSseService adminSseService;

    @KafkaListener(
            topics = "${app.partner.topic.request-created}",
            groupId = "${spring.kafka.consumer.group-id}"
    )
    public void consume(String message) {
        try {
            PartnerRequestCreatedEvent event = objectMapper.readValue(message, PartnerRequestCreatedEvent.class);
            log.info(
                    "Consumed partner request created event. eventId={}, requestId={}, userId={}, status={}",
                    event.eventId(),
                    event.requestId(),
                    event.userId(),
                    event.status()
            );
            adminSseService.sendToAdmins("partner.request.created", event);
        } catch (Exception ex) {
            log.error("Failed to consume partner request created event. payload={}", message, ex);
        }
    }
}
