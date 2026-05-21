package com.nqh.notificationservice.controllers;

import com.nqh.notificationservice.common.messages.MessageCode;
import com.nqh.notificationservice.common.response.ApiResponseFactory;
import com.nqh.notificationservice.common.response.BaseResponse;
import com.nqh.notificationservice.dtos.CreateNotificationRequest;
import com.nqh.notificationservice.dtos.NotificationListResponse;
import com.nqh.notificationservice.dtos.NotificationLogResponse;
import com.nqh.notificationservice.dtos.UpdateNotificationStatusRequest;
import com.nqh.notificationservice.enums.NotificationChannelEnum;
import com.nqh.notificationservice.enums.NotificationStatusEnum;
import com.nqh.notificationservice.services.AdminSseService;
import com.nqh.notificationservice.services.NotificationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.time.LocalDateTime;
import java.util.Collection;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
@Validated
public class NotificationController {

    private final NotificationService notificationService;
    private final ApiResponseFactory apiResponseFactory;
    private final AdminSseService adminSseService;

    @PostMapping
    public ResponseEntity<BaseResponse<NotificationLogResponse>> createNotification(
            @RequestBody @Valid CreateNotificationRequest request,
            HttpServletRequest httpServletRequest
    ) {
        NotificationLogResponse response = notificationService.createNotification(request);
        return apiResponseFactory.success(HttpStatus.CREATED, MessageCode.NOTI_CREATE_SUCCESS, response, httpServletRequest);
    }

    @GetMapping("/{notificationCode}")
    public ResponseEntity<BaseResponse<NotificationLogResponse>> getNotificationByCode(
            @PathVariable String notificationCode,
            HttpServletRequest httpServletRequest
    ) {
        NotificationLogResponse response = notificationService.getNotificationByCode(notificationCode);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.NOTI_GET_SUCCESS, response, httpServletRequest);
    }

    @GetMapping
    public ResponseEntity<BaseResponse<NotificationListResponse>> getNotifications(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) String orderCode,
            @RequestParam(required = false) String recipient,
            @RequestParam(required = false) NotificationStatusEnum status,
            @RequestParam(required = false) NotificationChannelEnum channel,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime createdFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime createdTo,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(200) int size,
            HttpServletRequest httpServletRequest
    ) {
        String resolvedRecipient = resolveRecipientForList(recipient, jwt);
        NotificationListResponse response = notificationService.getNotifications(
                orderCode,
                resolvedRecipient,
                status,
                channel,
                createdFrom,
                createdTo,
                page,
                size
        );
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.NOTI_LIST_SUCCESS, response, httpServletRequest);
    }

    @PatchMapping("/{notificationCode}/status")
    public ResponseEntity<BaseResponse<NotificationLogResponse>> updateNotificationStatus(
            @PathVariable String notificationCode,
            @RequestBody @Valid UpdateNotificationStatusRequest request,
            HttpServletRequest httpServletRequest
    ) {
        NotificationLogResponse response = notificationService.updateNotificationStatus(notificationCode, request);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.NOTI_STATUS_UPDATE_SUCCESS, response, httpServletRequest);
    }

    @GetMapping(
            value = "/stream",
            produces = MediaType.TEXT_EVENT_STREAM_VALUE
    )
    public SseEmitter streamNotifications(
            @RequestHeader(name = "X-User-Id", required = false) String forwardedUserId,
            @RequestHeader(name = "X-User-Role", required = false) String forwardedUserRole,
            @AuthenticationPrincipal Jwt jwt
    ) {
        String userId = jwt != null ? normalize(jwt.getSubject()) : null;
        if (userId == null) {
            userId = normalize(forwardedUserId);
        }
        if (userId == null) {
            throw new IllegalStateException("Cannot resolve userId for notification stream.");
        }

        boolean isAdmin = isAdminUser(forwardedUserRole, jwt);
        return adminSseService.subscribe(userId, isAdmin);
    }

    private boolean isAdminUser(String forwardedUserRole, Jwt jwt) {
        String normalizedForwardedRole = normalize(forwardedUserRole);
        if (normalizedForwardedRole != null) {
            if ("ADMIN".equalsIgnoreCase(normalizedForwardedRole)
                    || "ROLE_ADMIN".equalsIgnoreCase(normalizedForwardedRole)) {
                return true;
            }
        }

        if (jwt == null) {
            return false;
        }

        if (containsIgnoreCase(jwt.getClaimAsStringList("roles"), "ADMIN")) {
            return true;
        }

        return containsIgnoreCase(jwt.getClaimAsStringList("permissions"), "MANAGE_PARTNERS");
    }

    private boolean containsIgnoreCase(Collection<String> values, String expected) {
        if (values == null || values.isEmpty()) {
            return false;
        }
        return values.stream().anyMatch(value -> expected.equalsIgnoreCase(value));
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private String resolveRecipientForList(String requestedRecipient, Jwt jwt) {
        String normalizedRequestedRecipient = normalize(requestedRecipient);
        if (isAdminUser(null, jwt)) {
            return normalizedRequestedRecipient;
        }

        String currentUserId = jwt != null ? normalize(jwt.getSubject()) : null;
        if (currentUserId == null) {
            return normalizedRequestedRecipient;
        }

        if (normalizedRequestedRecipient == null || normalizedRequestedRecipient.equals(currentUserId)) {
            return currentUserId;
        }

        return currentUserId;
    }
}
