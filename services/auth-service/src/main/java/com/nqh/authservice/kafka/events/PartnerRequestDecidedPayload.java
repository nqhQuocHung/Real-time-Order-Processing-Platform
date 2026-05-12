package com.nqh.authservice.events;

import java.time.LocalDateTime;

public record PartnerRequestDecidedPayload(
        Long partnerRequestId,
        String partnerRequestUuid,
        Long userId,
        String userUuid,
        Long decidedByAdminId,
        String decision,
        String reason,
        LocalDateTime decidedAt,
        LocalDateTime updatedAt
) {
}
