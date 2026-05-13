package com.nqh.orderservice.dtos;

import com.nqh.orderservice.enums.OrderStatusEnum;
import java.math.BigDecimal;
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
public class CreateOrderResponse {
    private UUID orderId;
    private UUID uuid;
    private String orderCode;
    private OrderStatusEnum status;
    private BigDecimal totalAmount;
    private String currency;
    private String idempotencyKey;
    private String paymentUrl;
    private LocalDateTime paymentDeadlineAt;
    private boolean replayed;
    private LocalDateTime createdAt;
    private List<CreateOrderItemResponse> items;
}
