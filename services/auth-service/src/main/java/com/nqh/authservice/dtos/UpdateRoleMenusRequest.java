package com.nqh.authservice.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateRoleMenusRequest {

    @NotNull
    private List<@NotBlank String> menuKeys;
}
