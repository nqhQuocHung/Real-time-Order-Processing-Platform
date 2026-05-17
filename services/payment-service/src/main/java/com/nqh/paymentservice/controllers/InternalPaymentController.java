package com.nqh.paymentservice.controllers;

import com.nqh.paymentservice.common.exception.AppException;
import com.nqh.paymentservice.common.messages.MessageCode;
import com.nqh.paymentservice.common.response.ApiResponseFactory;
import com.nqh.paymentservice.common.response.BaseResponse;
import com.nqh.paymentservice.dtos.CreatePaymentIntentRequest;
import com.nqh.paymentservice.dtos.PaymentActionRequest;
import com.nqh.paymentservice.dtos.PaymentTransactionResponse;
import com.nqh.paymentservice.enums.PaymentStatusEnum;
import com.nqh.paymentservice.services.PaymentService;
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
@RequestMapping("/internal/v1/payments")
@RequiredArgsConstructor
@Validated
public class InternalPaymentController {

    private static final String INTERNAL_TOKEN_HEADER = "X-Internal-Token";

    private final PaymentService paymentService;
    private final ApiResponseFactory apiResponseFactory;

    @Value("${app.internal.token:change-me}")
    private String expectedInternalToken;

    @PostMapping("/intents")
    public ResponseEntity<BaseResponse<PaymentTransactionResponse>> createIntent(
            @RequestHeader(name = INTERNAL_TOKEN_HEADER, required = false) String internalToken,
            @RequestBody @Valid CreatePaymentIntentRequest request,
            HttpServletRequest httpServletRequest
    ) {
        validateInternalToken(internalToken);
        PaymentTransactionResponse response = paymentService.createPaymentIntent(request);
        return apiResponseFactory.success(HttpStatus.CREATED, MessageCode.PAYMENT_INTENT_CREATE_SUCCESS, response, httpServletRequest);
    }

    @PostMapping("/confirm")
    public ResponseEntity<BaseResponse<PaymentTransactionResponse>> confirmPayment(
            @RequestHeader(name = INTERNAL_TOKEN_HEADER, required = false) String internalToken,
            @RequestBody @Valid PaymentActionRequest request,
            HttpServletRequest httpServletRequest
    ) {
        validateInternalToken(internalToken);
        PaymentTransactionResponse response = paymentService.confirmPayment(request);
        MessageCode messageCode = response.getStatus() == PaymentStatusEnum.SUCCESS
                ? MessageCode.PAYMENT_CONFIRM_SUCCESS
                : MessageCode.PAYMENT_FAIL_SUCCESS;
        return apiResponseFactory.success(HttpStatus.OK, messageCode, response, httpServletRequest);
    }

    @PostMapping("/fail")
    public ResponseEntity<BaseResponse<PaymentTransactionResponse>> failPayment(
            @RequestHeader(name = INTERNAL_TOKEN_HEADER, required = false) String internalToken,
            @RequestBody @Valid PaymentActionRequest request,
            HttpServletRequest httpServletRequest
    ) {
        validateInternalToken(internalToken);
        PaymentTransactionResponse response = paymentService.failPayment(request);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.PAYMENT_FAIL_SUCCESS, response, httpServletRequest);
    }

    private void validateInternalToken(String token) {
        if (!StringUtils.hasText(token) || !token.trim().equals(expectedInternalToken)) {
            throw new AppException(HttpStatus.UNAUTHORIZED, MessageCode.COMMON_UNAUTHORIZED);
        }
    }
}
