package com.nqh.notificationservice.common.messages;

import lombok.Getter;

@Getter
public enum MessageCode {
    COMMON_SUCCESS("COMMON_SUCCESS", "Success"),
    COMMON_BAD_REQUEST("COMMON_BAD_REQUEST", "Bad request"),
    COMMON_VALIDATION_ERROR("COMMON_VALIDATION_ERROR", "Validation failed"),
    COMMON_INTERNAL_ERROR("COMMON_INTERNAL_ERROR", "Internal server error"),

    NOTI_CREATE_SUCCESS("NOTI_CREATE_SUCCESS", "Notification created successfully"),
    NOTI_GET_SUCCESS("NOTI_GET_SUCCESS", "Notification retrieved successfully"),
    NOTI_LIST_SUCCESS("NOTI_LIST_SUCCESS", "Notifications retrieved successfully"),
    NOTI_STATUS_UPDATE_SUCCESS("NOTI_STATUS_UPDATE_SUCCESS", "Notification status updated successfully"),
    NOTI_EVENT_LOG_SUCCESS("NOTI_EVENT_LOG_SUCCESS", "Notification event logged successfully"),

    NOTI_NOT_FOUND("NOTI_NOT_FOUND", "Notification not found"),
    NOTI_DATE_RANGE_INVALID("NOTI_DATE_RANGE_INVALID", "createdFrom must be before or equal to createdTo"),
    NOTI_NOTIFICATION_CODE_REQUIRED("NOTI_NOTIFICATION_CODE_REQUIRED", "Notification code is required"),
    NOTI_ORDER_CODE_REQUIRED("NOTI_ORDER_CODE_REQUIRED", "Order code is required"),
    NOTI_EVENT_TYPE_REQUIRED("NOTI_EVENT_TYPE_REQUIRED", "Event type is required"),
    NOTI_RECIPIENT_REQUIRED("NOTI_RECIPIENT_REQUIRED", "Recipient is required"),
    NOTI_CONTENT_REQUIRED("NOTI_CONTENT_REQUIRED", "Content is required"),
    NOTI_STATUS_TRANSITION_INVALID("NOTI_STATUS_TRANSITION_INVALID", "Notification status transition is not allowed");

    private final String code;
    private final String defaultMessage;

    MessageCode(String code, String defaultMessage) {
        this.code = code;
        this.defaultMessage = defaultMessage;
    }
}
