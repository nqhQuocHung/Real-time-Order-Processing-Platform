package com.nqh.orderservice.services.impl;

import com.nqh.orderservice.common.exception.AppException;
import com.nqh.orderservice.common.messages.MessageCode;
import com.nqh.orderservice.dtos.CreateOrderItemRequest;
import com.nqh.orderservice.dtos.CreateOrderItemResponse;
import com.nqh.orderservice.dtos.CreateOrderRequest;
import com.nqh.orderservice.dtos.CreateOrderResponse;
import com.nqh.orderservice.dtos.OrderActionRequest;
import com.nqh.orderservice.dtos.OrderDetailResponse;
import com.nqh.orderservice.dtos.OrderListResponse;
import com.nqh.orderservice.dtos.OrderStatusHistoryResponse;
import com.nqh.orderservice.dtos.OrderSummaryResponse;
import com.nqh.orderservice.dtos.UpdateOrderStatusRequest;
import com.nqh.orderservice.enums.OrderStatusEnum;
import com.nqh.orderservice.pojos.CustomerOrder;
import com.nqh.orderservice.pojos.OrderItem;
import com.nqh.orderservice.pojos.OrderStatusHistory;
import com.nqh.orderservice.repositories.CustomerOrderRepository;
import com.nqh.orderservice.repositories.OrderStatusHistoryRepository;
import com.nqh.orderservice.services.OrderService;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class OrderServiceImpl implements OrderService {

    private static final DateTimeFormatter ORDER_CODE_TIME_PATTERN = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private static final Random RANDOM = new Random();
    private static final String ACTION_CREATE = "CREATE";
    private static final String ACTION_CANCEL = "CANCEL";
    private static final String ACTION_MANUAL_STATUS_UPDATE = "MANUAL_STATUS_UPDATE";
    private static final String ACTION_PAYMENT_CONFIRM = "PAYMENT_CONFIRM";
    private static final String ACTION_PAYMENT_FAIL = "PAYMENT_FAIL";
    private static final String ACTION_SHIPPING_CONFIRM = "SHIPPING_CONFIRM";
    private static final String DEFAULT_SYSTEM_ACTOR = "SYSTEM";

    private static final Map<OrderStatusEnum, Set<OrderStatusEnum>> ALLOWED_TRANSITIONS = Map.of(
            OrderStatusEnum.CREATED, EnumSet.of(OrderStatusEnum.RESERVED, OrderStatusEnum.PAID, OrderStatusEnum.FAILED, OrderStatusEnum.CANCELLED),
            OrderStatusEnum.RESERVED, EnumSet.of(OrderStatusEnum.PAID, OrderStatusEnum.FAILED, OrderStatusEnum.CANCELLED),
            OrderStatusEnum.PAID, EnumSet.of(OrderStatusEnum.COMPLETED),
            OrderStatusEnum.FAILED, EnumSet.noneOf(OrderStatusEnum.class),
            OrderStatusEnum.CANCELLED, EnumSet.noneOf(OrderStatusEnum.class),
            OrderStatusEnum.COMPLETED, EnumSet.noneOf(OrderStatusEnum.class)
    );

    private final CustomerOrderRepository customerOrderRepository;
    private final OrderStatusHistoryRepository orderStatusHistoryRepository;
    private final String orderCodePrefix;
    private final String defaultCurrency;

    public OrderServiceImpl(
            CustomerOrderRepository customerOrderRepository,
            OrderStatusHistoryRepository orderStatusHistoryRepository,
            @Value("${app.order.code-prefix:ORD}") String orderCodePrefix,
            @Value("${app.order.default-currency:VND}") String defaultCurrency
    ) {
        this.customerOrderRepository = customerOrderRepository;
        this.orderStatusHistoryRepository = orderStatusHistoryRepository;
        this.orderCodePrefix = orderCodePrefix;
        this.defaultCurrency = defaultCurrency;
    }

    @Override
    @Transactional
    public CreateOrderResponse createOrder(CreateOrderRequest request, String idempotencyKey) {
        String normalizedIdempotencyKey = normalizeIdempotencyKey(idempotencyKey);
        CustomerOrder existingOrder = customerOrderRepository.findByIdempotencyKey(normalizedIdempotencyKey)
                .orElse(null);
        if (existingOrder != null) {
            return mapToCreateOrderResponse(existingOrder, true);
        }

        validateRequest(request);

        CustomerOrder newOrder = CustomerOrder.builder()
                .customerId(request.getCustomerId())
                .orderCode(generateOrderCode())
                .status(OrderStatusEnum.CREATED)
                .currency(resolveCurrency(request.getCurrency()))
                .idempotencyKey(normalizedIdempotencyKey)
                .totalAmount(BigDecimal.ZERO)
                .build();

        BigDecimal totalAmount = BigDecimal.ZERO;
        for (CreateOrderItemRequest itemRequest : request.getItems()) {
            validateItem(itemRequest);

            BigDecimal lineTotal = itemRequest.getUnitPrice()
                    .multiply(BigDecimal.valueOf(itemRequest.getQuantity()));
            totalAmount = totalAmount.add(lineTotal);

            OrderItem orderItem = OrderItem.builder()
                    .productId(itemRequest.getProductId())
                    .productName(itemRequest.getProductName())
                    .quantity(itemRequest.getQuantity())
                    .unitPrice(itemRequest.getUnitPrice())
                    .lineTotal(lineTotal)
                    .build();

            newOrder.addItem(orderItem);
        }

        newOrder.setTotalAmount(totalAmount);

        try {
            CustomerOrder savedOrder = customerOrderRepository.save(newOrder);
            recordStatusHistory(
                    savedOrder,
                    null,
                    OrderStatusEnum.CREATED,
                    ACTION_CREATE,
                    DEFAULT_SYSTEM_ACTOR,
                    "Order created"
            );
            return mapToCreateOrderResponse(savedOrder, false);
        } catch (DataIntegrityViolationException ex) {
            CustomerOrder deduplicatedOrder = customerOrderRepository.findByIdempotencyKey(normalizedIdempotencyKey)
                    .orElseThrow(() -> ex);
            return mapToCreateOrderResponse(deduplicatedOrder, true);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public OrderDetailResponse getOrderByCode(String orderCode) {
        CustomerOrder order = findByOrderCodeOrThrow(orderCode);
        return mapToOrderDetailResponse(order);
    }

    @Override
    @Transactional(readOnly = true)
    public OrderListResponse getOrders(
            UUID customerId,
            OrderStatusEnum status,
            LocalDateTime createdFrom,
            LocalDateTime createdTo,
            int page,
            int size
    ) {
        validateDateRange(createdFrom, createdTo);

        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Specification<CustomerOrder> specification = buildSpecification(customerId, status, createdFrom, createdTo);
        Page<CustomerOrder> orderPage = customerOrderRepository.findAll(specification, pageable);

        List<OrderSummaryResponse> content = orderPage.getContent().stream()
                .map(this::mapToOrderSummaryResponse)
                .toList();

        return OrderListResponse.builder()
                .content(content)
                .page(orderPage.getNumber())
                .size(orderPage.getSize())
                .totalElements(orderPage.getTotalElements())
                .totalPages(orderPage.getTotalPages())
                .last(orderPage.isLast())
                .build();
    }

    @Override
    @Transactional
    public OrderDetailResponse cancelOrder(String orderCode, OrderActionRequest request) {
        CustomerOrder order = findByOrderCodeOrThrow(orderCode);
        if (!EnumSet.of(OrderStatusEnum.CREATED, OrderStatusEnum.RESERVED).contains(order.getStatus())) {
            throw new AppException(HttpStatus.CONFLICT, MessageCode.ORDER_CANCEL_NOT_ALLOWED);
        }

        CustomerOrder updatedOrder = updateOrderStatusInternal(
                order,
                OrderStatusEnum.CANCELLED,
                ACTION_CANCEL,
                resolveActor(request, DEFAULT_SYSTEM_ACTOR),
                resolveNote(request),
                MessageCode.ORDER_CANCEL_NOT_ALLOWED
        );
        return mapToOrderDetailResponse(updatedOrder);
    }

    @Override
    @Transactional
    public OrderDetailResponse updateOrderStatus(String orderCode, UpdateOrderStatusRequest request) {
        CustomerOrder order = findByOrderCodeOrThrow(orderCode);
        CustomerOrder updatedOrder = updateOrderStatusInternal(
                order,
                request.getStatus(),
                ACTION_MANUAL_STATUS_UPDATE,
                resolveActor(request.getActor(), DEFAULT_SYSTEM_ACTOR),
                request.getNote(),
                MessageCode.ORDER_STATUS_TRANSITION_INVALID
        );
        return mapToOrderDetailResponse(updatedOrder);
    }

    @Override
    @Transactional
    public OrderDetailResponse confirmPayment(String orderCode, OrderActionRequest request) {
        CustomerOrder order = findByOrderCodeOrThrow(orderCode);
        CustomerOrder updatedOrder = updateOrderStatusInternal(
                order,
                OrderStatusEnum.PAID,
                ACTION_PAYMENT_CONFIRM,
                resolveActor(request, "PAYMENT_SERVICE"),
                resolveNote(request),
                MessageCode.ORDER_STATUS_TRANSITION_INVALID
        );
        return mapToOrderDetailResponse(updatedOrder);
    }

    @Override
    @Transactional
    public OrderDetailResponse failPayment(String orderCode, OrderActionRequest request) {
        CustomerOrder order = findByOrderCodeOrThrow(orderCode);
        CustomerOrder updatedOrder = updateOrderStatusInternal(
                order,
                OrderStatusEnum.FAILED,
                ACTION_PAYMENT_FAIL,
                resolveActor(request, "PAYMENT_SERVICE"),
                resolveNote(request),
                MessageCode.ORDER_STATUS_TRANSITION_INVALID
        );
        return mapToOrderDetailResponse(updatedOrder);
    }

    @Override
    @Transactional
    public OrderDetailResponse confirmShipping(String orderCode, OrderActionRequest request) {
        CustomerOrder order = findByOrderCodeOrThrow(orderCode);
        CustomerOrder updatedOrder = updateOrderStatusInternal(
                order,
                OrderStatusEnum.COMPLETED,
                ACTION_SHIPPING_CONFIRM,
                resolveActor(request, "SHIPPING_SERVICE"),
                resolveNote(request),
                MessageCode.ORDER_STATUS_TRANSITION_INVALID
        );
        return mapToOrderDetailResponse(updatedOrder);
    }

    @Override
    @Transactional(readOnly = true)
    public List<OrderStatusHistoryResponse> getOrderTimeline(String orderCode) {
        CustomerOrder order = findByOrderCodeOrThrow(orderCode);
        return orderStatusHistoryRepository.findByOrderOrderByCreatedAtAsc(order).stream()
                .map(history -> OrderStatusHistoryResponse.builder()
                        .historyId(history.getId())
                        .fromStatus(history.getFromStatus())
                        .toStatus(history.getToStatus())
                        .action(history.getAction())
                        .changedBy(history.getChangedBy())
                        .note(history.getNote())
                        .changedAt(history.getCreatedAt())
                        .build())
                .toList();
    }

    private String normalizeIdempotencyKey(String idempotencyKey) {
        if (!StringUtils.hasText(idempotencyKey)) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.ORDER_IDEMPOTENCY_KEY_REQUIRED);
        }

        String normalized = idempotencyKey.trim();
        if (normalized.length() > 255) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.ORDER_IDEMPOTENCY_KEY_TOO_LONG);
        }
        return normalized;
    }

    private void validateRequest(CreateOrderRequest request) {
        if (request.getItems() == null || request.getItems().isEmpty()) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.ORDER_ITEMS_REQUIRED);
        }
    }

    private void validateItem(CreateOrderItemRequest itemRequest) {
        if (itemRequest.getQuantity() == null || itemRequest.getQuantity() <= 0) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.ORDER_ITEM_QUANTITY_INVALID);
        }

        if (itemRequest.getUnitPrice() == null || itemRequest.getUnitPrice().signum() <= 0) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.ORDER_ITEM_UNIT_PRICE_INVALID);
        }
    }

    private String generateOrderCode() {
        int suffix = RANDOM.nextInt(1_000_000);
        String timestamp = LocalDateTime.now().format(ORDER_CODE_TIME_PATTERN);
        return String.format(
                Locale.ROOT,
                "%s-%s-%06d",
                orderCodePrefix.toUpperCase(Locale.ROOT),
                timestamp,
                suffix
        );
    }

    private String resolveCurrency(String currency) {
        if (!StringUtils.hasText(currency)) {
            return defaultCurrency.toUpperCase(Locale.ROOT);
        }
        return currency.trim().toUpperCase(Locale.ROOT);
    }

    private CustomerOrder findByOrderCodeOrThrow(String orderCode) {
        if (!StringUtils.hasText(orderCode)) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.COMMON_BAD_REQUEST);
        }
        return customerOrderRepository.findByOrderCode(orderCode.trim())
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, MessageCode.ORDER_NOT_FOUND));
    }

    private void validateDateRange(LocalDateTime createdFrom, LocalDateTime createdTo) {
        if (createdFrom != null && createdTo != null && createdFrom.isAfter(createdTo)) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.ORDER_DATE_RANGE_INVALID);
        }
    }

    private Specification<CustomerOrder> buildSpecification(
            UUID customerId,
            OrderStatusEnum status,
            LocalDateTime createdFrom,
            LocalDateTime createdTo
    ) {
        Specification<CustomerOrder> specification = Specification.where(null);

        if (customerId != null) {
            specification = specification.and((root, query, cb) -> cb.equal(root.get("customerId"), customerId));
        }
        if (status != null) {
            specification = specification.and((root, query, cb) -> cb.equal(root.get("status"), status));
        }
        if (createdFrom != null) {
            specification = specification.and((root, query, cb) -> cb.greaterThanOrEqualTo(root.get("createdAt"), createdFrom));
        }
        if (createdTo != null) {
            specification = specification.and((root, query, cb) -> cb.lessThanOrEqualTo(root.get("createdAt"), createdTo));
        }

        return specification;
    }

    private CustomerOrder updateOrderStatusInternal(
            CustomerOrder order,
            OrderStatusEnum targetStatus,
            String action,
            String actor,
            String note,
            MessageCode transitionErrorCode
    ) {
        OrderStatusEnum currentStatus = order.getStatus();
        if (currentStatus == targetStatus) {
            return order;
        }

        if (!ALLOWED_TRANSITIONS.getOrDefault(currentStatus, Set.of()).contains(targetStatus)) {
            throw new AppException(HttpStatus.CONFLICT, transitionErrorCode);
        }

        order.setStatus(targetStatus);
        CustomerOrder updatedOrder = customerOrderRepository.save(order);
        recordStatusHistory(updatedOrder, currentStatus, targetStatus, action, actor, note);
        return updatedOrder;
    }

    private void recordStatusHistory(
            CustomerOrder order,
            OrderStatusEnum fromStatus,
            OrderStatusEnum toStatus,
            String action,
            String changedBy,
            String note
    ) {
        OrderStatusHistory history = OrderStatusHistory.builder()
                .order(order)
                .fromStatus(fromStatus)
                .toStatus(toStatus)
                .action(action)
                .changedBy(changedBy)
                .note(note)
                .build();
        orderStatusHistoryRepository.save(history);
    }

    private String resolveActor(OrderActionRequest request, String fallbackActor) {
        if (request == null || !StringUtils.hasText(request.getActor())) {
            return fallbackActor;
        }
        return request.getActor().trim();
    }

    private String resolveActor(String actor, String fallbackActor) {
        if (!StringUtils.hasText(actor)) {
            return fallbackActor;
        }
        return actor.trim();
    }

    private String resolveNote(OrderActionRequest request) {
        if (request == null) {
            return null;
        }

        String note = StringUtils.hasText(request.getNote()) ? request.getNote().trim() : null;
        if (!StringUtils.hasText(request.getReferenceId())) {
            return note;
        }

        String referencePart = "referenceId=" + request.getReferenceId().trim();
        if (!StringUtils.hasText(note)) {
            return referencePart;
        }
        return note + " (" + referencePart + ")";
    }

    private CreateOrderResponse mapToCreateOrderResponse(CustomerOrder order, boolean replayed) {
        List<CreateOrderItemResponse> items = mapToOrderItemResponses(order);

        return CreateOrderResponse.builder()
                .orderId(order.getId())
                .uuid(order.getUuid())
                .orderCode(order.getOrderCode())
                .status(order.getStatus())
                .totalAmount(order.getTotalAmount())
                .currency(order.getCurrency())
                .idempotencyKey(order.getIdempotencyKey())
                .replayed(replayed)
                .createdAt(order.getCreatedAt())
                .items(items)
                .build();
    }

    private OrderDetailResponse mapToOrderDetailResponse(CustomerOrder order) {
        return OrderDetailResponse.builder()
                .orderId(order.getId())
                .uuid(order.getUuid())
                .customerId(order.getCustomerId())
                .orderCode(order.getOrderCode())
                .status(order.getStatus())
                .totalAmount(order.getTotalAmount())
                .currency(order.getCurrency())
                .idempotencyKey(order.getIdempotencyKey())
                .createdAt(order.getCreatedAt())
                .updatedAt(order.getUpdatedAt())
                .items(mapToOrderItemResponses(order))
                .build();
    }

    private OrderSummaryResponse mapToOrderSummaryResponse(CustomerOrder order) {
        return OrderSummaryResponse.builder()
                .orderId(order.getId())
                .uuid(order.getUuid())
                .customerId(order.getCustomerId())
                .orderCode(order.getOrderCode())
                .status(order.getStatus())
                .totalAmount(order.getTotalAmount())
                .currency(order.getCurrency())
                .createdAt(order.getCreatedAt())
                .updatedAt(order.getUpdatedAt())
                .build();
    }

    private List<CreateOrderItemResponse> mapToOrderItemResponses(CustomerOrder order) {
        return order.getItems().stream()
                .map(item -> CreateOrderItemResponse.builder()
                        .productId(item.getProductId())
                        .productName(item.getProductName())
                        .quantity(item.getQuantity())
                        .unitPrice(item.getUnitPrice())
                        .lineTotal(item.getLineTotal())
                        .build())
                .toList();
    }
}
