package com.nqh.orderservice.repositories;

import com.nqh.orderservice.pojos.CustomerOrder;
import com.nqh.orderservice.enums.OrderStatusEnum;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface CustomerOrderRepository extends JpaRepository<CustomerOrder, UUID>, JpaSpecificationExecutor<CustomerOrder> {
    Optional<CustomerOrder> findByIdempotencyKey(String idempotencyKey);

    Optional<CustomerOrder> findByOrderCode(String orderCode);

    List<CustomerOrder> findTop100ByStatusAndPaymentDeadlineAtBeforeOrderByPaymentDeadlineAtAsc(
            OrderStatusEnum status,
            LocalDateTime paymentDeadlineAt
    );
}
