package com.nqh.notificationservice.kafka.events;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDateTime;

public record EventEnvelope(
        String eventId,
        String eventType,
        String eventVersion,
        LocalDateTime occurredAt,
        String source,
        String correlationId,
        JsonNode payload
) {
}