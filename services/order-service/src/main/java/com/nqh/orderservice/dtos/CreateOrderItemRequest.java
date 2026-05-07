package com.nqh.orderservice.dtos;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateOrderItemRequest {

    @NotNull
    private UUID productId;

    @Size(max = 255)
    private String productName;

    @NotNull
    @Min(value = 1, message = "Quantity must be greater than zero")
    private Integer quantity;

    @NotNull
    @DecimalMin(value = "0.01", message = "Unit price must be greater than zero")
    private BigDecimal unitPrice;
}
