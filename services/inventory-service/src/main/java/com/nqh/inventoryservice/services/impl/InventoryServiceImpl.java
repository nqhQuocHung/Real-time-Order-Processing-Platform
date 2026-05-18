package com.nqh.inventoryservice.services.impl;

import com.nqh.inventoryservice.common.exception.AppException;
import com.nqh.inventoryservice.common.messages.MessageCode;
import com.nqh.inventoryservice.dtos.CreatePartnerProductRequest;
import com.nqh.inventoryservice.dtos.CreateProductCategoryRequest;
import com.nqh.inventoryservice.dtos.InventoryAdjustRequest;
import com.nqh.inventoryservice.dtos.InventoryCheckItemRequest;
import com.nqh.inventoryservice.dtos.InventoryCheckItemResponse;
import com.nqh.inventoryservice.dtos.InventoryCheckRequest;
import com.nqh.inventoryservice.dtos.InventoryCheckResponse;
import com.nqh.inventoryservice.dtos.InventoryReservationActionRequest;
import com.nqh.inventoryservice.dtos.InventoryReservationItemResponse;
import com.nqh.inventoryservice.dtos.InventoryReservationResponse;
import com.nqh.inventoryservice.dtos.InventoryReserveRequest;
import com.nqh.inventoryservice.dtos.InventoryStockResponse;
import com.nqh.inventoryservice.dtos.InventorySummaryResponse;
import com.nqh.inventoryservice.dtos.ProductCategoryResponse;
import com.nqh.inventoryservice.dtos.UpdatePartnerProductRequest;
import com.nqh.inventoryservice.dtos.UpdateProductCategoryRequest;
import com.nqh.inventoryservice.enums.InventoryReservationStatusEnum;
import com.nqh.inventoryservice.pojos.InventoryReservation;
import com.nqh.inventoryservice.pojos.InventoryReservationItem;
import com.nqh.inventoryservice.pojos.InventoryStock;
import com.nqh.inventoryservice.pojos.ProductCategory;
import com.nqh.inventoryservice.repositories.InventoryReservationRepository;
import com.nqh.inventoryservice.repositories.InventoryStockRepository;
import com.nqh.inventoryservice.repositories.ProductCategoryRepository;
import com.nqh.inventoryservice.services.InventoryService;
import com.nqh.inventoryservice.services.UploadService;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.time.LocalDateTime;
import org.springframework.http.HttpStatus;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class InventoryServiceImpl implements InventoryService {

    private static final String DEFAULT_ORDER_ACTOR = "ORDER_SERVICE";

    private final InventoryStockRepository inventoryStockRepository;
    private final InventoryReservationRepository inventoryReservationRepository;
    private final ProductCategoryRepository productCategoryRepository;
    private final UploadService uploadService;

    public InventoryServiceImpl(
            InventoryStockRepository inventoryStockRepository,
            InventoryReservationRepository inventoryReservationRepository,
            ProductCategoryRepository productCategoryRepository,
            UploadService uploadService
    ) {
        this.inventoryStockRepository = inventoryStockRepository;
        this.inventoryReservationRepository = inventoryReservationRepository;
        this.productCategoryRepository = productCategoryRepository;
        this.uploadService = uploadService;
    }

    @Override
    @Transactional(readOnly = true)
    @Cacheable(cacheNames = "inventory-stock", key = "#productId.toString()")
    public InventoryStockResponse getStock(UUID productId) {
        InventoryStock stock = inventoryStockRepository.findByProductId(productId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, MessageCode.INVENTORY_PRODUCT_NOT_FOUND));
        return mapToStockResponse(stock, resolveCategoryName(stock.getCategoryId(), new HashMap<>()));
    }

    @Override
    @Transactional(readOnly = true)
    public UUID getProductOwnerShopId(UUID productId) {
        if (productId == null) {
            return null;
        }
        return inventoryStockRepository.findByProductId(productId)
                .map(InventoryStock::getShopId)
                .orElse(null);
    }

    @Override
    @Transactional(readOnly = true)
    public List<InventoryStockResponse> getCatalog() {
        List<InventoryStock> stocks = inventoryStockRepository.findByIsActiveTrueOrderByUpdatedAtDesc();
        Map<UUID, String> categoryNameById = buildCategoryNameMap(stocks);
        return stocks.stream()
                .map(stock -> mapToStockResponse(stock, resolveCategoryName(stock.getCategoryId(), categoryNameById)))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<InventoryStockResponse> getCatalogByShopId(UUID shopId) {
        List<InventoryStock> stocks = inventoryStockRepository.findByIsActiveTrueAndShopIdOrderByUpdatedAtDesc(shopId);
        Map<UUID, String> categoryNameById = buildCategoryNameMap(stocks);
        return stocks.stream()
                .map(stock -> mapToStockResponse(stock, resolveCategoryName(stock.getCategoryId(), categoryNameById)))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<InventoryStockResponse> getAdminProducts(UUID shopId, boolean includeInactive) {
        List<InventoryStock> stocks;
        if (shopId != null) {
            stocks = includeInactive
                    ? inventoryStockRepository.findByShopIdOrderByUpdatedAtDesc(shopId)
                    : inventoryStockRepository.findByIsActiveTrueAndShopIdOrderByUpdatedAtDesc(shopId);
        } else {
            stocks = includeInactive
                    ? inventoryStockRepository.findAllByOrderByUpdatedAtDesc()
                    : inventoryStockRepository.findByIsActiveTrueOrderByUpdatedAtDesc();
        }

        Map<UUID, String> categoryNameById = buildCategoryNameMap(stocks);
        return stocks.stream()
                .map(stock -> mapToStockResponse(stock, resolveCategoryName(stock.getCategoryId(), categoryNameById)))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductCategoryResponse> getProductCategories() {
        return productCategoryRepository.findByIsActiveTrueOrderByCategoryNameAsc().stream()
                .map(this::mapToProductCategoryResponse)
                .toList();
    }

    @Override
    @Transactional
    public ProductCategoryResponse createProductCategory(CreateProductCategoryRequest request) {
        String normalizedCategoryName = trimToNull(request.getCategoryName());
        if (normalizedCategoryName == null) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.COMMON_BAD_REQUEST);
        }

        if (productCategoryRepository.findActiveByCategoryName(normalizedCategoryName).isPresent()) {
            throw new AppException(HttpStatus.CONFLICT, MessageCode.INVENTORY_CATEGORY_ALREADY_EXISTS);
        }

        String generatedCategoryCode = UUID.randomUUID().toString();
        ProductCategory savedCategory = productCategoryRepository.save(
                ProductCategory.builder()
                        .shopId(null)
                        .categoryCode(generatedCategoryCode)
                        .categoryName(normalizedCategoryName)
                        .description(trimToNull(request.getDescription()))
                        .build()
        );

        return mapToProductCategoryResponse(savedCategory);
    }

    @Override
    @Transactional
    public ProductCategoryResponse updateProductCategory(
            UUID categoryId,
            UpdateProductCategoryRequest request
    ) {
        String normalizedCategoryName = trimToNull(request.getCategoryName());
        if (normalizedCategoryName == null) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.COMMON_BAD_REQUEST);
        }

        ProductCategory category = productCategoryRepository.findByIsActiveTrueAndId(categoryId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, MessageCode.INVENTORY_CATEGORY_NOT_FOUND));

        if (productCategoryRepository
                .findActiveByCategoryNameExcludingId(categoryId, normalizedCategoryName)
                .isPresent()) {
            throw new AppException(HttpStatus.CONFLICT, MessageCode.INVENTORY_CATEGORY_ALREADY_EXISTS);
        }

        category.setCategoryName(normalizedCategoryName);
        category.setDescription(trimToNull(request.getDescription()));
        ProductCategory updatedCategory = productCategoryRepository.save(category);
        return mapToProductCategoryResponse(updatedCategory);
    }

    @Override
    @Transactional
    public ProductCategoryResponse deleteProductCategory(
            UUID categoryId
    ) {
        ProductCategory category = productCategoryRepository.findByIsActiveTrueAndId(categoryId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, MessageCode.INVENTORY_CATEGORY_NOT_FOUND));

        long activeProducts = inventoryStockRepository.countByIsActiveTrueAndCategoryId(categoryId);
        if (activeProducts > 0) {
            throw new AppException(HttpStatus.CONFLICT, MessageCode.INVENTORY_CATEGORY_IN_USE);
        }

        category.setIsActive(false);
        category.setDeletedAt(LocalDateTime.now());
        ProductCategory deletedCategory = productCategoryRepository.save(category);
        return mapToProductCategoryResponse(deletedCategory);
    }

    @Override
    @Transactional
    @CacheEvict(cacheNames = "inventory-stock", allEntries = true)
    public InventoryStockResponse createPartnerProduct(
            UUID requesterUserId,
            boolean isAdmin,
            CreatePartnerProductRequest request
    ) {
        UUID resolvedShopId = resolveShopId(requesterUserId, isAdmin, request.getShopId());
        UUID resolvedItemId = request.getItemId() != null ? request.getItemId() : UUID.randomUUID();
        UUID resolvedCategoryId = request.getCategoryId();

        if (resolvedCategoryId == null) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.COMMON_BAD_REQUEST);
        }

        if (inventoryStockRepository.findByProductId(resolvedItemId).isPresent()) {
            throw new AppException(HttpStatus.CONFLICT, MessageCode.INVENTORY_DUPLICATE_PRODUCT);
        }

        if (productCategoryRepository.findActiveByCategoryId(resolvedCategoryId).isEmpty()) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.INVENTORY_CATEGORY_NOT_FOUND);
        }

        InventoryStock product = InventoryStock.builder()
                .productId(resolvedItemId)
                .itemId(resolvedItemId)
                .shopId(resolvedShopId)
                .shopName(resolveShopName(request.getShopName(), resolvedShopId))
                .name(trimToNull(request.getName()))
                .description(trimToNull(request.getDescription()))
                .categoryId(resolvedCategoryId)
                .brand(trimToNull(request.getBrand()))
                .productStatus(trimToNull(request.getStatus()))
                .imageUrl(resolveProductImageUrl(request.getImageUrl()))
                .sku(trimToNull(request.getSku()))
                .productName(trimToNull(request.getName()))
                .price(request.getPrice())
                .availableQuantity(request.getAvailableQuantity())
                .reservedQuantity(0)
                .soldQuantity(0)
                .build();

        InventoryStock saved = inventoryStockRepository.save(product);
        return mapToStockResponse(saved, resolveCategoryName(saved.getCategoryId(), new HashMap<>()));
    }

    @Override
    @Transactional
    @CacheEvict(cacheNames = "inventory-stock", allEntries = true)
    public InventoryStockResponse updatePartnerProduct(
            UUID requesterUserId,
            boolean isAdmin,
            UUID productId,
            UpdatePartnerProductRequest request
    ) {
        UUID resolvedShopId = resolveShopId(requesterUserId, isAdmin, request.getShopId());
        InventoryStock product = inventoryStockRepository.findByIsActiveTrueAndProductIdAndShopId(productId, resolvedShopId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, MessageCode.INVENTORY_PRODUCT_NOT_FOUND));

        UUID resolvedCategoryId = request.getCategoryId();
        if (resolvedCategoryId == null) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.COMMON_BAD_REQUEST);
        }
        if (productCategoryRepository.findActiveByCategoryId(resolvedCategoryId).isEmpty()) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.INVENTORY_CATEGORY_NOT_FOUND);
        }

        product.setName(trimToNull(request.getName()));
        product.setProductName(trimToNull(request.getName()));
        product.setDescription(trimToNull(request.getDescription()));
        product.setCategoryId(resolvedCategoryId);
        product.setBrand(trimToNull(request.getBrand()));
        product.setProductStatus(trimToNull(request.getStatus()));
        product.setSku(trimToNull(request.getSku()));
        product.setPrice(request.getPrice());
        product.setAvailableQuantity(request.getAvailableQuantity());
        product.setShopName(resolveShopName(request.getShopName(), resolvedShopId));

        String normalizedImageUrl = trimToNull(request.getImageUrl());
        if (normalizedImageUrl != null) {
            product.setImageUrl(normalizedImageUrl);
        } else if (trimToNull(product.getImageUrl()) == null) {
            product.setImageUrl(uploadService.resolveDefaultProductImageUrl());
        }

        InventoryStock updated = inventoryStockRepository.save(product);
        return mapToStockResponse(updated, resolveCategoryName(updated.getCategoryId(), new HashMap<>()));
    }

    @Override
    @Transactional
    @CacheEvict(cacheNames = "inventory-stock", allEntries = true)
    public InventoryStockResponse deletePartnerProduct(
            UUID requesterUserId,
            boolean isAdmin,
            UUID requestedShopId,
            UUID productId
    ) {
        UUID resolvedShopId = resolveShopId(requesterUserId, isAdmin, requestedShopId);
        InventoryStock product = inventoryStockRepository.findByIsActiveTrueAndProductIdAndShopId(productId, resolvedShopId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, MessageCode.INVENTORY_PRODUCT_NOT_FOUND));

        product.setIsActive(false);
        product.setDeletedAt(LocalDateTime.now());
        product.setProductStatus("INACTIVE");
        InventoryStock deletedProduct = inventoryStockRepository.save(product);
        return mapToStockResponse(
                deletedProduct,
                resolveCategoryName(deletedProduct.getCategoryId(), new HashMap<>())
        );
    }

    @Override
    @Transactional(readOnly = true)
    public InventorySummaryResponse getInventorySummary() {
        long totalProducts = inventoryStockRepository.countByIsActiveTrue();
        long totalAvailableQuantity = inventoryStockRepository.sumAvailableQuantity();
        long totalReservedQuantity = inventoryStockRepository.sumReservedQuantity();

        return InventorySummaryResponse.builder()
                .totalProducts(totalProducts)
                .totalAvailableQuantity(totalAvailableQuantity)
                .totalReservedQuantity(totalReservedQuantity)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public InventoryCheckResponse checkStock(InventoryCheckRequest request) {
        validateItems(request.getItems());

        List<UUID> productIds = request.getItems().stream()
                .map(InventoryCheckItemRequest::getProductId)
                .toList();

        Map<UUID, InventoryStock> stockMap = new HashMap<>();
        for (InventoryStock stock : inventoryStockRepository.findByProductIdIn(productIds)) {
            stockMap.put(stock.getProductId(), stock);
        }

        boolean reservable = true;
        List<InventoryCheckItemResponse> itemResponses = new ArrayList<>();
        for (InventoryCheckItemRequest item : request.getItems()) {
            InventoryStock stock = stockMap.get(item.getProductId());
            int availableQuantity = stock == null ? 0 : stock.getAvailableQuantity();
            boolean enough = availableQuantity >= item.getQuantity();
            if (!enough) {
                reservable = false;
            }

            itemResponses.add(InventoryCheckItemResponse.builder()
                    .productId(item.getProductId())
                    .requestedQuantity(item.getQuantity())
                    .availableQuantity(availableQuantity)
                    .enough(enough)
                    .build());
        }

        return InventoryCheckResponse.builder()
                .reservable(reservable)
                .items(itemResponses)
                .build();
    }

    @Override
    @Transactional
    @CacheEvict(cacheNames = "inventory-stock", allEntries = true)
    public InventoryReservationResponse reserveStock(InventoryReserveRequest request) {
        String orderCode = normalizeOrderCode(request.getOrderCode());
        InventoryReservation existingReservation = inventoryReservationRepository.findByOrderCode(orderCode)
                .orElse(null);

        if (existingReservation != null) {
            return handleExistingReservationOnReserve(existingReservation);
        }

        validateItems(request.getItems());
        Map<UUID, Integer> quantityByProduct = toQuantityMap(request.getItems());

        Map<UUID, InventoryStock> lockedStocks = new HashMap<>();
        for (Map.Entry<UUID, Integer> entry : quantityByProduct.entrySet()) {
            InventoryStock stock = inventoryStockRepository.findWithLockByProductId(entry.getKey())
                    .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, MessageCode.INVENTORY_PRODUCT_NOT_FOUND));
            if (stock.getAvailableQuantity() < entry.getValue()) {
                throw new AppException(HttpStatus.CONFLICT, MessageCode.INVENTORY_INSUFFICIENT_STOCK);
            }
            lockedStocks.put(entry.getKey(), stock);
        }

        for (Map.Entry<UUID, Integer> entry : quantityByProduct.entrySet()) {
            InventoryStock stock = lockedStocks.get(entry.getKey());
            stock.setAvailableQuantity(stock.getAvailableQuantity() - entry.getValue());
            stock.setReservedQuantity(stock.getReservedQuantity() + entry.getValue());
        }
        inventoryStockRepository.saveAll(lockedStocks.values());

        InventoryReservation reservation = InventoryReservation.builder()
                .orderCode(orderCode)
                .status(InventoryReservationStatusEnum.RESERVED)
                .actor(resolveActor(request.getActor(), DEFAULT_ORDER_ACTOR))
                .note(trimToNull(request.getNote()))
                .build();

        for (Map.Entry<UUID, Integer> entry : quantityByProduct.entrySet()) {
            reservation.addItem(InventoryReservationItem.builder()
                    .productId(entry.getKey())
                    .quantity(entry.getValue())
                    .build());
        }

        InventoryReservation savedReservation = inventoryReservationRepository.save(reservation);
        return mapToReservationResponse(savedReservation, false);
    }

    @Override
    @Transactional
    @CacheEvict(cacheNames = "inventory-stock", allEntries = true)
    public InventoryReservationResponse releaseReservation(InventoryReservationActionRequest request) {
        String orderCode = normalizeOrderCode(request.getOrderCode());
        InventoryReservation reservation = inventoryReservationRepository.findByOrderCode(orderCode)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, MessageCode.INVENTORY_RESERVATION_NOT_FOUND));

        if (reservation.getStatus() == InventoryReservationStatusEnum.RELEASED) {
            return mapToReservationResponse(reservation, true);
        }
        if (reservation.getStatus() == InventoryReservationStatusEnum.COMMITTED) {
            throw new AppException(HttpStatus.CONFLICT, MessageCode.INVENTORY_RESERVATION_ALREADY_COMMITTED);
        }
        if (reservation.getStatus() != InventoryReservationStatusEnum.RESERVED) {
            throw new AppException(HttpStatus.CONFLICT, MessageCode.INVENTORY_RESERVATION_STATE_INVALID);
        }

        for (InventoryReservationItem item : reservation.getItems()) {
            InventoryStock stock = inventoryStockRepository.findWithLockByProductId(item.getProductId())
                    .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, MessageCode.INVENTORY_PRODUCT_NOT_FOUND));
            if (stock.getReservedQuantity() < item.getQuantity()) {
                throw new AppException(HttpStatus.CONFLICT, MessageCode.INVENTORY_RESERVATION_STATE_INVALID);
            }

            stock.setReservedQuantity(stock.getReservedQuantity() - item.getQuantity());
            stock.setAvailableQuantity(stock.getAvailableQuantity() + item.getQuantity());
        }

        reservation.setStatus(InventoryReservationStatusEnum.RELEASED);
        reservation.setActor(resolveActor(request.getActor(), DEFAULT_ORDER_ACTOR));
        reservation.setNote(trimToNull(request.getNote()));
        InventoryReservation savedReservation = inventoryReservationRepository.save(reservation);
        return mapToReservationResponse(savedReservation, false);
    }

    @Override
    @Transactional
    @CacheEvict(cacheNames = "inventory-stock", allEntries = true)
    public InventoryReservationResponse confirmDeduct(InventoryReservationActionRequest request) {
        String orderCode = normalizeOrderCode(request.getOrderCode());
        InventoryReservation reservation = inventoryReservationRepository.findByOrderCode(orderCode)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, MessageCode.INVENTORY_RESERVATION_NOT_FOUND));

        if (reservation.getStatus() == InventoryReservationStatusEnum.COMMITTED) {
            return mapToReservationResponse(reservation, true);
        }
        if (reservation.getStatus() == InventoryReservationStatusEnum.RELEASED) {
            throw new AppException(HttpStatus.CONFLICT, MessageCode.INVENTORY_RESERVATION_ALREADY_RELEASED);
        }
        if (reservation.getStatus() != InventoryReservationStatusEnum.RESERVED) {
            throw new AppException(HttpStatus.CONFLICT, MessageCode.INVENTORY_RESERVATION_STATE_INVALID);
        }

        for (InventoryReservationItem item : reservation.getItems()) {
            InventoryStock stock = inventoryStockRepository.findWithLockByProductId(item.getProductId())
                    .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, MessageCode.INVENTORY_PRODUCT_NOT_FOUND));
            if (stock.getReservedQuantity() < item.getQuantity()) {
                throw new AppException(HttpStatus.CONFLICT, MessageCode.INVENTORY_RESERVATION_STATE_INVALID);
            }

            stock.setReservedQuantity(stock.getReservedQuantity() - item.getQuantity());
            stock.setSoldQuantity(normalizeNonNegativeQuantity(stock.getSoldQuantity()) + item.getQuantity());
        }

        reservation.setStatus(InventoryReservationStatusEnum.COMMITTED);
        reservation.setActor(resolveActor(request.getActor(), DEFAULT_ORDER_ACTOR));
        reservation.setNote(trimToNull(request.getNote()));
        InventoryReservation savedReservation = inventoryReservationRepository.save(reservation);
        return mapToReservationResponse(savedReservation, false);
    }

    @Override
    @Transactional
    @CacheEvict(cacheNames = "inventory-stock", key = "#request.productId.toString()")
    public InventoryStockResponse adjustStock(InventoryAdjustRequest request) {
        if (request.getDeltaQuantity() == 0) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.COMMON_BAD_REQUEST);
        }

        InventoryStock stock = inventoryStockRepository.findWithLockByProductId(request.getProductId())
                .orElse(null);

        if (stock == null) {
            if (request.getDeltaQuantity() < 0) {
                throw new AppException(HttpStatus.NOT_FOUND, MessageCode.INVENTORY_PRODUCT_NOT_FOUND);
            }

            stock = InventoryStock.builder()
                    .productId(request.getProductId())
                    .itemId(request.getProductId())
                    .sku(trimToNull(request.getSku()))
                    .name(trimToNull(request.getProductName()))
                    .productName(trimToNull(request.getProductName()))
                    .availableQuantity(request.getDeltaQuantity())
                    .reservedQuantity(0)
                    .soldQuantity(0)
                    .build();
            InventoryStock saved = inventoryStockRepository.save(stock);
            return mapToStockResponse(saved, resolveCategoryName(saved.getCategoryId(), new HashMap<>()));
        }

        int nextAvailable = stock.getAvailableQuantity() + request.getDeltaQuantity();
        if (nextAvailable < 0) {
            throw new AppException(HttpStatus.CONFLICT, MessageCode.INVENTORY_INSUFFICIENT_STOCK);
        }

        stock.setAvailableQuantity(nextAvailable);
        if (StringUtils.hasText(request.getSku())) {
            stock.setSku(request.getSku().trim());
        }
        if (StringUtils.hasText(request.getProductName())) {
            String normalizedProductName = request.getProductName().trim();
            stock.setProductName(normalizedProductName);
            stock.setName(normalizedProductName);
        }

        InventoryStock saved = inventoryStockRepository.save(stock);
        return mapToStockResponse(saved, resolveCategoryName(saved.getCategoryId(), new HashMap<>()));
    }

    private InventoryReservationResponse handleExistingReservationOnReserve(InventoryReservation reservation) {
        if (reservation.getStatus() == InventoryReservationStatusEnum.RESERVED) {
            return mapToReservationResponse(reservation, true);
        }
        if (reservation.getStatus() == InventoryReservationStatusEnum.RELEASED) {
            throw new AppException(HttpStatus.CONFLICT, MessageCode.INVENTORY_RESERVATION_ALREADY_RELEASED);
        }
        if (reservation.getStatus() == InventoryReservationStatusEnum.COMMITTED) {
            throw new AppException(HttpStatus.CONFLICT, MessageCode.INVENTORY_RESERVATION_ALREADY_COMMITTED);
        }
        throw new AppException(HttpStatus.CONFLICT, MessageCode.INVENTORY_RESERVATION_STATE_INVALID);
    }

    private Map<UUID, Integer> toQuantityMap(List<InventoryCheckItemRequest> items) {
        Map<UUID, Integer> quantityByProduct = new HashMap<>();
        for (InventoryCheckItemRequest item : items) {
            quantityByProduct.merge(item.getProductId(), item.getQuantity(), Integer::sum);
        }
        return quantityByProduct;
    }

    private void validateItems(List<InventoryCheckItemRequest> items) {
        if (items == null || items.isEmpty()) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.INVENTORY_ITEMS_REQUIRED);
        }

        Set<UUID> uniqueProducts = new HashSet<>();
        for (InventoryCheckItemRequest item : items) {
            if (item.getQuantity() == null || item.getQuantity() <= 0) {
                throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.INVENTORY_ITEM_QUANTITY_INVALID);
            }
            if (!uniqueProducts.add(item.getProductId())) {
                throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.INVENTORY_DUPLICATE_PRODUCT);
            }
        }
    }

    private String normalizeOrderCode(String orderCode) {
        if (!StringUtils.hasText(orderCode)) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.INVENTORY_ORDER_CODE_REQUIRED);
        }
        return orderCode.trim();
    }

    private String resolveActor(String actor, String fallbackActor) {
        if (!StringUtils.hasText(actor)) {
            return fallbackActor;
        }
        return actor.trim();
    }

    private UUID resolveShopId(UUID requesterUserId, boolean isAdmin, UUID requestedShopId) {
        if (!isAdmin) {
            return requesterUserId;
        }
        if (requestedShopId == null) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.INVENTORY_PRODUCT_SHOP_ID_REQUIRED);
        }
        return requestedShopId;
    }

    private String resolveProductImageUrl(String imageUrl) {
        String normalizedImageUrl = trimToNull(imageUrl);
        if (normalizedImageUrl != null) {
            return normalizedImageUrl;
        }
        return uploadService.resolveDefaultProductImageUrl();
    }

    private String resolveShopName(String shopName, UUID shopId) {
        String normalizedShopName = trimToNull(shopName);
        if (normalizedShopName != null) {
            return normalizedShopName;
        }

        if (shopId == null) {
            return null;
        }

        String compactShopId = shopId.toString().replace("-", "");
        int maxLength = Math.min(compactShopId.length(), 8);
        return "Shop-" + compactShopId.substring(0, maxLength).toUpperCase();
    }

    private String trimToNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }

    private Map<UUID, String> buildCategoryNameMap(Collection<InventoryStock> stocks) {
        Set<UUID> categoryIds = new HashSet<>();
        for (InventoryStock stock : stocks) {
            if (stock.getCategoryId() != null) {
                categoryIds.add(stock.getCategoryId());
            }
        }

        if (categoryIds.isEmpty()) {
            return new HashMap<>();
        }

        Map<UUID, String> categoryNameById = new HashMap<>();
        for (ProductCategory category : productCategoryRepository.findAllById(categoryIds)) {
            if (category.getId() != null) {
                categoryNameById.put(category.getId(), trimToNull(category.getCategoryName()));
            }
        }
        return categoryNameById;
    }

    private String resolveCategoryName(UUID categoryId, Map<UUID, String> categoryNameById) {
        if (categoryId == null) {
            return null;
        }

        String fromMap = categoryNameById.get(categoryId);
        if (fromMap != null) {
            return fromMap;
        }

        return productCategoryRepository.findById(categoryId)
                .map(ProductCategory::getCategoryName)
                .map(this::trimToNull)
                .orElse(null);
    }

    private InventoryStockResponse mapToStockResponse(InventoryStock stock, String categoryName) {
        int availableQuantity = normalizeNonNegativeQuantity(stock.getAvailableQuantity());
        int reservedQuantity = normalizeNonNegativeQuantity(stock.getReservedQuantity());
        int soldQuantity = normalizeNonNegativeQuantity(stock.getSoldQuantity());

        return InventoryStockResponse.builder()
                .stockId(stock.getId())
                .stockUuid(stock.getUuid())
                .productId(stock.getProductId())
                .itemId(stock.getItemId() != null ? stock.getItemId() : stock.getProductId())
                .shopId(stock.getShopId())
                .shopName(resolveShopName(stock.getShopName(), stock.getShopId()))
                .name(stock.getName() != null ? stock.getName() : stock.getProductName())
                .description(stock.getDescription())
                .categoryId(stock.getCategoryId())
                .categoryName(categoryName)
                .brand(stock.getBrand())
                .status(stock.getProductStatus())
                .imageUrl(stock.getImageUrl())
                .sku(stock.getSku())
                .productName(stock.getProductName() != null ? stock.getProductName() : stock.getName())
                .price(stock.getPrice())
                .availableQuantity(availableQuantity)
                .reservedQuantity(reservedQuantity)
                .paidQuantity(soldQuantity)
                .soldQuantity(soldQuantity)
                .totalQuantity(availableQuantity + reservedQuantity)
                .createdAt(stock.getCreatedAt())
                .updatedAt(stock.getUpdatedAt())
                .deletedAt(stock.getDeletedAt())
                .isActive(stock.getIsActive())
                .build();
    }

    private ProductCategoryResponse mapToProductCategoryResponse(ProductCategory category) {
        return ProductCategoryResponse.builder()
                .categoryUid(category.getId())
                .categoryUuid(category.getUuid())
                .categoryId(category.getId())
                .categoryName(category.getCategoryName())
                .description(category.getDescription())
                .createdAt(category.getCreatedAt())
                .updatedAt(category.getUpdatedAt())
                .build();
    }

    private InventoryReservationResponse mapToReservationResponse(InventoryReservation reservation, boolean replayed) {
        List<InventoryReservationItemResponse> items = reservation.getItems().stream()
                .map(item -> InventoryReservationItemResponse.builder()
                        .productId(item.getProductId())
                        .quantity(item.getQuantity())
                        .build())
                .toList();

        return InventoryReservationResponse.builder()
                .reservationId(reservation.getId())
                .reservationUuid(reservation.getUuid())
                .orderCode(reservation.getOrderCode())
                .status(reservation.getStatus())
                .replayed(replayed)
                .actor(reservation.getActor())
                .note(reservation.getNote())
                .createdAt(reservation.getCreatedAt())
                .updatedAt(reservation.getUpdatedAt())
                .items(items)
                .build();
    }

    private int normalizeNonNegativeQuantity(Integer value) {
        if (value == null || value < 0) {
            return 0;
        }
        return value;
    }
}
