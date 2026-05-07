package com.nqh.inventoryservice.repositories;

import com.nqh.inventoryservice.pojos.InventoryStock;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InventoryStockRepository extends JpaRepository<InventoryStock, UUID> {

    Optional<InventoryStock> findByProductId(UUID productId);

    List<InventoryStock> findByProductIdIn(List<UUID> productIds);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from InventoryStock s where s.productId = :productId")
    Optional<InventoryStock> findWithLockByProductId(@Param("productId") UUID productId);
}
