package com.nqh.authservice.events;

import java.time.LocalDateTime;

public record PartnerRequestCreatedPayload(
        Long partnerRequestId,
        String partnerRequestUuid,
        Long userId,
        String userUuid,
        String email,
        String shopName,
        String status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}