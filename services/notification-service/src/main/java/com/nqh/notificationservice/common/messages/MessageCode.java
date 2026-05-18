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

    MSG_CONVERSATION_OPEN_SUCCESS("MSG_CONVERSATION_OPEN_SUCCESS", "Conversation opened successfully"),
    MSG_CONVERSATION_LIST_SUCCESS("MSG_CONVERSATION_LIST_SUCCESS", "Conversations retrieved successfully"),
    MSG_MESSAGE_LIST_SUCCESS("MSG_MESSAGE_LIST_SUCCESS", "Messages retrieved successfully"),
    MSG_MESSAGE_SEND_SUCCESS("MSG_MESSAGE_SEND_SUCCESS", "Message sent successfully"),
    MSG_MARK_READ_SUCCESS("MSG_MARK_READ_SUCCESS", "Conversation marked as read"),

    NOTI_NOT_FOUND("NOTI_NOT_FOUND", "Notification not found"),
    NOTI_DATE_RANGE_INVALID("NOTI_DATE_RANGE_INVALID", "createdFrom must be before or equal to createdTo"),
    NOTI_NOTIFICATION_CODE_REQUIRED("NOTI_NOTIFICATION_CODE_REQUIRED", "Notification code is required"),
    NOTI_ORDER_CODE_REQUIRED("NOTI_ORDER_CODE_REQUIRED", "Order code is required"),
    NOTI_EVENT_TYPE_REQUIRED("NOTI_EVENT_TYPE_REQUIRED", "Event type is required"),
    NOTI_RECIPIENT_REQUIRED("NOTI_RECIPIENT_REQUIRED", "Recipient is required"),
    NOTI_CONTENT_REQUIRED("NOTI_CONTENT_REQUIRED", "Content is required"),
    NOTI_STATUS_TRANSITION_INVALID("NOTI_STATUS_TRANSITION_INVALID", "Notification status transition is not allowed"),

    MSG_CONVERSATION_NOT_FOUND("MSG_CONVERSATION_NOT_FOUND", "Conversation not found"),
    MSG_CONVERSATION_FORBIDDEN("MSG_CONVERSATION_FORBIDDEN", "You are not allowed to access this conversation"),
    MSG_SELF_CONVERSATION_NOT_ALLOWED("MSG_SELF_CONVERSATION_NOT_ALLOWED", "Cannot open conversation with yourself"),
    MSG_ADMIN_NOT_SUPPORTED("MSG_ADMIN_NOT_SUPPORTED", "Admin message conversation is not supported");

    private final String code;
    private final String defaultMessage;

    MessageCode(String code, String defaultMessage) {
        this.code = code;
        this.defaultMessage = defaultMessage;
    }
}
