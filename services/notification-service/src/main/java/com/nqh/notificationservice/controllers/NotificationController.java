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
import com.nqh.notificationservice.services.NotificationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
@Validated
public class NotificationController {

    private final NotificationService notificationService;
    private final ApiResponseFactory apiResponseFactory;

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
            @RequestParam(required = false) String orderCode,
            @RequestParam(required = false) NotificationStatusEnum status,
            @RequestParam(required = false) NotificationChannelEnum channel,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime createdFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime createdTo,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(200) int size,
            HttpServletRequest httpServletRequest
    ) {
        NotificationListResponse response = notificationService.getNotifications(
                orderCode,
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
}
