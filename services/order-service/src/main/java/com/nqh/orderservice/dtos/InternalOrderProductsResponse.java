package com.nqh.orderservice.dtos;

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
public class InternalOrderProductsResponse {
    private String orderCode;
    private UUID customerId;
    private List<UUID> productIds;
}

