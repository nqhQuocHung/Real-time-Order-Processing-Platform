package com.nqh.authservice.dtos;

import com.nqh.authservice.enums.GenderEnum;
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
public class UserProfileResponse {
    private UUID userId;
    private UUID uuid;
    private String username;
    private String email;
    private String phone;
    private String firstName;
    private String lastName;
    private String avatar;
    private UserStatusEnum status;
    private Boolean emailVerified;
    private Integer failedLoginCount;
    private LocalDateTime lastLoginAt;
    private GenderEnum gender;
    private Boolean isActive;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<String> roles;
    private List<String> permissions;
    private List<MenuItemResponse> menus;
}
