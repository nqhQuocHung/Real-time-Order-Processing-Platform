package com.nqh.notificationservice.kafka.events;

import java.time.LocalDateTime;
import java.util.UUID;

public record PartnerRequestCreatedPayload(
        UUID requestId,
        UUID userId,
        String email,
        String fullName,
        String status,
        String requestNote,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}