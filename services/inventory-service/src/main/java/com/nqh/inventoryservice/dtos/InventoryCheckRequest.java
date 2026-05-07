package com.nqh.inventoryservice.dtos;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class InventoryCheckRequest {

    @NotEmpty
    private List<@Valid InventoryCheckItemRequest> items;
}
