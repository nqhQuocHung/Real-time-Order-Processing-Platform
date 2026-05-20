package com.nqh.paymentservice.repositories;

import com.nqh.paymentservice.pojos.PaymentRefund;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentRefundRepository extends JpaRepository<PaymentRefund, UUID> {
    Optional<PaymentRefund> findByOrderCode(String orderCode);

    Optional<PaymentRefund> findByIdempotencyKey(String idempotencyKey);
}
