package com.nqh.authservice.dtos;

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
    public static PartnerRequestDecidedEvent of(
            UUID requestId,
            UUID userId,
            String username,
            String email,
            String decision,
            String status,
            String reviewNote,
            String reviewedBy,
            LocalDateTime reviewedAt
    ) {
        return new PartnerRequestDecidedEvent(
                UUID.randomUUID().toString(),
                "partner.request.decided",
                requestId,
                userId,
                username,
                email,
                decision,
                status,
                reviewNote,
                reviewedBy,
                reviewedAt,
                LocalDateTime.now()
        );
    }
}
