package com.nqh.authservice.dtos;

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
public class GrantPermissionResponse {
    private UUID userId;
    private List<String> roles;
    private String message;
}
