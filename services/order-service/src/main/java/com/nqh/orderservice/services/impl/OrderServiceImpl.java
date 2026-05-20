package com.nqh.orderservice.services.impl;

import com.nqh.orderservice.common.exception.AppException;
import com.nqh.orderservice.common.messages.MessageCode;
import com.nqh.orderservice.dtos.CreateOrderItemRequest;
import com.nqh.orderservice.dtos.CreateOrderItemResponse;
import com.nqh.orderservice.dtos.CreateOrderRequest;
import com.nqh.orderservice.dtos.CreateOrderRefundRequest;
import com.nqh.orderservice.dtos.CreateOrderResponse;
import com.nqh.orderservice.dtos.OrderActionRequest;
import com.nqh.orderservice.dtos.OrderDetailResponse;
import com.nqh.orderservice.dtos.OrderListResponse;
import com.nqh.orderservice.dtos.OrderRefundListResponse;
import com.nqh.orderservice.dtos.OrderRefundDecisionRequest;
import com.nqh.orderservice.dtos.OrderRefundResponse;
import com.nqh.orderservice.dtos.OrderStatusHistoryResponse;
import com.nqh.orderservice.dtos.OrderSummaryResponse;
import com.nqh.orderservice.dtos.UpdateOrderStatusRequest;
import com.nqh.orderservice.enums.OrderRefundStatusEnum;
import com.nqh.orderservice.enums.OrderStatusEnum;
import com.nqh.orderservice.pojos.CustomerOrder;
import com.nqh.orderservice.pojos.OrderItem;
import com.nqh.orderservice.pojos.OrderRefund;
import com.nqh.orderservice.pojos.OrderStatusHistory;
import com.nqh.orderservice.repositories.CustomerOrderRepository;
import com.nqh.orderservice.repositories.OrderRefundRepository;
import com.nqh.orderservice.repositories.OrderStatusHistoryRepository;
import com.nqh.orderservice.services.OrderService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.net.http.HttpClient;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Service
public class OrderServiceImpl implements OrderService {

    private static final Logger LOGGER = LoggerFactory.getLogger(OrderServiceImpl.class);
    private static final DateTimeFormatter ORDER_CODE_TIME_PATTERN = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private static final Random RANDOM = new Random();
    private static final String ACTION_CREATE = "CREATE";
    private static final String ACTION_CANCEL = "CANCEL";
    private static final String ACTION_MANUAL_STATUS_UPDATE = "MANUAL_STATUS_UPDATE";
    private static final String ACTION_PAYMENT_CONFIRM = "PAYMENT_CONFIRM";
    private static final String ACTION_PAYMENT_FAIL = "PAYMENT_FAIL";
    private static final String ACTION_SHIPPING_CONFIRM = "SHIPPING_CONFIRM";
    private static final String ACTION_PAYMENT_TIMEOUT = "PAYMENT_TIMEOUT";
    private static final String ACTION_INVENTORY_RESERVE = "INVENTORY_RESERVE";
    private static final String ACTION_INVENTORY_COMMIT = "INVENTORY_COMMIT";
    private static final String ACTION_AUTO_WORKFLOW_FAIL = "AUTO_WORKFLOW_FAIL";
    private static final String ACTION_REFUND_COMPLETE = "REFUND_COMPLETE";
    private static final String DEFAULT_SYSTEM_ACTOR = "SYSTEM";
    private static final String WORKFLOW_ACTOR = "ORDER_WORKFLOW";
    private static final String INTERNAL_TOKEN_HEADER = "X-Internal-Token";
    private static final String EVENT_VERSION = "v1";

    private static final Map<OrderStatusEnum, Set<OrderStatusEnum>> ALLOWED_TRANSITIONS = Map.of(
            OrderStatusEnum.CREATED, EnumSet.of(OrderStatusEnum.RESERVED, OrderStatusEnum.PAID, OrderStatusEnum.FAILED, OrderStatusEnum.CANCELLED),
            OrderStatusEnum.RESERVED, EnumSet.of(OrderStatusEnum.PAID, OrderStatusEnum.FAILED, OrderStatusEnum.CANCELLED),
            OrderStatusEnum.PAID, EnumSet.of(OrderStatusEnum.COMPLETED, OrderStatusEnum.FAILED),
            OrderStatusEnum.FAILED, EnumSet.noneOf(OrderStatusEnum.class),
            OrderStatusEnum.CANCELLED, EnumSet.noneOf(OrderStatusEnum.class),
            OrderStatusEnum.COMPLETED, EnumSet.noneOf(OrderStatusEnum.class)
    );

