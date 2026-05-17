package com.nqh.notificationservice.dtos;

import com.nqh.notificationservice.enums.NotificationStatusEnum;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateNotificationStatusRequest {

    @NotNull
    private NotificationStatusEnum status;

    @Size(max = 120)
    private String providerMessageId;

    @Size(max = 120)
    private String actor;

    @Size(max = 255)
    private String note;

    @Size(max = 500)
    private String errorMessage;
}
