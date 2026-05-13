package com.nqh.paymentservice.dtos;

import com.nqh.paymentservice.enums.PaymentMethodEnum;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreatePaymentIntentRequest {

    @NotBlank
    @Size(max = 64)
    private String orderCode;

    @NotNull
    private UUID customerId;

    @NotNull
    @DecimalMin(value = "0.01", message = "Amount must be greater than zero")
    private BigDecimal amount;

    @NotBlank
    @Size(max = 10)
    private String currency;

    @NotNull
    private PaymentMethodEnum method;

    @Size(max = 120)
    private String actor;

    @Size(max = 255)
    private String note;
}
