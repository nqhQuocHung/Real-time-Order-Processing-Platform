package com.nqh.inventoryservice.controllers;

import com.nqh.inventoryservice.common.messages.MessageCode;
import com.nqh.inventoryservice.common.response.ApiResponseFactory;
import com.nqh.inventoryservice.common.response.BaseResponse;
import com.nqh.inventoryservice.dtos.InventoryAdjustRequest;
import com.nqh.inventoryservice.dtos.InventoryCheckRequest;
import com.nqh.inventoryservice.dtos.InventoryCheckResponse;
import com.nqh.inventoryservice.dtos.InventoryReservationActionRequest;
import com.nqh.inventoryservice.dtos.InventoryReservationResponse;
import com.nqh.inventoryservice.dtos.InventoryReserveRequest;
import com.nqh.inventoryservice.dtos.InventoryStockResponse;
import com.nqh.inventoryservice.dtos.InventorySummaryResponse;
import com.nqh.inventoryservice.services.InventoryService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/inventories")
@RequiredArgsConstructor
@Validated
public class InventoryController {

    private final InventoryService inventoryService;
    private final ApiResponseFactory apiResponseFactory;

    @GetMapping("/{productId}")
    public ResponseEntity<BaseResponse<InventoryStockResponse>> getStock(
            @PathVariable UUID productId,
            HttpServletRequest httpServletRequest
    ) {
        InventoryStockResponse response = inventoryService.getStock(productId);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.INVENTORY_STOCK_GET_SUCCESS, response, httpServletRequest);
    }

    @GetMapping("/summary")
    public ResponseEntity<BaseResponse<InventorySummaryResponse>> getInventorySummary(
            HttpServletRequest httpServletRequest
    ) {
        InventorySummaryResponse response = inventoryService.getInventorySummary();
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.COMMON_SUCCESS, response, httpServletRequest);
    }

    @PostMapping("/check")
    public ResponseEntity<BaseResponse<InventoryCheckResponse>> checkStock(
            @RequestBody @Valid InventoryCheckRequest request,
            HttpServletRequest httpServletRequest
    ) {
        InventoryCheckResponse response = inventoryService.checkStock(request);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.INVENTORY_STOCK_CHECK_SUCCESS, response, httpServletRequest);
    }

    @PostMapping("/reserve")
    public ResponseEntity<BaseResponse<InventoryReservationResponse>> reserveStock(
            @RequestBody @Valid InventoryReserveRequest request,
            HttpServletRequest httpServletRequest
    ) {
        InventoryReservationResponse response = inventoryService.reserveStock(request);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.INVENTORY_STOCK_RESERVE_SUCCESS, response, httpServletRequest);
    }

    @PostMapping("/release")
    public ResponseEntity<BaseResponse<InventoryReservationResponse>> releaseReservation(
            @RequestBody @Valid InventoryReservationActionRequest request,
            HttpServletRequest httpServletRequest
    ) {
        InventoryReservationResponse response = inventoryService.releaseReservation(request);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.INVENTORY_STOCK_RELEASE_SUCCESS, response, httpServletRequest);
    }

    @PostMapping("/confirm-deduct")
    public ResponseEntity<BaseResponse<InventoryReservationResponse>> confirmDeduct(
            @RequestBody @Valid InventoryReservationActionRequest request,
            HttpServletRequest httpServletRequest
    ) {
        InventoryReservationResponse response = inventoryService.confirmDeduct(request);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.INVENTORY_STOCK_COMMIT_SUCCESS, response, httpServletRequest);
    }

    @PostMapping("/adjust")
    public ResponseEntity<BaseResponse<InventoryStockResponse>> adjustStock(
            @RequestBody @Valid InventoryAdjustRequest request,
            HttpServletRequest httpServletRequest
    ) {
        InventoryStockResponse response = inventoryService.adjustStock(request);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.INVENTORY_STOCK_ADJUST_SUCCESS, response, httpServletRequest);
    }
}
