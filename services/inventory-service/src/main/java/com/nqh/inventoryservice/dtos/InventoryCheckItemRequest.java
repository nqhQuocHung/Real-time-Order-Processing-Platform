package com.nqh.inventoryservice.dtos;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class InventoryCheckItemRequest {

    @NotNull
    private UUID productId;

    @NotNull
    @Min(value = 1, message = "Quantity must be greater than zero")
    private Integer quantity;
}
