package com.nqh.notificationservice.dtos;

import com.nqh.notificationservice.enums.NotificationChannelEnum;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateNotificationRequest {

    @NotBlank
    @Size(max = 64)
    private String orderCode;

    @NotBlank
    @Size(max = 120)
    private String eventType;

    @NotNull
    private NotificationChannelEnum channel;

    @NotBlank
    @Size(max = 255)
    private String recipient;

    @Size(max = 255)
    private String title;

    @NotBlank
    @Size(max = 2000)
    private String content;

    @Size(max = 120)
    private String provider;

    @Size(max = 120)
    private String actor;

    @Size(max = 255)
    private String note;
}
