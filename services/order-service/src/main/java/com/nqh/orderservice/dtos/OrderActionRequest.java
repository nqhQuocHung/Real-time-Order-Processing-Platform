package com.nqh.orderservice.dtos;

import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class OrderActionRequest {

    @Size(max = 120)
    private String actor;

    @Size(max = 255)
    private String note;

    @Size(max = 120)
    private String referenceId;
}
