package com.nqh.authservice.kafka.producers;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nqh.authservice.dtos.PartnerRequestCreatedEvent;
import com.nqh.authservice.dtos.PartnerRequestDecidedEvent;
import com.nqh.authservice.pojos.PartnerUpgradeRequest;
import com.nqh.authservice.pojos.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class PartnerKafkaProducer {

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    @Value("${app.partner.topic.request-created}")
    private String partnerRequestCreatedTopic;

    @Value("${app.partner.topic.request-decided}")
    private String partnerRequestDecidedTopic;

    public void publishPartnerRequestCreated(PartnerUpgradeRequest partnerUpgradeRequest) {
        User user = partnerUpgradeRequest.getUser();
        PartnerRequestCreatedEvent event = PartnerRequestCreatedEvent.of(
                partnerUpgradeRequest.getId(),
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                partnerUpgradeRequest.getStatus().name(),
                partnerUpgradeRequest.getRequestNote()
        );

        publish(
                partnerRequestCreatedTopic,
                partnerUpgradeRequest.getId().toString(),
                partnerUpgradeRequest.getId().toString(),
                event.eventId(),
                event
        );
    }

    public void publishPartnerRequestDecided(PartnerUpgradeRequest partnerUpgradeRequest, String decision) {
        User user = partnerUpgradeRequest.getUser();
        PartnerRequestDecidedEvent event = PartnerRequestDecidedEvent.of(
                partnerUpgradeRequest.getId(),
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                decision,
                partnerUpgradeRequest.getStatus().name(),
                partnerUpgradeRequest.getReviewNote(),
                partnerUpgradeRequest.getReviewedBy(),
                partnerUpgradeRequest.getReviewedAt()
        );

        publish(
                partnerRequestDecidedTopic,
                user.getId().toString(),
                partnerUpgradeRequest.getId().toString(),
                event.eventId(),
                event
        );
    }

    private void publish(String topic, String key, String requestId, String eventId, Object event) {
        final String payload;
        try {
            payload = objectMapper.writeValueAsString(event);
        } catch (JsonProcessingException ex) {
            log.error(
                    "Failed to serialize partner event. topic={}, key={}, requestId={}, eventId={}",
                    topic,
                    key,
                    requestId,
                    eventId,
                    ex
            );
            return;
        }

        kafkaTemplate.send(topic, key, payload)
                .whenComplete((result, throwable) -> logPublishResult(topic, key, requestId, eventId, result, throwable));
    }

    private void logPublishResult(
            String topic,
            String key,
            String requestId,
            String eventId,
            SendResult<String, String> result,
            Throwable throwable
    ) {
        if (throwable != null) {
            log.error(
                    "Failed to publish partner event. topic={}, key={}, requestId={}, eventId={}",
                    topic,
                    key,
                    requestId,
                    eventId,
                    throwable
            );
            return;
        }

        if (result == null || result.getRecordMetadata() == null) {
            log.info(
                    "Published partner event. topic={}, key={}, requestId={}, eventId={}, partition=-1, offset=-1",
                    topic,
                    key,
                    requestId,
                    eventId
            );
            return;
        }

        log.info(
                "Published partner event. topic={}, key={}, requestId={}, eventId={}, partition={}, offset={}",
                topic,
                key,
                requestId,
                eventId,
                result.getRecordMetadata().partition(),
                result.getRecordMetadata().offset()
        );
    }
}
