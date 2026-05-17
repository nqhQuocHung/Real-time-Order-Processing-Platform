package com.nqh.inventoryservice.dtos;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class InventoryReserveRequest {

    @NotBlank
    @Size(max = 64)
    private String orderCode;

    @NotEmpty
    private List<@Valid InventoryCheckItemRequest> items;

    @Size(max = 120)
    private String actor;

    @Size(max = 255)
    private String note;
}
