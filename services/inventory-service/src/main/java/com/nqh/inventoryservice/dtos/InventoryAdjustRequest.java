package com.nqh.inventoryservice.dtos;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class InventoryAdjustRequest {

    @NotNull
    private UUID productId;

    @NotNull
    private Integer deltaQuantity;

    @Size(max = 64)
    private String sku;

    @Size(max = 255)
    private String productName;
}
