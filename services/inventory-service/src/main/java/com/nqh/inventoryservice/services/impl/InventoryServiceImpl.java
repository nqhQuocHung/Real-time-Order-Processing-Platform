package com.nqh.inventoryservice.services.impl;

import com.nqh.inventoryservice.common.exception.AppException;
import com.nqh.inventoryservice.common.messages.MessageCode;
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
import com.nqh.inventoryservice.enums.InventoryReservationStatusEnum;
import com.nqh.inventoryservice.pojos.InventoryReservation;
import com.nqh.inventoryservice.pojos.InventoryReservationItem;
import com.nqh.inventoryservice.pojos.InventoryStock;
import com.nqh.inventoryservice.repositories.InventoryReservationRepository;
import com.nqh.inventoryservice.repositories.InventoryStockRepository;
import com.nqh.inventoryservice.services.InventoryService;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
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

    public InventoryServiceImpl(
            InventoryStockRepository inventoryStockRepository,
            InventoryReservationRepository inventoryReservationRepository
    ) {
        this.inventoryStockRepository = inventoryStockRepository;
        this.inventoryReservationRepository = inventoryReservationRepository;
    }

    @Override
    @Transactional(readOnly = true)
    @Cacheable(cacheNames = "inventory-stock", key = "#productId.toString()")
    public InventoryStockResponse getStock(UUID productId) {
        InventoryStock stock = inventoryStockRepository.findByProductId(productId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, MessageCode.INVENTORY_PRODUCT_NOT_FOUND));
        return mapToStockResponse(stock);
    }

    @Override
    @Transactional(readOnly = true)
    public List<InventoryStockResponse> getCatalog() {
        return inventoryStockRepository.findByIsActiveTrueOrderByUpdatedAtDesc().stream()
                .map(this::mapToStockResponse)
                .toList();
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
                    .sku(trimToNull(request.getSku()))
                    .productName(trimToNull(request.getProductName()))
                    .availableQuantity(request.getDeltaQuantity())
                    .reservedQuantity(0)
                    .build();
            InventoryStock saved = inventoryStockRepository.save(stock);
            return mapToStockResponse(saved);
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
            stock.setProductName(request.getProductName().trim());
        }

        InventoryStock saved = inventoryStockRepository.save(stock);
        return mapToStockResponse(saved);
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

    private String trimToNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }

    private InventoryStockResponse mapToStockResponse(InventoryStock stock) {
        return InventoryStockResponse.builder()
                .stockId(stock.getId())
                .stockUuid(stock.getUuid())
                .productId(stock.getProductId())
                .sku(stock.getSku())
                .productName(stock.getProductName())
                .availableQuantity(stock.getAvailableQuantity())
                .reservedQuantity(stock.getReservedQuantity())
                .totalQuantity(stock.getAvailableQuantity() + stock.getReservedQuantity())
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
}
