package com.nqh.inventoryservice.repositories;

import com.nqh.inventoryservice.pojos.InventoryReservation;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InventoryReservationRepository extends JpaRepository<InventoryReservation, UUID> {

    Optional<InventoryReservation> findByOrderCode(String orderCode);
}
