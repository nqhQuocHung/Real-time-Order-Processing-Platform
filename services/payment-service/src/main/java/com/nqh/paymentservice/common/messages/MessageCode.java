package com.nqh.paymentservice.common.messages;

import lombok.Getter;

@Getter
public enum MessageCode {
    COMMON_SUCCESS("COMMON_SUCCESS", "Success"),
    COMMON_BAD_REQUEST("COMMON_BAD_REQUEST", "Bad request"),
    COMMON_UNAUTHORIZED("COMMON_UNAUTHORIZED", "Unauthorized"),
    COMMON_VALIDATION_ERROR("COMMON_VALIDATION_ERROR", "Validation failed"),
    COMMON_INTERNAL_ERROR("COMMON_INTERNAL_ERROR", "Internal server error"),

    PAYMENT_INTENT_CREATE_SUCCESS("PAYMENT_INTENT_CREATE_SUCCESS", "Payment intent created successfully"),
    PAYMENT_GET_SUCCESS("PAYMENT_GET_SUCCESS", "Payment retrieved successfully"),
    PAYMENT_CONFIRM_SUCCESS("PAYMENT_CONFIRM_SUCCESS", "Payment confirmed successfully"),
    PAYMENT_FAIL_SUCCESS("PAYMENT_FAIL_SUCCESS", "Payment failed successfully"),
    PAYMENT_REFUND_SUCCESS("PAYMENT_REFUND_SUCCESS", "Payment refunded successfully"),
    PAYMENT_NOT_FOUND("PAYMENT_NOT_FOUND", "Payment transaction not found"),
    PAYMENT_ORDER_CODE_REQUIRED("PAYMENT_ORDER_CODE_REQUIRED", "Order code is required"),
    PAYMENT_ALREADY_SUCCESS("PAYMENT_ALREADY_SUCCESS", "Payment already marked as success"),
    PAYMENT_ALREADY_FAILED("PAYMENT_ALREADY_FAILED", "Payment already marked as failed"),
    PAYMENT_INVALID_STATE("PAYMENT_INVALID_STATE", "Payment transaction state is invalid"),
    PAYMENT_METHOD_NOT_SUPPORTED_FOR_SUCCESS("PAYMENT_METHOD_NOT_SUPPORTED_FOR_SUCCESS", "Only VNPAY can succeed in demo mode"),
    PAYMENT_REFUND_ALREADY_EXISTS("PAYMENT_REFUND_ALREADY_EXISTS", "Payment refund already exists"),
    PAYMENT_REFUND_INVALID_AMOUNT("PAYMENT_REFUND_INVALID_AMOUNT", "Refund amount is invalid"),
    PAYMENT_REFUND_NOT_ALLOWED("PAYMENT_REFUND_NOT_ALLOWED", "Payment refund is not allowed in current payment state"),
    PAYMENT_REFUND_IDEMPOTENCY_KEY_REQUIRED("PAYMENT_REFUND_IDEMPOTENCY_KEY_REQUIRED", "Refund idempotency key is required"),
    PAYMENT_REFUND_ACCOUNT_INFO_REQUIRED("PAYMENT_REFUND_ACCOUNT_INFO_REQUIRED", "Refund account information is required"),
    PAYMENT_REFUND_METHOD_NOT_SUPPORTED("PAYMENT_REFUND_METHOD_NOT_SUPPORTED", "Only VNPAY refunds are supported"),
    PAYMENT_REFUND_EXECUTION_FAILED("PAYMENT_REFUND_EXECUTION_FAILED", "Refund execution failed");

    private final String code;
    private final String defaultMessage;

    MessageCode(String code, String defaultMessage) {
        this.code = code;
        this.defaultMessage = defaultMessage;
    }
}
