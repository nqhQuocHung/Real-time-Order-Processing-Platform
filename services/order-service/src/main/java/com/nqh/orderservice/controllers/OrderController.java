package com.nqh.orderservice.controllers;

import com.nqh.orderservice.common.messages.MessageCode;
import com.nqh.orderservice.common.response.ApiResponseFactory;
import com.nqh.orderservice.common.response.BaseResponse;
import com.nqh.orderservice.dtos.CreateOrderRequest;
import com.nqh.orderservice.dtos.CreateOrderResponse;
import com.nqh.orderservice.dtos.CreateOrderRefundRequest;
import com.nqh.orderservice.dtos.OrderActionRequest;
import com.nqh.orderservice.dtos.OrderDetailResponse;
import com.nqh.orderservice.dtos.OrderListResponse;
import com.nqh.orderservice.dtos.OrderRefundDecisionRequest;
import com.nqh.orderservice.dtos.OrderRefundListResponse;
import com.nqh.orderservice.dtos.OrderRefundResponse;
import com.nqh.orderservice.dtos.OrderStatusHistoryResponse;
import com.nqh.orderservice.dtos.UpdateOrderStatusRequest;
import com.nqh.orderservice.enums.OrderRefundStatusEnum;
import com.nqh.orderservice.enums.OrderStatusEnum;
import com.nqh.orderservice.services.OrderService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.util.StringUtils;
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

    private static final Set<String> ELEVATED_ORDER_AUTHORITIES = Set.of(
            "PERM_MANAGE_ALL_ORDERS"
    );

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

    @PostMapping("/{orderCode}/refunds")
    public ResponseEntity<BaseResponse<OrderRefundResponse>> requestRefund(
            @PathVariable String orderCode,
            @RequestBody @Valid CreateOrderRefundRequest request,
            @AuthenticationPrincipal Jwt jwt,
            Authentication authentication,
            HttpServletRequest httpServletRequest
    ) {
        OrderRefundResponse response = orderService.requestOrderRefund(
                orderCode,
                request,
                extractUserId(jwt),
                hasElevatedOrderAuthority(authentication)
        );
        return apiResponseFactory.success(HttpStatus.CREATED, MessageCode.ORDER_REFUND_REQUEST_SUCCESS, response, httpServletRequest);
    }

    @GetMapping("/{orderCode}/refunds")
    public ResponseEntity<BaseResponse<OrderRefundResponse>> getRefundByOrderCode(
            @PathVariable String orderCode,
            @AuthenticationPrincipal Jwt jwt,
            Authentication authentication,
            HttpServletRequest httpServletRequest
    ) {
        OrderRefundResponse response = orderService.getOrderRefundByOrderCode(
                orderCode,
                extractUserId(jwt),
                hasElevatedOrderAuthority(authentication)
        );
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.ORDER_REFUND_GET_SUCCESS, response, httpServletRequest);
    }

    @GetMapping("/refunds")
    public ResponseEntity<BaseResponse<OrderRefundListResponse>> getRefunds(
            @RequestParam(required = false) OrderRefundStatusEnum status,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(200) int size,
            @AuthenticationPrincipal Jwt jwt,
            Authentication authentication,
            HttpServletRequest httpServletRequest
    ) {
        OrderRefundListResponse response = orderService.getOrderRefunds(
                status,
                page,
                size,
                extractUserId(jwt),
                hasElevatedOrderAuthority(authentication)
        );
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.ORDER_REFUND_LIST_SUCCESS, response, httpServletRequest);
    }

    @PostMapping("/{orderCode}/refunds/decision")
    public ResponseEntity<BaseResponse<OrderRefundResponse>> decideRefund(
            @PathVariable String orderCode,
            @RequestBody @Valid OrderRefundDecisionRequest request,
            @AuthenticationPrincipal Jwt jwt,
            Authentication authentication,
            HttpServletRequest httpServletRequest
    ) {
        OrderRefundResponse response = orderService.decideOrderRefund(
                orderCode,
                request,
                extractUserId(jwt),
                hasElevatedOrderAuthority(authentication)
        );
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.ORDER_REFUND_DECISION_SUCCESS, response, httpServletRequest);
    }

    private boolean hasElevatedOrderAuthority(Authentication authentication) {
        if (authentication == null) {
            return false;
        }
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(ELEVATED_ORDER_AUTHORITIES::contains);
    }

    private UUID extractUserId(Jwt jwt) {
        if (jwt == null || !StringUtils.hasText(jwt.getSubject())) {
            return null;
        }
        try {
            return UUID.fromString(jwt.getSubject().trim());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
