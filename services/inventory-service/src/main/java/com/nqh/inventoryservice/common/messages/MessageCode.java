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
    INVENTORY_PRODUCT_CREATE_SUCCESS("INVENTORY_PRODUCT_CREATE_SUCCESS", "Partner product created successfully"),
    INVENTORY_PRODUCT_UPDATE_SUCCESS("INVENTORY_PRODUCT_UPDATE_SUCCESS", "Partner product updated successfully"),
    INVENTORY_PRODUCT_DELETE_SUCCESS("INVENTORY_PRODUCT_DELETE_SUCCESS", "Partner product deleted successfully"),
    INVENTORY_CATEGORY_CREATE_SUCCESS("INVENTORY_CATEGORY_CREATE_SUCCESS", "Product category created successfully"),
    INVENTORY_CATEGORY_UPDATE_SUCCESS("INVENTORY_CATEGORY_UPDATE_SUCCESS", "Product category updated successfully"),
    INVENTORY_CATEGORY_DELETE_SUCCESS("INVENTORY_CATEGORY_DELETE_SUCCESS", "Product category deleted successfully"),
    INVENTORY_PRODUCT_IMAGE_UPLOAD_SUCCESS("INVENTORY_PRODUCT_IMAGE_UPLOAD_SUCCESS", "Product image uploaded successfully"),
    INVENTORY_PRODUCT_NOT_FOUND("INVENTORY_PRODUCT_NOT_FOUND", "Inventory product not found"),
    INVENTORY_PRODUCT_SHOP_ID_REQUIRED("INVENTORY_PRODUCT_SHOP_ID_REQUIRED", "Shop ID is required for this operation"),
    INVENTORY_CATEGORY_NOT_FOUND("INVENTORY_CATEGORY_NOT_FOUND", "Product category not found"),
    INVENTORY_CATEGORY_ALREADY_EXISTS("INVENTORY_CATEGORY_ALREADY_EXISTS", "Product category already exists"),
    INVENTORY_CATEGORY_IN_USE("INVENTORY_CATEGORY_IN_USE", "Product category is being used by active products"),
    INVENTORY_PRODUCT_IMAGE_UPLOAD_FAILED("INVENTORY_PRODUCT_IMAGE_UPLOAD_FAILED", "Product image upload failed"),
    INVENTORY_PRODUCT_IMAGE_INVALID_TYPE("INVENTORY_PRODUCT_IMAGE_INVALID_TYPE", "Product image must be an image file"),
    INVENTORY_PRODUCT_IMAGE_TOO_LARGE("INVENTORY_PRODUCT_IMAGE_TOO_LARGE", "Product image is too large"),
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
