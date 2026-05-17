package com.nqh.notificationservice.kafka.events;

import java.time.LocalDateTime;
import java.util.UUID;

public record PartnerRequestDecidedEvent(
        String eventId,
        String eventType,
        UUID requestId,
        UUID userId,
        String username,
        String email,
        String decision,
        String status,
        String reviewNote,
        String reviewedBy,
        LocalDateTime reviewedAt,
        LocalDateTime occurredAt
) {
}
