package com.nqh.paymentservice.services;

import com.nqh.paymentservice.dtos.CreatePaymentIntentRequest;
import com.nqh.paymentservice.dtos.PaymentActionRequest;
import com.nqh.paymentservice.dtos.PaymentTransactionResponse;

public interface PaymentService {

    PaymentTransactionResponse createPaymentIntent(CreatePaymentIntentRequest request);

    PaymentTransactionResponse getPaymentByOrderCode(String orderCode);

    PaymentTransactionResponse confirmPayment(PaymentActionRequest request);

    PaymentTransactionResponse failPayment(PaymentActionRequest request);
}
