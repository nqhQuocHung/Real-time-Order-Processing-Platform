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
public class ProductReviewCommentResponse {

    private UUID commentId;
    private UUID commentUuid;
    private UUID reviewId;
    private UUID productId;
    private UUID userId;
    private String userName;
    private String content;
    private LocalDateTime editedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
