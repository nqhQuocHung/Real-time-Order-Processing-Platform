package com.nqh.authservice.dtos;

import com.nqh.authservice.enums.PartnerRequestStatusEnum;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PartnerUpgradeRequestResponse {
    private UUID requestId;
    private UUID userId;
    private String username;
    private String email;
    private String shopName;
    private PartnerRequestStatusEnum status;
    private String requestNote;
    private String reviewNote;
    private String reviewedBy;
    private LocalDateTime reviewedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
