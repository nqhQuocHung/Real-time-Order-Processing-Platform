package com.nqh.inventoryservice.dtos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class InventoryReservationActionRequest {

    @NotBlank
    @Size(max = 64)
    private String orderCode;

    @Size(max = 120)
    private String actor;

    @Size(max = 255)
    private String note;
}
