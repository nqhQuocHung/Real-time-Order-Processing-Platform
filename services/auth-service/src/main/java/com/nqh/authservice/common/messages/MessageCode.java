package com.nqh.authservice.common.messages;

public enum MessageCode {
    COMMON_SUCCESS("common.success"),
    COMMON_BAD_REQUEST("common.bad_request"),
    COMMON_VALIDATION_ERROR("common.validation_error"),
    COMMON_INTERNAL_ERROR("common.internal_error"),
    COMMON_RESOURCE_NOT_FOUND("common.resource_not_found"),

    AUTH_INVALID_CREDENTIALS("auth.invalid_credentials"),
    AUTH_INVALID_TOKEN("auth.invalid_token"),
    AUTH_TOKEN_REQUIRED("auth.token_required"),
    AUTH_REFRESH_TOKEN_REQUIRED("auth.refresh_token_required"),
    AUTH_REFRESH_TOKEN_EXPIRED("auth.refresh_token_expired"),
    AUTH_REFRESH_TOKEN_NOT_FOUND("auth.refresh_token_not_found"),
    AUTH_OLD_PASSWORD_INCORRECT("auth.old_password_incorrect"),
    AUTH_OTP_REQUIRED("auth.otp_required"),
    AUTH_OTP_INVALID("auth.otp_invalid"),
    AUTH_OTP_EXPIRED("auth.otp_expired"),
    AUTH_OTP_USED("auth.otp_used"),
    AUTH_OTP_LOCKED("auth.otp_locked"),
    AUTH_NEW_PASSWORD_SAME_AS_OLD("auth.new_password_same_as_old"),
    AUTH_CHANGE_PASSWORD_SUCCESS("auth.change_password_success"),
    AUTH_CHANGE_PASSWORD_OTP_SENT("auth.change_password_otp_sent"),
    AUTH_UNAUTHORIZED("auth.unauthorized"),
    AUTH_FORBIDDEN("auth.forbidden"),
    AUTH_USER_NOT_FOUND("auth.user_not_found"),
    AUTH_USER_LOCKED("auth.user_locked"),
    AUTH_USER_INACTIVE("auth.user_inactive"),
    AUTH_USERNAME_ALREADY_EXISTS("auth.username_already_exists"),
    AUTH_EMAIL_ALREADY_EXISTS("auth.email_already_exists"),
    AUTH_PHONE_ALREADY_EXISTS("auth.phone_already_exists"),
    AUTH_AVATAR_INVALID_TYPE("auth.avatar_invalid_type"),
    AUTH_AVATAR_TOO_LARGE("auth.avatar_too_large"),
    AUTH_AVATAR_UPLOAD_FAILED("auth.avatar_upload_failed"),
    AUTH_MAIL_SEND_FAILED("auth.mail_send_failed");

    private final String key;

    MessageCode(String key) {
        this.key = key;
    }

    public String key() {
        return key;
    }
}
