package com.nqh.orderservice.dtos;

import com.nqh.orderservice.enums.OrderRefundStatusEnum;
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
public class OrderRefundResponse {
    private UUID refundId;
    private UUID refundUuid;
    private String orderCode;
    private UUID customerId;
    private BigDecimal refundAmount;
    private String currency;
    private String refundAccountName;
    private String refundAccountNumberMasked;
    private String refundBankCode;
    private String refundReason;
    private OrderRefundStatusEnum status;
    private String sellerDecisionNote;
    private String sellerDecisionBy;
    private String providerRefundId;
    private String providerRefundUrl;
    private String providerNote;
    private LocalDateTime processedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
