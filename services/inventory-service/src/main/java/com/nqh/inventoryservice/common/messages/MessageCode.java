package com.nqh.inventoryservice.common.messages;

import lombok.Getter;

@Getter
public enum MessageCode {
    COMMON_SUCCESS("COMMON_SUCCESS", "Success"),
    COMMON_BAD_REQUEST("COMMON_BAD_REQUEST", "Bad request"),
    COMMON_UNAUTHORIZED("COMMON_UNAUTHORIZED", "Unauthorized"),
    COMMON_VALIDATION_ERROR("COMMON_VALIDATION_ERROR", "Validation failed"),
    COMMON_INTERNAL_ERROR("COMMON_INTERNAL_ERROR", "Internal server error"),

    INVENTORY_STOCK_GET_SUCCESS("INVENTORY_STOCK_GET_SUCCESS", "Inventory stock retrieved successfully"),
    INVENTORY_STOCK_CHECK_SUCCESS("INVENTORY_STOCK_CHECK_SUCCESS", "Inventory stock checked successfully"),
    INVENTORY_STOCK_RESERVE_SUCCESS("INVENTORY_STOCK_RESERVE_SUCCESS", "Inventory reserved successfully"),
    INVENTORY_STOCK_RELEASE_SUCCESS("INVENTORY_STOCK_RELEASE_SUCCESS", "Inventory released successfully"),
    INVENTORY_STOCK_COMMIT_SUCCESS("INVENTORY_STOCK_COMMIT_SUCCESS", "Inventory deducted successfully"),
    INVENTORY_STOCK_ADJUST_SUCCESS("INVENTORY_STOCK_ADJUST_SUCCESS", "Inventory adjusted successfully"),
    INVENTORY_PRODUCT_NOT_FOUND("INVENTORY_PRODUCT_NOT_FOUND", "Inventory product not found"),
    INVENTORY_ITEMS_REQUIRED("INVENTORY_ITEMS_REQUIRED", "At least one inventory item is required"),
    INVENTORY_ITEM_QUANTITY_INVALID("INVENTORY_ITEM_QUANTITY_INVALID", "Inventory item quantity must be greater than zero"),
    INVENTORY_ORDER_CODE_REQUIRED("INVENTORY_ORDER_CODE_REQUIRED", "Order code is required"),
    INVENTORY_RESERVATION_NOT_FOUND("INVENTORY_RESERVATION_NOT_FOUND", "Inventory reservation not found"),
    INVENTORY_RESERVATION_ALREADY_RELEASED("INVENTORY_RESERVATION_ALREADY_RELEASED", "Inventory reservation is already released"),
    INVENTORY_RESERVATION_ALREADY_COMMITTED("INVENTORY_RESERVATION_ALREADY_COMMITTED", "Inventory reservation is already committed"),
    INVENTORY_RESERVATION_STATE_INVALID("INVENTORY_RESERVATION_STATE_INVALID", "Inventory reservation state is invalid"),
    INVENTORY_INSUFFICIENT_STOCK("INVENTORY_INSUFFICIENT_STOCK", "Insufficient stock for one or more items"),
    INVENTORY_DUPLICATE_PRODUCT("INVENTORY_DUPLICATE_PRODUCT", "Duplicate product found in request");

    private final String code;
    private final String defaultMessage;

    MessageCode(String code, String defaultMessage) {
        this.code = code;
        this.defaultMessage = defaultMessage;
    }
}