    private final CustomerOrderRepository customerOrderRepository;
    private final OrderStatusHistoryRepository orderStatusHistoryRepository;
    private final OrderRefundRepository orderRefundRepository;
    private final ObjectMapper objectMapper;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final RestClient inventoryRpcClient;
    private final RestClient paymentRpcClient;
    private final String orderCodePrefix;
    private final String defaultCurrency;
    private final String internalRpcToken;
    private final String defaultPaymentMethod;
    private final long paymentTimeoutMinutes;
    private final String topicOrderCreated;
    private final String topicOrderPaid;
    private final String topicOrderCompleted;
    private final String topicOrderFailed;
    private final String topicOrderRefundRequested;
    private final String topicOrderRefundApproved;
    private final String topicOrderRefundRejected;
    private final String topicOrderRefundCompleted;
    private final String topicOrderRefundFailed;

    public OrderServiceImpl(
            CustomerOrderRepository customerOrderRepository,
            OrderStatusHistoryRepository orderStatusHistoryRepository,
            OrderRefundRepository orderRefundRepository,
            ObjectMapper objectMapper,
            KafkaTemplate<String, String> kafkaTemplate,
            @Value("${app.order.code-prefix:ORD}") String orderCodePrefix,
            @Value("${app.order.default-currency:VND}") String defaultCurrency,
            @Value("${app.order.rpc.inventory-base-url:http://localhost:8083}") String inventoryBaseUrl,
            @Value("${app.order.rpc.payment-base-url:http://localhost:8084}") String paymentBaseUrl,
            @Value("${app.order.rpc.internal-token:change-me}") String internalRpcToken,
            @Value("${app.order.rpc.default-payment-method:VNPAY}") String defaultPaymentMethod,
            @Value("${app.order.payment-timeout-minutes:15}") long paymentTimeoutMinutes,
            @Value("${app.order.topic.created:order.lifecycle.created.v1}") String topicOrderCreated,
            @Value("${app.order.topic.paid:order.lifecycle.paid.v1}") String topicOrderPaid,
            @Value("${app.order.topic.completed:order.lifecycle.completed.v1}") String topicOrderCompleted,
            @Value("${app.order.topic.failed:order.lifecycle.failed.v1}") String topicOrderFailed,
            @Value("${app.order.topic.refund-requested:order.refund.requested.v1}") String topicOrderRefundRequested,
            @Value("${app.order.topic.refund-approved:order.refund.approved.v1}") String topicOrderRefundApproved,
            @Value("${app.order.topic.refund-rejected:order.refund.rejected.v1}") String topicOrderRefundRejected,
            @Value("${app.order.topic.refund-completed:order.refund.completed.v1}") String topicOrderRefundCompleted,
            @Value("${app.order.topic.refund-failed:order.refund.failed.v1}") String topicOrderRefundFailed
    ) {
        this.customerOrderRepository = customerOrderRepository;
        this.orderStatusHistoryRepository = orderStatusHistoryRepository;
        this.orderRefundRepository = orderRefundRepository;
        this.objectMapper = objectMapper;
        this.kafkaTemplate = kafkaTemplate;
        this.orderCodePrefix = orderCodePrefix;
        this.defaultCurrency = defaultCurrency;
        this.internalRpcToken = internalRpcToken;
        this.defaultPaymentMethod = defaultPaymentMethod;
        this.paymentTimeoutMinutes = paymentTimeoutMinutes;
        this.topicOrderCreated = topicOrderCreated;
        this.topicOrderPaid = topicOrderPaid;
        this.topicOrderCompleted = topicOrderCompleted;
        this.topicOrderFailed = topicOrderFailed;
        this.topicOrderRefundRequested = topicOrderRefundRequested;
        this.topicOrderRefundApproved = topicOrderRefundApproved;
        this.topicOrderRefundRejected = topicOrderRefundRejected;
        this.topicOrderRefundCompleted = topicOrderRefundCompleted;
        this.topicOrderRefundFailed = topicOrderRefundFailed;
        this.inventoryRpcClient = buildHttp2RestClient(inventoryBaseUrl);
        this.paymentRpcClient = buildHttp2RestClient(paymentBaseUrl);
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
            publishOrderCreatedEvent(savedOrder);
            CustomerOrder processedOrder = processOrderCreationWorkflow(savedOrder, request);
            return mapToCreateOrderResponse(processedOrder, false);
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

        if (order.getStatus() == OrderStatusEnum.RESERVED) {
            releaseInventory(order, "Release inventory after order cancellation");
        }
        order.setPaymentDeadlineAt(null);

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

        if (order.getStatus() == OrderStatusEnum.PAID || order.getStatus() == OrderStatusEnum.COMPLETED) {
            return mapToOrderDetailResponse(order);
        }
        if (order.getStatus() != OrderStatusEnum.RESERVED) {
            throw new AppException(HttpStatus.CONFLICT, MessageCode.ORDER_STATUS_TRANSITION_INVALID);
        }

        callInventoryCommit(order);

        CustomerOrder updatedOrder = updateOrderStatusInternal(
                order,
                OrderStatusEnum.PAID,
                ACTION_PAYMENT_CONFIRM,
                resolveActor(request, "PAYMENT_SERVICE"),
                resolveNote(request),
                MessageCode.ORDER_STATUS_TRANSITION_INVALID
        );
        updatedOrder.setPaymentDeadlineAt(null);
        customerOrderRepository.save(updatedOrder);
        return mapToOrderDetailResponse(updatedOrder);
    }

