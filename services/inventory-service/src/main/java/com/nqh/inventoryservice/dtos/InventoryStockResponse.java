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
public class InventoryStockResponse {
    private UUID stockId;
    private UUID stockUuid;
    private UUID productId;
    private String sku;
    private String productName;
    private Integer availableQuantity;
    private Integer reservedQuantity;
    private Integer totalQuantity;
}
