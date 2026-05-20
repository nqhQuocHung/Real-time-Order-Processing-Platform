package com.nqh.paymentservice.dtos;

import com.nqh.paymentservice.enums.PaymentRefundStatusEnum;
import java.math.BigDecimal;
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
public class PaymentRefundResponse {
    private UUID refundId;
    private UUID refundUuid;
    private UUID paymentId;
    private String orderCode;
    private UUID customerId;
    private BigDecimal amount;
    private String currency;
    private PaymentRefundStatusEnum status;
    private String providerRefundId;
    private String refundUrl;
    private String actor;
    private String idempotencyKey;
    private String note;
    private LocalDateTime processedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
