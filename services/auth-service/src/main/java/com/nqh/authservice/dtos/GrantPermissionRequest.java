package com.nqh.authservice.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class GrantPermissionRequest {

    @NotNull
    private UUID userId;

    @NotBlank
    private String roleCode;
}
