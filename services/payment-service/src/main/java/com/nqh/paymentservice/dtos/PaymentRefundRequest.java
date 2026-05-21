package com.nqh.paymentservice.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PaymentRefundRequest {

    @NotBlank
    @Size(max = 64)
    private String orderCode;

    private BigDecimal refundAmount;

    @Size(max = 10)
    private String currency;

    @NotBlank
    @Size(max = 120)
    private String refundAccountName;

    @NotBlank
    @Size(max = 60)
    private String refundAccountNumber;

    @NotBlank
    @Size(max = 40)
    private String refundBankCode;

    @NotBlank
    @Size(max = 500)
    private String refundReason;

    @Size(max = 120)
    private String actor;

    @NotBlank
    @Size(max = 255)
    private String idempotencyKey;

    @Size(max = 120)
    private String referenceId;

    @Size(max = 255)
    private String note;
}
