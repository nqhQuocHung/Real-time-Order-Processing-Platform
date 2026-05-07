package com.nqh.orderservice.dtos;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateOrderRequest {

    @NotNull
    private UUID customerId;

    @NotBlank
    @Size(max = 10)
    private String currency;

    @NotEmpty
    private List<@Valid CreateOrderItemRequest> items;
}
