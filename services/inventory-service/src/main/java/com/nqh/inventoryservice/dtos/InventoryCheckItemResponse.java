package com.nqh.inventoryservice.dtos;

import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InventoryCheckItemResponse {
    private UUID productId;
    private Integer requestedQuantity;
    private Integer availableQuantity;
    private boolean enough;
}
