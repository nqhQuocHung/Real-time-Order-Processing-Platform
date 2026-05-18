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
public class ProductReviewStatsResponse {

    private UUID productId;
    private double averageRating;
    private long totalReviews;
    private long star1;
    private long star2;
    private long star3;
    private long star4;
    private long star5;
}
