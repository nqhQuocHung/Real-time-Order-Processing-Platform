package com.nqh.inventoryservice.repositories;

import com.nqh.inventoryservice.pojos.ProductCategory;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductCategoryRepository extends JpaRepository<ProductCategory, UUID> {

    List<ProductCategory> findByIsActiveTrueAndShopIdOrderByCategoryNameAsc(UUID shopId);

    @Query("""
            select c from ProductCategory c
            where c.isActive = true
                and c.shopId = :shopId
                and c.id = :categoryId
            """)
    Optional<ProductCategory> findActiveByShopIdAndCategoryId(
            @Param("shopId") UUID shopId,
            @Param("categoryId") UUID categoryId
    );

    @Query("""
            select c from ProductCategory c
            where c.isActive = true
                and c.shopId = :shopId
                and lower(c.categoryName) = lower(:categoryName)
            """)
    Optional<ProductCategory> findActiveByShopIdAndCategoryName(
            @Param("shopId") UUID shopId,
            @Param("categoryName") String categoryName
    );
}
