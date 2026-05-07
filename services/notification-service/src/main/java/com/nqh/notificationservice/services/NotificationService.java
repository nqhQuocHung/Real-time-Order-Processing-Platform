package com.nqh.notificationservice.services;

import com.nqh.notificationservice.dtos.CreateNotificationRequest;
import com.nqh.notificationservice.dtos.NotificationListResponse;
import com.nqh.notificationservice.dtos.NotificationLogResponse;
import com.nqh.notificationservice.dtos.UpdateNotificationStatusRequest;
import com.nqh.notificationservice.enums.NotificationChannelEnum;
import com.nqh.notificationservice.enums.NotificationStatusEnum;
import java.time.LocalDateTime;

public interface NotificationService {

    NotificationLogResponse createNotification(CreateNotificationRequest request);

    NotificationLogResponse getNotificationByCode(String notificationCode);

    NotificationListResponse getNotifications(
            String orderCode,
            NotificationStatusEnum status,
            NotificationChannelEnum channel,
            LocalDateTime createdFrom,
            LocalDateTime createdTo,
            int page,
            int size
    );

    NotificationLogResponse updateNotificationStatus(String notificationCode, UpdateNotificationStatusRequest request);

    NotificationLogResponse logNotificationFromEvent(String topic, String eventType, String rawMessage);
}
