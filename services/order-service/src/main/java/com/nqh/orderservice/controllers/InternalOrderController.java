package com.nqh.orderservice.controllers;

import com.nqh.orderservice.common.exception.AppException;
import com.nqh.orderservice.common.messages.MessageCode;
import com.nqh.orderservice.common.response.ApiResponseFactory;
import com.nqh.orderservice.common.response.BaseResponse;
import com.nqh.orderservice.dtos.InternalOrderProductsResponse;
import com.nqh.orderservice.dtos.OrderDetailResponse;
import com.nqh.orderservice.services.OrderService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/v1/orders")
@RequiredArgsConstructor
@Validated
public class InternalOrderController {

    private static final String INTERNAL_TOKEN_HEADER = "X-Internal-Token";

    private final OrderService orderService;
    private final ApiResponseFactory apiResponseFactory;

    @Value("${app.internal.token:change-me}")
    private String expectedInternalToken;

    @GetMapping("/{orderCode}/products")
    public ResponseEntity<BaseResponse<InternalOrderProductsResponse>> getOrderProducts(
            @RequestHeader(name = INTERNAL_TOKEN_HEADER, required = false) String internalToken,
            @PathVariable String orderCode,
            HttpServletRequest httpServletRequest
    ) {
        validateInternalToken(internalToken);

        OrderDetailResponse order = orderService.getOrderByCode(orderCode);
        List<UUID> productIds = order.getItems() == null
                ? List.of()
                : order.getItems().stream()
                .map(item -> item.getProductId())
                .filter(productId -> productId != null)
                .distinct()
                .toList();

        InternalOrderProductsResponse response = InternalOrderProductsResponse.builder()
                .orderCode(order.getOrderCode())
                .customerId(order.getCustomerId())
                .productIds(productIds)
                .build();
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.COMMON_SUCCESS, response, httpServletRequest);
    }

    private void validateInternalToken(String token) {
        if (!StringUtils.hasText(token) || !token.trim().equals(expectedInternalToken)) {
            throw new AppException(HttpStatus.UNAUTHORIZED, MessageCode.COMMON_UNAUTHORIZED);
        }
    }
}

