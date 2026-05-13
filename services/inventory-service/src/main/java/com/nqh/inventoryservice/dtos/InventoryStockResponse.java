package com.nqh.inventoryservice.dtos;

import java.time.LocalDateTime;
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
    private UUID itemId;
    private UUID shopId;
    private String name;
    private String description;
    private UUID categoryId;
    private String brand;
    private String status;
    private String imageUrl;
    private String sku;
    private String productName;
    private Integer availableQuantity;
    private Integer reservedQuantity;
    private Integer totalQuantity;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime deletedAt;
    private Boolean isActive;
}
