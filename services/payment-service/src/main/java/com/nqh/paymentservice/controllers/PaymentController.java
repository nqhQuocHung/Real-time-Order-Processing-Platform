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
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.util.StringUtils;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/payments")
@RequiredArgsConstructor
@Validated
public class PaymentController {

    private static final Set<String> ELEVATED_ORDER_AUTHORITIES = Set.of(
            "PERM_MANAGE_ALL_ORDERS",
            "PERM_MANAGE_PARTNER_ORDERS"
    );

    private final PaymentService paymentService;
    private final ApiResponseFactory apiResponseFactory;

    @PostMapping("/intents")
    public ResponseEntity<BaseResponse<PaymentTransactionResponse>> createIntent(
            @RequestBody @Valid CreatePaymentIntentRequest request,
            HttpServletRequest httpServletRequest
    ) {
        PaymentTransactionResponse response = paymentService.createPaymentIntent(request);
        return apiResponseFactory.success(HttpStatus.CREATED, MessageCode.PAYMENT_INTENT_CREATE_SUCCESS, response, httpServletRequest);
    }

    @GetMapping("/{orderCode}")
    public ResponseEntity<BaseResponse<PaymentTransactionResponse>> getPaymentByOrderCode(
            @PathVariable String orderCode,
            HttpServletRequest httpServletRequest
    ) {
        PaymentTransactionResponse response = paymentService.getPaymentByOrderCode(orderCode);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.PAYMENT_GET_SUCCESS, response, httpServletRequest);
    }

    @PostMapping("/confirm")
    public ResponseEntity<BaseResponse<PaymentTransactionResponse>> confirmPayment(
            @RequestBody @Valid PaymentActionRequest request,
            @AuthenticationPrincipal Jwt jwt,
            Authentication authentication,
            HttpServletRequest httpServletRequest
    ) {
        validateCanMutatePayment(request, jwt, authentication);
        PaymentTransactionResponse response = paymentService.confirmPayment(request);
        MessageCode messageCode = response.getStatus() == PaymentStatusEnum.SUCCESS
                ? MessageCode.PAYMENT_CONFIRM_SUCCESS
                : MessageCode.PAYMENT_FAIL_SUCCESS;
        return apiResponseFactory.success(HttpStatus.OK, messageCode, response, httpServletRequest);
    }

    @PostMapping("/fail")
    public ResponseEntity<BaseResponse<PaymentTransactionResponse>> failPayment(
            @RequestBody @Valid PaymentActionRequest request,
            @AuthenticationPrincipal Jwt jwt,
            Authentication authentication,
            HttpServletRequest httpServletRequest
    ) {
        validateCanMutatePayment(request, jwt, authentication);
        PaymentTransactionResponse response = paymentService.failPayment(request);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.PAYMENT_FAIL_SUCCESS, response, httpServletRequest);
    }

    private void validateCanMutatePayment(
            PaymentActionRequest request,
            Jwt jwt,
            Authentication authentication
    ) {
        if (hasElevatedOrderAuthority(authentication)) {
            return;
        }

        UUID authenticatedUserId = extractUserId(jwt);
        if (authenticatedUserId == null) {
            throw new AppException(HttpStatus.FORBIDDEN, MessageCode.COMMON_UNAUTHORIZED);
        }

        PaymentTransactionResponse payment = paymentService.getPaymentByOrderCode(request.getOrderCode());
        if (payment.getCustomerId() == null || !authenticatedUserId.equals(payment.getCustomerId())) {
            throw new AppException(HttpStatus.FORBIDDEN, MessageCode.COMMON_UNAUTHORIZED);
        }
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
