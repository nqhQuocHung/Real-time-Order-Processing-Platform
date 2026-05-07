package com.nqh.orderservice.controllers;

import com.nqh.orderservice.common.messages.MessageCode;
import com.nqh.orderservice.common.response.ApiResponseFactory;
import com.nqh.orderservice.common.response.BaseResponse;
import com.nqh.orderservice.dtos.CreateOrderRequest;
import com.nqh.orderservice.dtos.CreateOrderResponse;
import com.nqh.orderservice.dtos.OrderActionRequest;
import com.nqh.orderservice.dtos.OrderDetailResponse;
import com.nqh.orderservice.dtos.OrderListResponse;
import com.nqh.orderservice.dtos.OrderStatusHistoryResponse;
import com.nqh.orderservice.dtos.UpdateOrderStatusRequest;
import com.nqh.orderservice.enums.OrderStatusEnum;
import com.nqh.orderservice.services.OrderService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
@Validated
public class OrderController {

    private final OrderService orderService;
    private final ApiResponseFactory apiResponseFactory;

    @PostMapping
    public ResponseEntity<BaseResponse<CreateOrderResponse>> createOrder(
            @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody CreateOrderRequest request,
            HttpServletRequest httpServletRequest
    ) {
        CreateOrderResponse response = orderService.createOrder(request, idempotencyKey);
        return apiResponseFactory.success(HttpStatus.CREATED, MessageCode.ORDER_CREATE_SUCCESS, response, httpServletRequest);
    }

    @GetMapping("/{orderCode}")
    public ResponseEntity<BaseResponse<OrderDetailResponse>> getOrderByCode(
            @PathVariable String orderCode,
            HttpServletRequest httpServletRequest
    ) {
        OrderDetailResponse response = orderService.getOrderByCode(orderCode);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.ORDER_GET_SUCCESS, response, httpServletRequest);
    }

    @GetMapping
    public ResponseEntity<BaseResponse<OrderListResponse>> getOrders(
            @RequestParam(required = false) UUID customerId,
            @RequestParam(required = false) OrderStatusEnum status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime createdFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime createdTo,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(200) int size,
            HttpServletRequest httpServletRequest
    ) {
        OrderListResponse response = orderService.getOrders(customerId, status, createdFrom, createdTo, page, size);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.ORDER_LIST_SUCCESS, response, httpServletRequest);
    }

    @PostMapping("/{orderCode}/cancel")
    public ResponseEntity<BaseResponse<OrderDetailResponse>> cancelOrder(
            @PathVariable String orderCode,
            @RequestBody(required = false) @Valid OrderActionRequest request,
            HttpServletRequest httpServletRequest
    ) {
        OrderDetailResponse response = orderService.cancelOrder(orderCode, request);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.ORDER_CANCEL_SUCCESS, response, httpServletRequest);
    }

    @PatchMapping("/{orderCode}/status")
    public ResponseEntity<BaseResponse<OrderDetailResponse>> updateOrderStatus(
            @PathVariable String orderCode,
            @RequestBody @Valid UpdateOrderStatusRequest request,
            HttpServletRequest httpServletRequest
    ) {
        OrderDetailResponse response = orderService.updateOrderStatus(orderCode, request);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.ORDER_STATUS_UPDATE_SUCCESS, response, httpServletRequest);
    }

    @PostMapping("/{orderCode}/payment-confirm")
    public ResponseEntity<BaseResponse<OrderDetailResponse>> confirmPayment(
            @PathVariable String orderCode,
            @RequestBody(required = false) @Valid OrderActionRequest request,
            HttpServletRequest httpServletRequest
    ) {
        OrderDetailResponse response = orderService.confirmPayment(orderCode, request);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.ORDER_PAYMENT_CONFIRM_SUCCESS, response, httpServletRequest);
    }

    @PostMapping("/{orderCode}/payment-fail")
    public ResponseEntity<BaseResponse<OrderDetailResponse>> failPayment(
            @PathVariable String orderCode,
            @RequestBody(required = false) @Valid OrderActionRequest request,
            HttpServletRequest httpServletRequest
    ) {
        OrderDetailResponse response = orderService.failPayment(orderCode, request);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.ORDER_PAYMENT_FAIL_SUCCESS, response, httpServletRequest);
    }

    @PostMapping("/{orderCode}/shipping-confirm")
    public ResponseEntity<BaseResponse<OrderDetailResponse>> confirmShipping(
            @PathVariable String orderCode,
            @RequestBody(required = false) @Valid OrderActionRequest request,
            HttpServletRequest httpServletRequest
    ) {
        OrderDetailResponse response = orderService.confirmShipping(orderCode, request);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.ORDER_SHIPPING_CONFIRM_SUCCESS, response, httpServletRequest);
    }

    @GetMapping("/{orderCode}/timeline")
    public ResponseEntity<BaseResponse<List<OrderStatusHistoryResponse>>> getOrderTimeline(
            @PathVariable String orderCode,
            HttpServletRequest httpServletRequest
    ) {
        List<OrderStatusHistoryResponse> response = orderService.getOrderTimeline(orderCode);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.ORDER_TIMELINE_SUCCESS, response, httpServletRequest);
    }
}
