package com.nqh.inventoryservice.dtos;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.DecimalMin;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdatePartnerProductRequest {

    private UUID shopId;

    @Size(max = 120)
    private String shopName;

    @NotBlank
    @Size(max = 255)
    private String name;

    @Size(max = 1000)
    private String description;

    private UUID categoryId;

    @Size(max = 120)
    private String brand;

    @Size(max = 40)
    private String status;

    @Size(max = 1000)
    private String imageUrl;

    @Size(max = 64)
    private String sku;

    @NotNull
    @DecimalMin(value = "0.0")
    private BigDecimal price;

    @NotNull
    @Min(0)
    private Integer availableQuantity;
}