    @Override
    @Transactional
    public OrderDetailResponse failPayment(String orderCode, OrderActionRequest request) {
        CustomerOrder order = findByOrderCodeOrThrow(orderCode);

        if (order.getStatus() == OrderStatusEnum.FAILED || order.getStatus() == OrderStatusEnum.CANCELLED) {
            return mapToOrderDetailResponse(order);
        }
        if (order.getStatus() == OrderStatusEnum.PAID || order.getStatus() == OrderStatusEnum.COMPLETED) {
            return mapToOrderDetailResponse(order);
        }

        if (order.getStatus() == OrderStatusEnum.RESERVED) {
            releaseInventory(order, "Release inventory after payment failure");
        }

        CustomerOrder updatedOrder = updateOrderStatusInternal(
                order,
                OrderStatusEnum.FAILED,
                ACTION_PAYMENT_FAIL,
                resolveActor(request, "PAYMENT_SERVICE"),
                resolveNote(request),
                MessageCode.ORDER_STATUS_TRANSITION_INVALID
        );
        updatedOrder.setPaymentDeadlineAt(null);
        customerOrderRepository.save(updatedOrder);
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

    @Override
    @Transactional
    public OrderRefundResponse requestOrderRefund(
            String orderCode,
            CreateOrderRefundRequest request,
            UUID requesterUserId,
            boolean elevatedAuthority
    ) {
        CustomerOrder order = findByOrderCodeOrThrow(orderCode);
        if (!EnumSet.of(OrderStatusEnum.PAID, OrderStatusEnum.COMPLETED).contains(order.getStatus())) {
            throw new AppException(HttpStatus.CONFLICT, MessageCode.ORDER_REFUND_NOT_ALLOWED);
        }

        if (!elevatedAuthority) {
            if (requesterUserId == null || !requesterUserId.equals(order.getCustomerId())) {
                throw new AppException(HttpStatus.FORBIDDEN, MessageCode.ORDER_REFUND_FORBIDDEN);
            }
        }

        orderRefundRepository.findByOrder_OrderCode(order.getOrderCode()).ifPresent(existing -> {
            throw new AppException(HttpStatus.CONFLICT, MessageCode.ORDER_REFUND_ALREADY_EXISTS);
        });

        validateRefundRequest(request);

        String actor = resolveActor(
                request.getActor(),
                requesterUserId != null ? requesterUserId.toString() : DEFAULT_SYSTEM_ACTOR
        );

        OrderRefund refund = OrderRefund.builder()
                .order(order)
                .customerId(order.getCustomerId())
                .refundAmount(order.getTotalAmount())
                .currency(order.getCurrency())
                .refundAccountName(request.getRefundAccountName().trim())
                .refundAccountNumber(request.getRefundAccountNumber().trim())
                .refundBankCode(request.getRefundBankCode().trim().toUpperCase(Locale.ROOT))
                .refundReason(request.getRefundReason().trim())
                .status(OrderRefundStatusEnum.REQUESTED)
                .sellerDecisionBy(null)
                .sellerDecisionNote(null)
                .providerRefundId(null)
                .providerRefundUrl(null)
                .providerNote(null)
                .processedAt(null)
                .build();

        OrderRefund savedRefund = orderRefundRepository.save(refund);
        publishOrderRefundEvent(
                topicOrderRefundRequested,
                "OrderRefundRequested",
                savedRefund,
                actor
        );
        return mapToOrderRefundResponse(savedRefund);
    }

    @Override
    @Transactional(readOnly = true)
    public OrderRefundResponse getOrderRefundByOrderCode(
            String orderCode,
            UUID requesterUserId,
            boolean elevatedAuthority
    ) {
        OrderRefund refund = findOrderRefundByOrderCodeOrThrow(orderCode);
        if (!elevatedAuthority) {
            if (requesterUserId == null) {
                throw new AppException(HttpStatus.FORBIDDEN, MessageCode.ORDER_REFUND_FORBIDDEN);
            }

            boolean isCustomer = requesterUserId.equals(refund.getCustomerId());
            boolean isPartnerOwner = isOrderOwnedByPartner(refund.getOrder(), requesterUserId);
            if (!isCustomer && !isPartnerOwner) {
                throw new AppException(HttpStatus.FORBIDDEN, MessageCode.ORDER_REFUND_FORBIDDEN);
            }
        }
        return mapToOrderRefundResponse(refund);
    }

    @Override
    @Transactional(readOnly = true)
    public OrderRefundListResponse getOrderRefunds(
            OrderRefundStatusEnum status,
            int page,
            int size,
            UUID requesterUserId,
            boolean elevatedAuthority
    ) {
        List<OrderRefund> sourceRefunds = status != null
                ? orderRefundRepository.findAllByStatusOrderByCreatedAtDesc(status)
                : orderRefundRepository.findAllByOrderByCreatedAtDesc();

        List<OrderRefund> scopedRefunds;
        if (elevatedAuthority) {
            scopedRefunds = sourceRefunds;
        } else {
            if (requesterUserId == null) {
                throw new AppException(HttpStatus.FORBIDDEN, MessageCode.ORDER_REFUND_FORBIDDEN);
            }

            scopedRefunds = sourceRefunds.stream()
                    .filter(refund -> requesterUserId.equals(refund.getCustomerId())
                            || isOrderOwnedByPartner(refund.getOrder(), requesterUserId))
                    .toList();
        }

        long totalElements = scopedRefunds.size();
        int safeSize = Math.max(size, 1);
        int totalPages = totalElements == 0
                ? 0
                : (int) Math.ceil((double) totalElements / safeSize);
        int safePage = Math.max(page, 0);

        List<OrderRefundResponse> pageContent;
        if (totalElements == 0 || safePage >= totalPages) {
            pageContent = List.of();
        } else {
            int start = safePage * safeSize;
            int end = Math.min(start + safeSize, scopedRefunds.size());
            pageContent = scopedRefunds.subList(start, end).stream()
                    .map(this::mapToOrderRefundResponse)
                    .toList();
        }

        boolean last = totalPages == 0 || safePage >= totalPages - 1;
        return OrderRefundListResponse.builder()
                .content(pageContent)
                .page(safePage)
                .size(safeSize)
                .totalElements(totalElements)
                .totalPages(totalPages)
                .last(last)
                .build();
    }

    @Override
    @Transactional
    public OrderRefundResponse decideOrderRefund(
            String orderCode,
            OrderRefundDecisionRequest request,
            UUID approverUserId,
            boolean elevatedAuthority
    ) {
        CustomerOrder order = findByOrderCodeOrThrow(orderCode);
        OrderRefund refund = findOrderRefundByOrderCodeOrThrow(orderCode);

        if (!elevatedAuthority) {
            if (approverUserId == null || !isOrderOwnedByPartner(order, approverUserId)) {
                throw new AppException(HttpStatus.FORBIDDEN, MessageCode.ORDER_REFUND_FORBIDDEN);
            }
        }

        if (refund.getStatus() != OrderRefundStatusEnum.REQUESTED) {
            throw new AppException(HttpStatus.CONFLICT, MessageCode.ORDER_REFUND_DECISION_NOT_ALLOWED);
        }

        String actor = resolveActor(
                request.getActor(),
                approverUserId != null ? approverUserId.toString() : DEFAULT_SYSTEM_ACTOR
        );
        String decision = normalizeRefundDecision(request.getDecision());
        String sellerDecisionNote = trimToMaxLength(request.getNote(), 255);

        if ("REJECT".equals(decision)) {
            refund.setStatus(OrderRefundStatusEnum.REJECTED);
            refund.setSellerDecisionBy(actor);
            refund.setSellerDecisionNote(sellerDecisionNote);
            refund.setProviderRefundUrl(null);
            refund.setProcessedAt(LocalDateTime.now());
            OrderRefund rejected = orderRefundRepository.save(refund);
            publishOrderRefundEvent(topicOrderRefundRejected, "OrderRefundRejected", rejected, actor);
            return mapToOrderRefundResponse(rejected);
        }

        refund.setStatus(OrderRefundStatusEnum.APPROVED);
        refund.setSellerDecisionBy(actor);
        refund.setSellerDecisionNote(sellerDecisionNote);
        refund.setProviderRefundUrl(null);
        refund.setProcessedAt(null);
        OrderRefund approved = orderRefundRepository.save(refund);
        publishOrderRefundEvent(topicOrderRefundApproved, "OrderRefundApproved", approved, actor);

        try {
            PaymentRefundResult paymentRefundResult = callPaymentRefund(order, approved, actor);
            if (!"REFUNDED".equalsIgnoreCase(paymentRefundResult.status())) {
                approved.setStatus(OrderRefundStatusEnum.FAILED);
                approved.setProviderNote(trimToMaxLength(
                        "Refund payment returned status: " + paymentRefundResult.status(),
                        255
                ));
                approved.setProcessedAt(LocalDateTime.now());
                OrderRefund failed = orderRefundRepository.save(approved);
                publishOrderRefundEvent(topicOrderRefundFailed, "OrderRefundFailed", failed, actor);
                throw new AppException(HttpStatus.BAD_GATEWAY, MessageCode.ORDER_REFUND_PAYMENT_FAILED);
            }

            approved.setStatus(OrderRefundStatusEnum.REFUNDED);
            approved.setProviderRefundId(paymentRefundResult.providerRefundId());
            approved.setProviderRefundUrl(paymentRefundResult.refundUrl());
            approved.setProviderNote(trimToMaxLength(paymentRefundResult.note(), 255));
            approved.setProcessedAt(LocalDateTime.now());
            OrderRefund refunded = orderRefundRepository.save(approved);

            recordStatusHistory(
                    order,
                    order.getStatus(),
                    order.getStatus(),
                    ACTION_REFUND_COMPLETE,
                    actor,
                    "Refund completed successfully."
            );
            publishOrderRefundEvent(topicOrderRefundCompleted, "OrderRefundCompleted", refunded, actor);
            return mapToOrderRefundResponse(refunded);
        } catch (AppException ex) {
            if (ex.getMessageCode() == MessageCode.ORDER_REFUND_PAYMENT_FAILED) {
                throw ex;
            }
            approved.setStatus(OrderRefundStatusEnum.FAILED);
            approved.setProviderNote(trimToMaxLength(sanitizeErrorMessage(ex), 255));
            approved.setProcessedAt(LocalDateTime.now());
            OrderRefund failed = orderRefundRepository.save(approved);
            publishOrderRefundEvent(topicOrderRefundFailed, "OrderRefundFailed", failed, actor);
            throw new AppException(HttpStatus.BAD_GATEWAY, MessageCode.ORDER_REFUND_PAYMENT_FAILED);
        } catch (Exception ex) {
            approved.setStatus(OrderRefundStatusEnum.FAILED);
            approved.setProviderNote(trimToMaxLength(sanitizeErrorMessage(ex), 255));
            approved.setProcessedAt(LocalDateTime.now());
            OrderRefund failed = orderRefundRepository.save(approved);
            publishOrderRefundEvent(topicOrderRefundFailed, "OrderRefundFailed", failed, actor);
            throw new AppException(HttpStatus.BAD_GATEWAY, MessageCode.ORDER_REFUND_PAYMENT_FAILED);
        }
    }

    @Scheduled(fixedDelayString = "${app.order.payment-expiry-scan-delay-ms:10000}")
    public void releaseExpiredReservedOrders() {
        List<CustomerOrder> expiredOrders = customerOrderRepository
                .findTop100ByStatusAndPaymentDeadlineAtBeforeOrderByPaymentDeadlineAtAsc(
                        OrderStatusEnum.RESERVED,
                        LocalDateTime.now()
                );

        if (expiredOrders.isEmpty()) {
            return;
        }

        for (CustomerOrder expiredOrder : new ArrayList<>(expiredOrders)) {
            expireReservedOrder(expiredOrder.getOrderCode());
        }
    }

    private void expireReservedOrder(String orderCode) {
        try {
            CustomerOrder order = customerOrderRepository.findByOrderCode(orderCode).orElse(null);
            if (order == null || order.getStatus() != OrderStatusEnum.RESERVED) {
                return;
            }

            LocalDateTime paymentDeadlineAt = order.getPaymentDeadlineAt();
            if (paymentDeadlineAt == null || paymentDeadlineAt.isAfter(LocalDateTime.now())) {
                return;
            }

            releaseInventory(order, "Release inventory after payment timeout");
            CustomerOrder failedOrder = updateOrderStatusInternal(
                    order,
                    OrderStatusEnum.FAILED,
                    ACTION_PAYMENT_TIMEOUT,
                    WORKFLOW_ACTOR,
                    "Payment timeout. Inventory released automatically.",
                    MessageCode.ORDER_STATUS_TRANSITION_INVALID
            );
            failedOrder.setPaymentDeadlineAt(null);
            customerOrderRepository.save(failedOrder);
        } catch (Exception ex) {
            LOGGER.warn("Failed to auto-release timed-out order. orderCode={}", orderCode, ex);
        }
    }

    private CustomerOrder processOrderCreationWorkflow(CustomerOrder order, CreateOrderRequest request) {
        CustomerOrder currentOrder = order;

        try {
            callInventoryReserve(currentOrder, request);
            currentOrder = updateOrderStatusInternal(
                    currentOrder,
                    OrderStatusEnum.RESERVED,
                    ACTION_INVENTORY_RESERVE,
                    WORKFLOW_ACTOR,
                    "Inventory reserved by internal RPC workflow",
                    MessageCode.ORDER_STATUS_TRANSITION_INVALID
            );
        } catch (Exception ex) {
            return failWorkflow(currentOrder, "Inventory reserve failed: " + sanitizeErrorMessage(ex));
        }

        try {
            PaymentIntentResult paymentIntentResult = callPaymentCreateIntent(currentOrder);
            currentOrder.setPaymentUrl(paymentIntentResult.paymentUrl());
            currentOrder.setPaymentDeadlineAt(resolvePaymentDeadline(LocalDateTime.now()));
            return customerOrderRepository.save(currentOrder);
        } catch (Exception ex) {
            releaseInventoryQuietly(currentOrder, "Release after payment RPC exception");
            return failWorkflow(currentOrder, "Payment RPC failed: " + sanitizeErrorMessage(ex));
        }
    }

    private CustomerOrder failWorkflow(CustomerOrder order, String note) {
        if (order.getStatus() == OrderStatusEnum.FAILED) {
            return order;
        }
        return updateOrderStatusInternal(
                order,
                OrderStatusEnum.FAILED,
                ACTION_AUTO_WORKFLOW_FAIL,
                WORKFLOW_ACTOR,
                trimToMaxLength(note, 255),
                MessageCode.ORDER_STATUS_TRANSITION_INVALID
        );
    }

    private void callInventoryReserve(CustomerOrder order, CreateOrderRequest request) {
        Map<String, Object> body = new HashMap<>();
        body.put("orderCode", order.getOrderCode());
        body.put("actor", WORKFLOW_ACTOR);
        body.put("note", "Auto reserve from order workflow");
        body.put("items", request.getItems().stream().map(item -> {
            Map<String, Object> itemMap = new HashMap<>();
            itemMap.put("productId", item.getProductId());
            itemMap.put("quantity", item.getQuantity());
            return itemMap;
        }).toList());

        callInternalPost(inventoryRpcClient, "/internal/v1/inventories/reserve", body);
    }

    private void callInventoryCommit(CustomerOrder order) {
        Map<String, Object> body = new HashMap<>();
        body.put("orderCode", order.getOrderCode());
        body.put("actor", WORKFLOW_ACTOR);
        body.put("note", "Auto commit from order workflow");
        callInternalPost(inventoryRpcClient, "/internal/v1/inventories/confirm-deduct", body);
    }

    private void releaseInventory(CustomerOrder order, String note) {
        Map<String, Object> body = new HashMap<>();
        body.put("orderCode", order.getOrderCode());
        body.put("actor", WORKFLOW_ACTOR);
        body.put("note", note);
        callInternalPost(inventoryRpcClient, "/internal/v1/inventories/release", body);
    }

    private void releaseInventoryQuietly(CustomerOrder order, String note) {
        try {
            releaseInventory(order, note);
        } catch (Exception ex) {
            LOGGER.warn("Failed to release inventory for orderCode={} after workflow error", order.getOrderCode(), ex);
        }
    }

    private PaymentIntentResult callPaymentCreateIntent(CustomerOrder order) {
        Map<String, Object> body = new HashMap<>();
        body.put("orderCode", order.getOrderCode());
        body.put("customerId", order.getCustomerId());
        body.put("amount", order.getTotalAmount());
        body.put("currency", order.getCurrency());
        body.put("method", defaultPaymentMethod);
        body.put("actor", WORKFLOW_ACTOR);
        body.put("note", "Auto payment intent from order workflow");
        JsonNode responseNode = callInternalPost(paymentRpcClient, "/internal/v1/payments/intents", body);
        JsonNode dataNode = responseNode.path("data");
        String paymentStatus = dataNode.path("status").asText("");
        if (StringUtils.hasText(paymentStatus) && !"PENDING".equalsIgnoreCase(paymentStatus)) {
            throw new IllegalStateException("Payment intent was not created in pending state: " + paymentStatus);
        }
        String paymentUrl = trimToNull(dataNode.path("paymentUrl").asText(null));
        return new PaymentIntentResult(paymentUrl);
    }

    private PaymentRefundResult callPaymentRefund(CustomerOrder order, OrderRefund refund, String actor) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("orderCode", order.getOrderCode());
        body.put("refundAmount", refund.getRefundAmount());
        body.put("currency", refund.getCurrency());
        body.put("refundAccountName", refund.getRefundAccountName());
        body.put("refundAccountNumber", refund.getRefundAccountNumber());
        body.put("refundBankCode", refund.getRefundBankCode());
        body.put("refundReason", refund.getRefundReason());
        body.put("actor", actor);
        body.put("idempotencyKey", "refund-" + order.getOrderCode() + "-" + refund.getId());
        body.put("referenceId", refund.getId().toString());
        body.put("note", "Refund approved by seller.");

        JsonNode responseNode = callInternalPost(paymentRpcClient, "/internal/v1/payments/refunds", body);
        JsonNode dataNode = responseNode.path("data");

        String status = dataNode.path("status").asText("");
        String providerRefundId = trimToNull(dataNode.path("providerRefundId").asText(null));
        String refundUrl = trimToNull(dataNode.path("refundUrl").asText(null));
        String note = trimToNull(dataNode.path("note").asText(null));
        return new PaymentRefundResult(status, providerRefundId, refundUrl, note);
    }

