package com.nqh.inventoryservice.repositories;

import com.nqh.inventoryservice.pojos.ProductCategory;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductCategoryRepository extends JpaRepository<ProductCategory, UUID> {

    List<ProductCategory> findByIsActiveTrueOrderByCategoryNameAsc();

    @Query("""
            select c from ProductCategory c
            where c.isActive = true
                and c.id = :categoryId
            """)
    Optional<ProductCategory> findActiveByCategoryId(
            @Param("categoryId") UUID categoryId
    );

    @Query("""
            select c from ProductCategory c
            where c.isActive = true
                and lower(c.categoryName) = lower(:categoryName)
            """)
    Optional<ProductCategory> findActiveByCategoryName(
            @Param("categoryName") String categoryName
    );

    Optional<ProductCategory> findByIsActiveTrueAndId(UUID id);

    @Query("""
            select c from ProductCategory c
            where c.isActive = true
                and c.id <> :categoryId
                and lower(c.categoryName) = lower(:categoryName)
            """)
    Optional<ProductCategory> findActiveByCategoryNameExcludingId(
            @Param("categoryId") UUID categoryId,
            @Param("categoryName") String categoryName
    );
}
