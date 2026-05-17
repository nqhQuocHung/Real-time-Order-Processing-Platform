package com.nqh.orderservice.repositories;

import com.nqh.orderservice.pojos.CustomerOrder;
import com.nqh.orderservice.pojos.OrderStatusHistory;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderStatusHistoryRepository extends JpaRepository<OrderStatusHistory, UUID> {

    List<OrderStatusHistory> findByOrderOrderByCreatedAtAsc(CustomerOrder order);
}
