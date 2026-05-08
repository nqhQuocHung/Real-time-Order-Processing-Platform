package com.nqh.authservice.dtos;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateRoleRequest {

    @NotBlank
    private String code;

    private String name;
}
