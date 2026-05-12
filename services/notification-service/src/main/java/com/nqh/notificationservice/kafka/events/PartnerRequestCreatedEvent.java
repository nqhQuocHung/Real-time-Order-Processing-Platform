package com.nqh.notificationservice.kafka.events;

import java.time.LocalDateTime;
import java.util.UUID;

public record PartnerRequestCreatedEvent(
        String eventId,
        String eventType,
        UUID requestId,
        UUID userId,
        String username,
        String email,
        String status,
        String requestNote,
        LocalDateTime occurredAt
) {
}
