package com.nqh.notificationservice.dtos;

import com.nqh.notificationservice.enums.NotificationChannelEnum;
import com.nqh.notificationservice.enums.NotificationStatusEnum;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NotificationLogResponse {
    private UUID notificationId;
    private UUID notificationUuid;
    private String notificationCode;
    private String orderCode;
    private String eventType;
    private NotificationChannelEnum channel;
    private String recipient;
    private String title;
    private String content;
    private NotificationStatusEnum status;
    private String provider;
    private String providerMessageId;
    private String actor;
    private String note;
    private String errorMessage;
    private LocalDateTime sentAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
