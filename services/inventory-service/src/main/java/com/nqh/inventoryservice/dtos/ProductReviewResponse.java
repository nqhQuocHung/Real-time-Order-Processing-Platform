package com.nqh.inventoryservice.dtos;

import java.time.LocalDateTime;
import java.util.List;
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
public class ProductReviewResponse {

    private UUID reviewId;
    private UUID reviewUuid;
    private UUID productId;
    private UUID userId;
    private String userName;
    private Integer rating;
    private String title;
    private String content;
    private String orderCode;
    private Boolean verifiedPurchase;
    private LocalDateTime editedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<ProductReviewCommentResponse> comments;
}
