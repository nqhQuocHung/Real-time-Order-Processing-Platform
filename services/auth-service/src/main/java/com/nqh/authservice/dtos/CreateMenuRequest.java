package com.nqh.authservice.dtos;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateMenuRequest {

    private String menuKey;

    @NotBlank
    private String label;

    private String path;

    @Min(0)
    private Integer displayOrder;

    private String permissionCode;

    private UUID parentMenuId;

    private Boolean showOnMenu;
}
