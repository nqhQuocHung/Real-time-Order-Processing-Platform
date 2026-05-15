package com.nqh.orderservice.common.messages;

import lombok.Getter;

@Getter
public enum MessageCode {
    COMMON_SUCCESS("COMMON_SUCCESS", "Success"),
    COMMON_BAD_REQUEST("COMMON_BAD_REQUEST", "Bad request"),
    COMMON_UNAUTHORIZED("COMMON_UNAUTHORIZED", "Unauthorized"),
    COMMON_VALIDATION_ERROR("COMMON_VALIDATION_ERROR", "Validation failed"),
    COMMON_INTERNAL_ERROR("COMMON_INTERNAL_ERROR", "Internal server error"),

    ORDER_CREATE_SUCCESS("ORDER_CREATE_SUCCESS", "Order created successfully"),
    ORDER_GET_SUCCESS("ORDER_GET_SUCCESS", "Order retrieved successfully"),
    ORDER_LIST_SUCCESS("ORDER_LIST_SUCCESS", "Orders retrieved successfully"),
    ORDER_CANCEL_SUCCESS("ORDER_CANCEL_SUCCESS", "Order cancelled successfully"),
    ORDER_STATUS_UPDATE_SUCCESS("ORDER_STATUS_UPDATE_SUCCESS", "Order status updated successfully"),
    ORDER_PAYMENT_CONFIRM_SUCCESS("ORDER_PAYMENT_CONFIRM_SUCCESS", "Order payment confirmed successfully"),
    ORDER_PAYMENT_FAIL_SUCCESS("ORDER_PAYMENT_FAIL_SUCCESS", "Order payment failed successfully"),
    ORDER_SHIPPING_CONFIRM_SUCCESS("ORDER_SHIPPING_CONFIRM_SUCCESS", "Order shipping confirmed successfully"),
    ORDER_TIMELINE_SUCCESS("ORDER_TIMELINE_SUCCESS", "Order timeline retrieved successfully"),
    ORDER_NOT_FOUND("ORDER_NOT_FOUND", "Order not found"),
    ORDER_DATE_RANGE_INVALID("ORDER_DATE_RANGE_INVALID", "createdFrom must be before or equal to createdTo"),
    ORDER_CANCEL_NOT_ALLOWED("ORDER_CANCEL_NOT_ALLOWED", "Order cannot be cancelled in current status"),
    ORDER_STATUS_TRANSITION_INVALID("ORDER_STATUS_TRANSITION_INVALID", "Order status transition is not allowed"),
    ORDER_IDEMPOTENCY_KEY_REQUIRED("ORDER_IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required"),
    ORDER_IDEMPOTENCY_KEY_TOO_LONG("ORDER_IDEMPOTENCY_KEY_TOO_LONG", "Idempotency-Key must not exceed 255 characters"),
    ORDER_ITEMS_REQUIRED("ORDER_ITEMS_REQUIRED", "At least one order item is required"),
    ORDER_ITEM_QUANTITY_INVALID("ORDER_ITEM_QUANTITY_INVALID", "Order item quantity must be greater than zero"),
    ORDER_ITEM_UNIT_PRICE_INVALID("ORDER_ITEM_UNIT_PRICE_INVALID", "Order item unit price must be greater than zero");

    private final String code;
    private final String defaultMessage;

    MessageCode(String code, String defaultMessage) {
        this.code = code;
        this.defaultMessage = defaultMessage;
    }
}
