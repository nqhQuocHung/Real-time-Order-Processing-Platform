package com.nqh.orderservice.services;

import com.nqh.orderservice.dtos.OrderActionRequest;
import com.nqh.orderservice.dtos.OrderDetailResponse;
import com.nqh.orderservice.dtos.OrderRefundDecisionRequest;
import com.nqh.orderservice.dtos.OrderRefundListResponse;
import com.nqh.orderservice.dtos.OrderRefundResponse;
import com.nqh.orderservice.dtos.OrderListResponse;
import com.nqh.orderservice.dtos.OrderStatusHistoryResponse;
import com.nqh.orderservice.dtos.UpdateOrderStatusRequest;
import com.nqh.orderservice.dtos.CreateOrderRequest;
import com.nqh.orderservice.dtos.CreateOrderResponse;
import com.nqh.orderservice.dtos.CreateOrderRefundRequest;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import com.nqh.orderservice.enums.OrderStatusEnum;
import com.nqh.orderservice.enums.OrderRefundStatusEnum;

public interface OrderService {

    CreateOrderResponse createOrder(CreateOrderRequest request, String idempotencyKey);

    OrderDetailResponse getOrderByCode(String orderCode);

    OrderListResponse getOrders(
            UUID customerId,
            OrderStatusEnum status,
            LocalDateTime createdFrom,
            LocalDateTime createdTo,
            int page,
            int size
    );

    OrderDetailResponse cancelOrder(String orderCode, OrderActionRequest request);

    OrderDetailResponse updateOrderStatus(String orderCode, UpdateOrderStatusRequest request);

    OrderDetailResponse confirmPayment(String orderCode, OrderActionRequest request);

    OrderDetailResponse failPayment(String orderCode, OrderActionRequest request);

    OrderDetailResponse confirmShipping(String orderCode, OrderActionRequest request);

    List<OrderStatusHistoryResponse> getOrderTimeline(String orderCode);

    OrderRefundResponse requestOrderRefund(
            String orderCode,
            CreateOrderRefundRequest request,
            UUID requesterUserId,
            boolean elevatedAuthority
    );

    OrderRefundResponse getOrderRefundByOrderCode(
            String orderCode,
            UUID requesterUserId,
            boolean elevatedAuthority
    );

    OrderRefundListResponse getOrderRefunds(
            OrderRefundStatusEnum status,
            int page,
            int size,
            UUID requesterUserId,
            boolean elevatedAuthority
    );

    OrderRefundResponse decideOrderRefund(
            String orderCode,
            OrderRefundDecisionRequest request,
            UUID approverUserId,
            boolean elevatedAuthority
    );
}
