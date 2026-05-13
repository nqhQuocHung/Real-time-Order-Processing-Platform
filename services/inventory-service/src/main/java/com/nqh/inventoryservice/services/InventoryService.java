package com.nqh.inventoryservice.services;

import com.nqh.inventoryservice.dtos.CreatePartnerProductRequest;
import com.nqh.inventoryservice.dtos.CreateProductCategoryRequest;
import com.nqh.inventoryservice.dtos.InventoryAdjustRequest;
import com.nqh.inventoryservice.dtos.InventoryCheckRequest;
import com.nqh.inventoryservice.dtos.InventoryCheckResponse;
import com.nqh.inventoryservice.dtos.InventoryReservationActionRequest;
import com.nqh.inventoryservice.dtos.InventoryReservationResponse;
import com.nqh.inventoryservice.dtos.InventoryReserveRequest;
import com.nqh.inventoryservice.dtos.InventoryStockResponse;
import com.nqh.inventoryservice.dtos.InventorySummaryResponse;
import com.nqh.inventoryservice.dtos.ProductCategoryResponse;
import com.nqh.inventoryservice.dtos.ProductImageUploadResponse;
import java.util.List;
import java.util.UUID;
import org.springframework.web.multipart.MultipartFile;

public interface InventoryService {

    InventoryStockResponse getStock(UUID productId);

    List<InventoryStockResponse> getCatalog();

    List<InventoryStockResponse> getCatalogByShopId(UUID shopId);

    InventoryStockResponse createPartnerProduct(UUID requesterUserId, boolean isAdmin, CreatePartnerProductRequest request);

    List<ProductCategoryResponse> getProductCategories(UUID requesterUserId, boolean isAdmin, UUID requestedShopId);

    ProductCategoryResponse createProductCategory(UUID requesterUserId, boolean isAdmin, CreateProductCategoryRequest request);

    ProductImageUploadResponse uploadProductImage(MultipartFile image);

    InventoryCheckResponse checkStock(InventoryCheckRequest request);

    InventoryReservationResponse reserveStock(InventoryReserveRequest request);

    InventoryReservationResponse releaseReservation(InventoryReservationActionRequest request);

    InventoryReservationResponse confirmDeduct(InventoryReservationActionRequest request);

    InventoryStockResponse adjustStock(InventoryAdjustRequest request);

    InventorySummaryResponse getInventorySummary();
}
