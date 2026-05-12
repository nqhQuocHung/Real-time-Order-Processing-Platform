package com.nqh.authservice.dtos;

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
    public static PartnerRequestCreatedEvent of(
            UUID requestId,
            UUID userId,
            String username,
            String email,
            String status,
            String requestNote
    ) {
        return new PartnerRequestCreatedEvent(
                UUID.randomUUID().toString(),
                "partner.request.created",
                requestId,
                userId,
                username,
                email,
                status,
                requestNote,
                LocalDateTime.now()
        );
    }
}
