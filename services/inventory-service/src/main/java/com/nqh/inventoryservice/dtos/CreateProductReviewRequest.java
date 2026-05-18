package com.nqh.inventoryservice.dtos;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
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
public class CreateProductReviewRequest {

    @NotNull
    @Min(1)
    @Max(5)
    private Integer rating;

    @Size(max = 160)
    private String title;

    @NotBlank
    @Size(max = 2000)
    private String content;

    @Size(max = 64)
    private String orderCode;
}
