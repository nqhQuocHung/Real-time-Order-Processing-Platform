package com.nqh.orderservice.dtos;

import com.nqh.orderservice.enums.OrderStatusEnum;
import java.time.LocalDateTime;
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
public class OrderStatusHistoryResponse {
    private UUID historyId;
    private OrderStatusEnum fromStatus;
    private OrderStatusEnum toStatus;
    private String action;
    private String changedBy;
    private String note;
    private LocalDateTime changedAt;
}
