package com.nqh.inventoryservice.controllers;

import com.nqh.inventoryservice.common.exception.AppException;
import com.nqh.inventoryservice.common.messages.MessageCode;
import com.nqh.inventoryservice.common.response.ApiResponseFactory;
import com.nqh.inventoryservice.common.response.BaseResponse;
import com.nqh.inventoryservice.dtos.InventoryReservationActionRequest;
import com.nqh.inventoryservice.dtos.InventoryReservationResponse;
import com.nqh.inventoryservice.dtos.InventoryReserveRequest;
import com.nqh.inventoryservice.services.InventoryService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/v1/inventories")
@RequiredArgsConstructor
@Validated
public class InternalInventoryController {

    private static final String INTERNAL_TOKEN_HEADER = "X-Internal-Token";

    private final InventoryService inventoryService;
    private final ApiResponseFactory apiResponseFactory;

    @Value("${app.internal.token:change-me}")
    private String expectedInternalToken;

    @PostMapping("/reserve")
    public ResponseEntity<BaseResponse<InventoryReservationResponse>> reserveStock(
            @RequestHeader(name = INTERNAL_TOKEN_HEADER, required = false) String internalToken,
            @RequestBody @Valid InventoryReserveRequest request,
            HttpServletRequest httpServletRequest
    ) {
        validateInternalToken(internalToken);
        InventoryReservationResponse response = inventoryService.reserveStock(request);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.INVENTORY_STOCK_RESERVE_SUCCESS, response, httpServletRequest);
    }

    @PostMapping("/release")
    public ResponseEntity<BaseResponse<InventoryReservationResponse>> releaseReservation(
            @RequestHeader(name = INTERNAL_TOKEN_HEADER, required = false) String internalToken,
            @RequestBody @Valid InventoryReservationActionRequest request,
            HttpServletRequest httpServletRequest
    ) {
        validateInternalToken(internalToken);
        InventoryReservationResponse response = inventoryService.releaseReservation(request);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.INVENTORY_STOCK_RELEASE_SUCCESS, response, httpServletRequest);
    }

    @PostMapping("/confirm-deduct")
    public ResponseEntity<BaseResponse<InventoryReservationResponse>> confirmDeduct(
            @RequestHeader(name = INTERNAL_TOKEN_HEADER, required = false) String internalToken,
            @RequestBody @Valid InventoryReservationActionRequest request,
            HttpServletRequest httpServletRequest
    ) {
        validateInternalToken(internalToken);
        InventoryReservationResponse response = inventoryService.confirmDeduct(request);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.INVENTORY_STOCK_COMMIT_SUCCESS, response, httpServletRequest);
    }

    private void validateInternalToken(String token) {
        if (!StringUtils.hasText(token) || !token.trim().equals(expectedInternalToken)) {
            throw new AppException(HttpStatus.UNAUTHORIZED, MessageCode.COMMON_UNAUTHORIZED);
        }
    }
}
