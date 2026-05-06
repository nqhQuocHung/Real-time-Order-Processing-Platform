package com.nqh.authservice.common.messages;

public enum MessageCode {
    COMMON_SUCCESS("common.success"),
    COMMON_BAD_REQUEST("common.bad_request"),
    COMMON_VALIDATION_ERROR("common.validation_error"),
    COMMON_INTERNAL_ERROR("common.internal_error"),
    COMMON_RESOURCE_NOT_FOUND("common.resource_not_found"),

    AUTH_INVALID_CREDENTIALS("auth.invalid_credentials"),
    AUTH_UNAUTHORIZED("auth.unauthorized"),
    AUTH_FORBIDDEN("auth.forbidden"),
    AUTH_USER_NOT_FOUND("auth.user_not_found"),
    AUTH_USER_LOCKED("auth.user_locked");

    private final String key;

    MessageCode(String key) {
        this.key = key;
    }

    public String key() {
        return key;
    }
}
