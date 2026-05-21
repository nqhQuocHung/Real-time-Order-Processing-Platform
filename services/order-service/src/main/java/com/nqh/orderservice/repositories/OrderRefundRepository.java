package com.nqh.orderservice.repositories;

import com.nqh.orderservice.pojos.OrderRefund;
import com.nqh.orderservice.enums.OrderRefundStatusEnum;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderRefundRepository extends JpaRepository<OrderRefund, UUID> {
    Optional<OrderRefund> findByOrder_OrderCode(String orderCode);

    List<OrderRefund> findAllByOrderByCreatedAtDesc();

    List<OrderRefund> findAllByStatusOrderByCreatedAtDesc(OrderRefundStatusEnum status);
}
