package com.nqh.authservice.kafka.events;

import java.time.LocalDateTime;
import java.util.UUID;

public record PartnerRequestDecidedPayload(
        UUID requestId,
        UUID userId,
        String email,
        String username,
        String decision,
        String reviewNote,
        String reviewedBy,
        LocalDateTime reviewedAt,
        LocalDateTime updatedAt
) {
}