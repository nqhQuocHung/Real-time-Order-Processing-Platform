package com.nqh.orderservice.dtos;

import com.nqh.orderservice.enums.OrderStatusEnum;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateOrderStatusRequest {

    @NotNull
    private OrderStatusEnum status;

    @Size(max = 120)
    private String actor;

    @Size(max = 255)
    private String note;
}
