package com.nqh.authservice.kafka.events;

import java.time.LocalDateTime;
import java.util.UUID;

public record EventEnvelope<T>(
        String eventId,
        String eventType,
        String eventVersion,
        LocalDateTime occurredAt,
        String source,
        String correlationId,
        T payload
) {
    public static <T> EventEnvelope<T> of(
            String eventType,
            String source,
            String correlationId,
            T payload
    ) {
        return new EventEnvelope<>(
                UUID.randomUUID().toString(),
                eventType,
                "v1",
                LocalDateTime.now(),
                source,
                correlationId,
                payload
        );
    }
}