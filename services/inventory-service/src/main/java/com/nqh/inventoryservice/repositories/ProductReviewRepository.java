package com.nqh.inventoryservice.repositories;

import com.nqh.inventoryservice.pojos.ProductReview;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductReviewRepository extends JpaRepository<ProductReview, UUID> {

    Page<ProductReview> findByIsActiveTrueAndProductId(UUID productId, Pageable pageable);

    Optional<ProductReview> findByIsActiveTrueAndProductIdAndUserId(UUID productId, UUID userId);

    Optional<ProductReview> findByIsActiveTrueAndId(UUID reviewId);

    long countByIsActiveTrueAndProductId(UUID productId);

    long countByIsActiveTrueAndProductIdAndRating(UUID productId, Integer rating);

    @Query("""
            select coalesce(avg(r.rating), 0)
            from ProductReview r
            where r.isActive = true and r.productId = :productId
            """)
    Double calculateAverageRating(@Param("productId") UUID productId);
}
