package com.nqh.paymentservice.common.messages;

import lombok.Getter;

@Getter
public enum MessageCode {
    COMMON_SUCCESS("COMMON_SUCCESS", "Success"),
    COMMON_BAD_REQUEST("COMMON_BAD_REQUEST", "Bad request"),
    COMMON_VALIDATION_ERROR("COMMON_VALIDATION_ERROR", "Validation failed"),
    COMMON_INTERNAL_ERROR("COMMON_INTERNAL_ERROR", "Internal server error"),

    PAYMENT_INTENT_CREATE_SUCCESS("PAYMENT_INTENT_CREATE_SUCCESS", "Payment intent created successfully"),
    PAYMENT_GET_SUCCESS("PAYMENT_GET_SUCCESS", "Payment retrieved successfully"),
    PAYMENT_CONFIRM_SUCCESS("PAYMENT_CONFIRM_SUCCESS", "Payment confirmed successfully"),
    PAYMENT_FAIL_SUCCESS("PAYMENT_FAIL_SUCCESS", "Payment failed successfully"),
    PAYMENT_NOT_FOUND("PAYMENT_NOT_FOUND", "Payment transaction not found"),
    PAYMENT_ORDER_CODE_REQUIRED("PAYMENT_ORDER_CODE_REQUIRED", "Order code is required"),
    PAYMENT_ALREADY_SUCCESS("PAYMENT_ALREADY_SUCCESS", "Payment already marked as success"),
    PAYMENT_ALREADY_FAILED("PAYMENT_ALREADY_FAILED", "Payment already marked as failed"),
    PAYMENT_ALREADY_CANCELLED("PAYMENT_ALREADY_CANCELLED", "Payment already cancelled"),
    PAYMENT_INVALID_STATE("PAYMENT_INVALID_STATE", "Payment transaction state is invalid"),
    PAYMENT_METHOD_NOT_SUPPORTED_FOR_SUCCESS("PAYMENT_METHOD_NOT_SUPPORTED_FOR_SUCCESS", "Only VNPAY can succeed in demo mode");

    private final String code;
    private final String defaultMessage;

    MessageCode(String code, String defaultMessage) {
        this.code = code;
        this.defaultMessage = defaultMessage;
    }
}
