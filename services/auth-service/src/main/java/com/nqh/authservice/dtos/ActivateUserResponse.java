package com.nqh.authservice.dtos;

import com.nqh.authservice.enums.UserStatusEnum;
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
public class ActivateUserResponse {
    private UUID userId;
    private Boolean isActive;
    private UserStatusEnum status;
}

