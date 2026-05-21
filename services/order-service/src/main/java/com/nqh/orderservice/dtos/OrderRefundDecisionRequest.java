package com.nqh.orderservice.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class OrderRefundDecisionRequest {

    @NotBlank
    @Size(max = 16)
    private String decision;

    @Size(max = 255)
    private String note;

    @Size(max = 120)
    private String actor;
}
