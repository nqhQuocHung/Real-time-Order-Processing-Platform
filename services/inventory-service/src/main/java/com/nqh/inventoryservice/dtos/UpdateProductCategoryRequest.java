package com.nqh.inventoryservice.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateProductCategoryRequest {

    private UUID shopId;

    @NotBlank
    @Size(max = 255)
    private String categoryName;

    @Size(max = 1000)
    private String description;
}