    private void validateRefundRequest(CreateOrderRefundRequest request) {
        if (!StringUtils.hasText(request.getRefundAccountName())
                || !StringUtils.hasText(request.getRefundAccountNumber())
                || !StringUtils.hasText(request.getRefundBankCode())) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.ORDER_REFUND_ACCOUNT_INFO_REQUIRED);
        }
        if (!StringUtils.hasText(request.getRefundReason())) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.ORDER_REFUND_REASON_REQUIRED);
        }
    }

    private String normalizeRefundDecision(String decision) {
        if (!StringUtils.hasText(decision)) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.ORDER_REFUND_DECISION_INVALID);
        }

        String normalized = decision.trim().toUpperCase(Locale.ROOT);
        if ("APPROVE".equals(normalized) || "APPROVED".equals(normalized) || "ACCEPT".equals(normalized)) {
            return "APPROVE";
        }
        if ("REJECT".equals(normalized) || "REJECTED".equals(normalized) || "DECLINE".equals(normalized)) {
            return "REJECT";
        }
        throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.ORDER_REFUND_DECISION_INVALID);
    }

    private boolean isOrderOwnedByPartner(CustomerOrder order, UUID partnerUserId) {
        if (partnerUserId == null) {
            return false;
        }

        List<UUID> productIds = order.getItems().stream()
                .map(OrderItem::getProductId)
                .filter(productId -> productId != null)
                .distinct()
                .toList();
        if (productIds.isEmpty()) {
            return false;
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("productIds", productIds);
        JsonNode responseNode = callInternalPost(inventoryRpcClient, "/internal/v1/inventories/product-owners", body);
        JsonNode dataNode = responseNode.path("data");
        if (!dataNode.isArray()) {
            return false;
        }

        String normalizedPartnerUserId = partnerUserId.toString();
        for (JsonNode ownerNode : dataNode) {
            String shopId = trimToNull(ownerNode.path("shopId").asText(null));
            if (normalizedPartnerUserId.equals(shopId)) {
                return true;
            }
        }
        return false;
    }

    private OrderRefund findOrderRefundByOrderCodeOrThrow(String orderCode) {
        String normalized = trimToNull(orderCode);
        if (!StringUtils.hasText(normalized)) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.COMMON_BAD_REQUEST);
        }
        return orderRefundRepository.findByOrder_OrderCode(normalized)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, MessageCode.ORDER_REFUND_NOT_FOUND));
    }

    private void publishOrderRefundEvent(String topic, String eventType, OrderRefund refund, String actor) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("refundId", refund.getId());
        payload.put("refundUuid", refund.getUuid());
        payload.put("orderCode", refund.getOrder().getOrderCode());
        payload.put("customerId", refund.getCustomerId());
        payload.put("refundAmount", refund.getRefundAmount());
        payload.put("currency", refund.getCurrency());
        payload.put("refundAccountName", refund.getRefundAccountName());
        payload.put("refundAccountNumberMasked", maskAccountNumber(refund.getRefundAccountNumber()));
        payload.put("refundBankCode", refund.getRefundBankCode());
        payload.put("refundReason", refund.getRefundReason());
        payload.put("status", refund.getStatus().name());
        payload.put("sellerDecisionNote", refund.getSellerDecisionNote());
        payload.put("sellerDecisionBy", refund.getSellerDecisionBy());
        payload.put("providerRefundId", refund.getProviderRefundId());
        payload.put("providerRefundUrl", refund.getProviderRefundUrl());
        payload.put("providerNote", refund.getProviderNote());
        payload.put("actor", actor);
        payload.put("processedAt", refund.getProcessedAt());
        payload.put("createdAt", refund.getCreatedAt());
        payload.put("updatedAt", refund.getUpdatedAt());

        publishEvent(topic, refund.getOrder().getOrderCode(), eventType, payload);
    }

    private String maskAccountNumber(String accountNumber) {
        String normalized = trimToNull(accountNumber);
        if (!StringUtils.hasText(normalized)) {
            return null;
        }
        if (normalized.length() <= 4) {
            return "***" + normalized;
        }
        return "***" + normalized.substring(normalized.length() - 4);
    }

    private LocalDateTime resolvePaymentDeadline(LocalDateTime baseTime) {
        LocalDateTime normalizedBaseTime = baseTime != null ? baseTime : LocalDateTime.now();
        long timeoutMinutes = paymentTimeoutMinutes > 0 ? paymentTimeoutMinutes : 15;
        return normalizedBaseTime.plusMinutes(timeoutMinutes);
    }

    private JsonNode callInternalPost(RestClient restClient, String uri, Object body) {
        try {
            String rawResponse = restClient.post()
                    .uri(uri)
                    .header(INTERNAL_TOKEN_HEADER, internalRpcToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(String.class);

            if (!StringUtils.hasText(rawResponse)) {
                return objectMapper.createObjectNode();
            }
            return objectMapper.readTree(rawResponse);
        } catch (RestClientException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to parse internal RPC response", ex);
        }
    }

    private void publishOrderCreatedEvent(CustomerOrder order) {
        publishEvent(
                topicOrderCreated,
                order.getOrderCode(),
                "OrderCreated",
                buildOrderPayload(order)
        );
    }

    private void publishLifecycleEventIfNecessary(CustomerOrder order) {
        if (order.getStatus() == OrderStatusEnum.PAID) {
            publishEvent(
                    topicOrderPaid,
                    order.getOrderCode(),
                    "OrderPaid",
                    buildOrderPayload(order)
            );
            return;
        }
        if (order.getStatus() == OrderStatusEnum.COMPLETED) {
            publishEvent(
                    topicOrderCompleted,
                    order.getOrderCode(),
                    "OrderCompleted",
                    buildOrderPayload(order)
            );
            return;
        }
        if (order.getStatus() == OrderStatusEnum.FAILED) {
            publishEvent(
                    topicOrderFailed,
                    order.getOrderCode(),
                    "OrderFailed",
                    buildOrderPayload(order)
            );
        }
    }

    private Map<String, Object> buildOrderPayload(CustomerOrder order) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("orderId", order.getId());
        payload.put("orderUuid", order.getUuid());
        payload.put("orderCode", order.getOrderCode());
        payload.put("customerId", order.getCustomerId());
        payload.put("status", order.getStatus().name());
        payload.put("totalAmount", order.getTotalAmount());
        payload.put("currency", order.getCurrency());
        payload.put("paymentUrl", order.getPaymentUrl());
        payload.put("paymentDeadlineAt", order.getPaymentDeadlineAt());
        payload.put("createdAt", order.getCreatedAt());
        payload.put("updatedAt", order.getUpdatedAt());
        return payload;
    }

    private void publishEvent(String topic, String key, String eventType, Map<String, Object> payload) {
        if (!StringUtils.hasText(topic)) {
            return;
        }
        try {
            Map<String, Object> eventEnvelope = new LinkedHashMap<>();
            eventEnvelope.put("eventId", UUID.randomUUID().toString());
            eventEnvelope.put("eventType", eventType);
            eventEnvelope.put("eventVersion", EVENT_VERSION);
            eventEnvelope.put("occurredAt", LocalDateTime.now());
            eventEnvelope.put("source", "order-service");
            eventEnvelope.put("correlationId", key);
            eventEnvelope.put("payload", payload);

            String message = objectMapper.writeValueAsString(eventEnvelope);
            kafkaTemplate.send(topic, key, message);
        } catch (Exception ex) {
            LOGGER.warn("Failed to publish order event. topic={}, key={}, eventType={}", topic, key, eventType, ex);
        }
    }

    private RestClient buildHttp2RestClient(String baseUrl) {
        HttpClient httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_2)
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        return RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .build();
    }

    private String sanitizeErrorMessage(Exception ex) {
        String message = ex.getMessage();
        if (!StringUtils.hasText(message)) {
            return "Unknown internal RPC error";
        }
        return trimToMaxLength(message, 180);
    }

    private String trimToMaxLength(String value, int maxLength) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        String normalized = value.trim();
        if (normalized.length() > maxLength) {
            return normalized.substring(0, maxLength);
        }
        return normalized;
    }

    private String trimToNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
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
        publishLifecycleEventIfNecessary(updatedOrder);
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
                .paymentUrl(order.getPaymentUrl())
                .paymentDeadlineAt(order.getPaymentDeadlineAt())
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
                .paymentUrl(order.getPaymentUrl())
                .paymentDeadlineAt(order.getPaymentDeadlineAt())
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
                .paymentDeadlineAt(order.getPaymentDeadlineAt())
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

    private OrderRefundResponse mapToOrderRefundResponse(OrderRefund refund) {
        return OrderRefundResponse.builder()
                .refundId(refund.getId())
                .refundUuid(refund.getUuid())
                .orderCode(refund.getOrder().getOrderCode())
                .customerId(refund.getCustomerId())
                .refundAmount(refund.getRefundAmount())
                .currency(refund.getCurrency())
                .refundAccountName(refund.getRefundAccountName())
                .refundAccountNumberMasked(maskAccountNumber(refund.getRefundAccountNumber()))
                .refundBankCode(refund.getRefundBankCode())
                .refundReason(refund.getRefundReason())
                .status(refund.getStatus())
                .sellerDecisionNote(refund.getSellerDecisionNote())
                .sellerDecisionBy(refund.getSellerDecisionBy())
                .providerRefundId(refund.getProviderRefundId())
                .providerRefundUrl(refund.getProviderRefundUrl())
                .providerNote(refund.getProviderNote())
                .processedAt(refund.getProcessedAt())
                .createdAt(refund.getCreatedAt())
                .updatedAt(refund.getUpdatedAt())
                .build();
    }

    private record PaymentIntentResult(String paymentUrl) {
    }

    private record PaymentRefundResult(String status, String providerRefundId, String refundUrl, String note) {
    }
}
