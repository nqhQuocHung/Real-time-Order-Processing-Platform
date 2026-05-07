package com.nqh.inventoryservice.dtos;

import com.nqh.inventoryservice.enums.InventoryReservationStatusEnum;
import java.time.LocalDateTime;
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
public class InventoryReservationResponse {
    private UUID reservationId;
    private UUID reservationUuid;
    private String orderCode;
    private InventoryReservationStatusEnum status;
    private boolean replayed;
    private String actor;
    private String note;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<InventoryReservationItemResponse> items;
}
