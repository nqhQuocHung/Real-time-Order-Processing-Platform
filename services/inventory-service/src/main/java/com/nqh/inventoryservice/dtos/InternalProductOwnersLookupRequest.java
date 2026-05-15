package com.nqh.inventoryservice.dtos;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class InternalProductOwnersLookupRequest {

    @NotEmpty
    private List<UUID> productIds;
}

