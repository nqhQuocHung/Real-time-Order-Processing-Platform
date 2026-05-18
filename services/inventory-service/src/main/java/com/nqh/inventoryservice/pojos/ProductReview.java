package com.nqh.inventoryservice.pojos;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

@Entity
@Table(name = "product_reviews", schema = "inventory")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class ProductReview extends BasePojo {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @EqualsAndHashCode.Include
    private UUID id;

    @Column(name = "product_id", nullable = false)
    private UUID productId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "user_name", length = 120)
    private String userName;

    @Column(name = "rating", nullable = false)
    private Integer rating;

    @Column(name = "review_title", length = 160)
    private String title;

    @Column(name = "review_content", nullable = false, length = 2000)
    private String content;

    @Column(name = "order_code", length = 64)
    private String orderCode;

    @Column(name = "verified_purchase", nullable = false)
    @Builder.Default
    private Boolean verifiedPurchase = Boolean.FALSE;

    @Column(name = "edited_at")
    private LocalDateTime editedAt;

    @Builder.Default
    @ToString.Exclude
    @OneToMany(mappedBy = "review", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<ProductReviewComment> comments = new ArrayList<>();
}
