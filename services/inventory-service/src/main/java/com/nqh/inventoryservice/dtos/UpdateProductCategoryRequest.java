package com.nqh.inventoryservice.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateProductCategoryRequest {

    @NotBlank
    @Size(max = 255)
    private String categoryName;

    @Size(max = 1000)
    private String description;
}
