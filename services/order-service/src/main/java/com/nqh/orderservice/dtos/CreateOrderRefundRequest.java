package com.nqh.orderservice.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateOrderRefundRequest {

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
}
