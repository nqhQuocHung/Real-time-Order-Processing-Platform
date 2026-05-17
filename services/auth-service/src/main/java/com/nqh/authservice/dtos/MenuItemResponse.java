package com.nqh.authservice.dtos;

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
public class MenuItemResponse {
    private UUID id;
    private String key;
    private String label;
    private String path;
    private Integer displayOrder;
    private String permission;
    private UUID parentMenuId;
    private String parentMenuKey;
    private Boolean isContainer;
    private Boolean showOnMenu;
}
