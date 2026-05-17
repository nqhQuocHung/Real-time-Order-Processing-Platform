package com.nqh.authservice.dtos;

import com.nqh.authservice.enums.UserStatusEnum;
import java.time.LocalDateTime;
import java.util.List;
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
public class AdminUserSummaryResponse {
    private UUID userId;
    private String username;
    private String email;
    private String phone;
    private UserStatusEnum status;
    private Boolean isActive;
    private Boolean emailVerified;
    private List<String> roles;
    private LocalDateTime createdAt;
}
