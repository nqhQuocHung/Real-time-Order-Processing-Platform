package com.nqh.inventoryservice.repositories;

import com.nqh.inventoryservice.pojos.ProductReviewComment;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductReviewCommentRepository extends JpaRepository<ProductReviewComment, UUID> {

    List<ProductReviewComment> findByIsActiveTrueAndReview_IdInOrderByCreatedAtAsc(Collection<UUID> reviewIds);
}
