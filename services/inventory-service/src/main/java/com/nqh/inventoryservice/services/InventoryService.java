package com.nqh.inventoryservice.services;

import com.nqh.inventoryservice.dtos.InventoryAdjustRequest;
import com.nqh.inventoryservice.dtos.InventoryCheckRequest;
import com.nqh.inventoryservice.dtos.InventoryCheckResponse;
import com.nqh.inventoryservice.dtos.InventoryReservationActionRequest;
import com.nqh.inventoryservice.dtos.InventoryReservationResponse;
import com.nqh.inventoryservice.dtos.InventoryReserveRequest;
import com.nqh.inventoryservice.dtos.InventoryStockResponse;
import com.nqh.inventoryservice.dtos.InventorySummaryResponse;
import java.util.UUID;

public interface InventoryService {

    InventoryStockResponse getStock(UUID productId);

    InventoryCheckResponse checkStock(InventoryCheckRequest request);

    InventoryReservationResponse reserveStock(InventoryReserveRequest request);

    InventoryReservationResponse releaseReservation(InventoryReservationActionRequest request);

    InventoryReservationResponse confirmDeduct(InventoryReservationActionRequest request);

    InventoryStockResponse adjustStock(InventoryAdjustRequest request);

    InventorySummaryResponse getInventorySummary();
}
