package com.nqh.paymentservice.dtos;

import com.nqh.paymentservice.enums.PaymentMethodEnum;
import com.nqh.paymentservice.enums.PaymentStatusEnum;
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
public class PaymentTransactionResponse {
    private UUID paymentId;
    private UUID paymentUuid;
    private String orderCode;
    private UUID customerId;
    private BigDecimal amount;
    private String currency;
    private PaymentMethodEnum method;
    private PaymentStatusEnum status;
    private String providerTransactionId;
    private String paymentUrl;
    private boolean canSucceedInDemo;
    private boolean replayed;
    private String actor;
    private String note;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
