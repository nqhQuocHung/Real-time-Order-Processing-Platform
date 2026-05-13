package com.nqh.paymentservice.services.impl;

import com.nqh.paymentservice.common.exception.AppException;
import com.nqh.paymentservice.common.messages.MessageCode;
import com.nqh.paymentservice.configurations.VnpayProperties;
import com.nqh.paymentservice.dtos.CreatePaymentIntentRequest;
import com.nqh.paymentservice.dtos.PaymentActionRequest;
import com.nqh.paymentservice.dtos.PaymentTransactionResponse;
import com.nqh.paymentservice.enums.PaymentMethodEnum;
import com.nqh.paymentservice.enums.PaymentStatusEnum;
import com.nqh.paymentservice.pojos.PaymentTransaction;
import com.nqh.paymentservice.repositories.PaymentTransactionRepository;
import com.nqh.paymentservice.services.PaymentService;
import com.fasterxml.jackson.databind.ObjectMapper;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class PaymentServiceImpl implements PaymentService {

    private static final Logger LOGGER = LoggerFactory.getLogger(PaymentServiceImpl.class);
    private static final String DEFAULT_ACTOR = "PAYMENT_SERVICE";
    private static final DateTimeFormatter REFERENCE_TIME_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private static final DateTimeFormatter VNPAY_DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final PaymentTransactionRepository paymentTransactionRepository;
    private final VnpayProperties vnpayProperties;
    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final long idempotencyTtlSeconds;
    private final String topicPaymentSucceeded;
    private final String topicPaymentFailed;

    public PaymentServiceImpl(
            PaymentTransactionRepository paymentTransactionRepository,
            VnpayProperties vnpayProperties,
            StringRedisTemplate stringRedisTemplate,
            ObjectMapper objectMapper,
            KafkaTemplate<String, String> kafkaTemplate,
            @org.springframework.beans.factory.annotation.Value("${app.payment.idempotency.ttl-seconds:300}") long idempotencyTtlSeconds,
            @org.springframework.beans.factory.annotation.Value("${app.payment.topic.transaction-succeeded:payment.transaction.succeeded.v1}") String topicPaymentSucceeded,
            @org.springframework.beans.factory.annotation.Value("${app.payment.topic.transaction-failed:payment.transaction.failed.v1}") String topicPaymentFailed
    ) {
        this.paymentTransactionRepository = paymentTransactionRepository;
        this.vnpayProperties = vnpayProperties;
        this.stringRedisTemplate = stringRedisTemplate;
        this.objectMapper = objectMapper;
        this.kafkaTemplate = kafkaTemplate;
        this.idempotencyTtlSeconds = idempotencyTtlSeconds;
        this.topicPaymentSucceeded = topicPaymentSucceeded;
        this.topicPaymentFailed = topicPaymentFailed;
    }

    @Override
    @Transactional
    public PaymentTransactionResponse createPaymentIntent(CreatePaymentIntentRequest request) {
        String orderCode = normalizeOrderCode(request.getOrderCode());
        PaymentTransaction existing = paymentTransactionRepository.findByOrderCode(orderCode).orElse(null);
        if (existing != null) {
            return mapToResponse(existing, true);
        }

        String providerTransactionId = buildProviderTransactionId(request.getMethod(), orderCode);
        PaymentTransaction paymentTransaction = PaymentTransaction.builder()
                .orderCode(orderCode)
                .customerId(request.getCustomerId())
                .amount(request.getAmount().setScale(2, RoundingMode.HALF_UP))
                .currency(request.getCurrency().trim().toUpperCase(Locale.ROOT))
                .method(request.getMethod())
                .status(PaymentStatusEnum.PENDING)
                .paymentUrl(buildPaymentUrl(request.getMethod(), orderCode, request.getAmount(), request.getCurrency(), providerTransactionId))
                .providerTransactionId(providerTransactionId)
                .actor(resolveActor(request.getActor()))
                .note(buildCreateIntentNote(request.getMethod(), request.getNote()))
                .build();

        PaymentTransaction saved = paymentTransactionRepository.save(paymentTransaction);
        return mapToResponse(saved, false);
    }

    @Override
    @Transactional(readOnly = true)
    public PaymentTransactionResponse getPaymentByOrderCode(String orderCode) {
        PaymentTransaction paymentTransaction = findByOrderCodeOrThrow(orderCode);
        return mapToResponse(paymentTransaction, false);
    }

    @Override
    @Transactional
    public PaymentTransactionResponse confirmPayment(PaymentActionRequest request) {
        if (!acquireActionLock("confirm", request)) {
            PaymentTransaction replayedPayment = findByOrderCodeOrThrow(request.getOrderCode());
            return mapToResponse(replayedPayment, true);
        }

        PaymentTransaction paymentTransaction = findByOrderCodeOrThrow(request.getOrderCode());

        if (paymentTransaction.getStatus() == PaymentStatusEnum.SUCCESS) {
            return mapToResponse(paymentTransaction, true);
        }
        if (paymentTransaction.getStatus() == PaymentStatusEnum.FAILED) {
            throw new AppException(HttpStatus.CONFLICT, MessageCode.PAYMENT_ALREADY_FAILED);
        }
        if (paymentTransaction.getStatus() == PaymentStatusEnum.CANCELLED) {
            throw new AppException(HttpStatus.CONFLICT, MessageCode.PAYMENT_ALREADY_CANCELLED);
        }
        if (paymentTransaction.getStatus() != PaymentStatusEnum.PENDING) {
            throw new AppException(HttpStatus.CONFLICT, MessageCode.PAYMENT_INVALID_STATE);
        }

        paymentTransaction.setActor(resolveActor(request.getActor()));
        paymentTransaction.setProviderTransactionId(trimToNull(request.getProviderTransactionId()));

        if (paymentTransaction.getMethod() == PaymentMethodEnum.VNPAY) {
            paymentTransaction.setStatus(PaymentStatusEnum.SUCCESS);
            paymentTransaction.setNote(trimToNull(request.getNote()));
        } else {
            paymentTransaction.setStatus(PaymentStatusEnum.FAILED);
            paymentTransaction.setNote(mergeNote(
                    request.getNote(),
                    MessageCode.PAYMENT_METHOD_NOT_SUPPORTED_FOR_SUCCESS.getDefaultMessage()
            ));
        }

        PaymentTransaction saved = paymentTransactionRepository.save(paymentTransaction);
        publishPaymentEvent(saved);
        return mapToResponse(saved, false);
    }

    @Override
    @Transactional
    public PaymentTransactionResponse failPayment(PaymentActionRequest request) {
        if (!acquireActionLock("fail", request)) {
            PaymentTransaction replayedPayment = findByOrderCodeOrThrow(request.getOrderCode());
            return mapToResponse(replayedPayment, true);
        }

        PaymentTransaction paymentTransaction = findByOrderCodeOrThrow(request.getOrderCode());

        if (paymentTransaction.getStatus() == PaymentStatusEnum.FAILED) {
            return mapToResponse(paymentTransaction, true);
        }
        if (paymentTransaction.getStatus() == PaymentStatusEnum.SUCCESS) {
            throw new AppException(HttpStatus.CONFLICT, MessageCode.PAYMENT_ALREADY_SUCCESS);
        }
        if (paymentTransaction.getStatus() == PaymentStatusEnum.CANCELLED) {
            throw new AppException(HttpStatus.CONFLICT, MessageCode.PAYMENT_ALREADY_CANCELLED);
        }
        if (paymentTransaction.getStatus() != PaymentStatusEnum.PENDING) {
            throw new AppException(HttpStatus.CONFLICT, MessageCode.PAYMENT_INVALID_STATE);
        }

        paymentTransaction.setStatus(PaymentStatusEnum.FAILED);
        paymentTransaction.setActor(resolveActor(request.getActor()));
        paymentTransaction.setProviderTransactionId(trimToNull(request.getProviderTransactionId()));
        paymentTransaction.setNote(trimToNull(request.getNote()));

        PaymentTransaction saved = paymentTransactionRepository.save(paymentTransaction);
        publishPaymentEvent(saved);
        return mapToResponse(saved, false);
    }

    private PaymentTransaction findByOrderCodeOrThrow(String orderCode) {
        String normalized = normalizeOrderCode(orderCode);
        return paymentTransactionRepository.findByOrderCode(normalized)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, MessageCode.PAYMENT_NOT_FOUND));
    }

    private String normalizeOrderCode(String orderCode) {
        if (!StringUtils.hasText(orderCode)) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.PAYMENT_ORDER_CODE_REQUIRED);
        }
        return orderCode.trim();
    }

    private String resolveActor(String actor) {
        if (!StringUtils.hasText(actor)) {
            return DEFAULT_ACTOR;
        }
        return actor.trim();
    }

    private String trimToNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }

    private String buildCreateIntentNote(PaymentMethodEnum method, String note) {
        if (method == PaymentMethodEnum.VNPAY) {
            return trimToNull(note);
        }
        return mergeNote(note, MessageCode.PAYMENT_METHOD_NOT_SUPPORTED_FOR_SUCCESS.getDefaultMessage());
    }

    private String mergeNote(String primaryNote, String fallbackNote) {
        String normalizedPrimary = trimToNull(primaryNote);
        String normalizedFallback = trimToNull(fallbackNote);
        if (!StringUtils.hasText(normalizedPrimary)) {
            return normalizedFallback;
        }
        if (!StringUtils.hasText(normalizedFallback)) {
            return normalizedPrimary;
        }
        return normalizedPrimary + " | " + normalizedFallback;
    }

    private String buildPaymentUrl(
            PaymentMethodEnum method,
            String orderCode,
            BigDecimal amount,
            String currency,
            String providerTransactionId
    ) {
        if (method != PaymentMethodEnum.VNPAY) {
            return null;
        }

        LocalDateTime now = LocalDateTime.now();
        String createDate = now.format(VNPAY_DATE_FORMAT);
        String expireDate = now.plusMinutes(15).format(VNPAY_DATE_FORMAT);
        String currCode = currency.trim().toUpperCase(Locale.ROOT);
        long amountInMinorUnit = amount
                .setScale(2, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
                .longValueExact();

        Map<String, String> params = new LinkedHashMap<>();
        params.put("vnp_Version", vnpayProperties.getVersion());
        params.put("vnp_Command", vnpayProperties.getCommand());
        params.put("vnp_TmnCode", vnpayProperties.getTmnCode());
        params.put("vnp_Amount", String.valueOf(amountInMinorUnit));
        params.put("vnp_CurrCode", currCode);
        params.put("vnp_TxnRef", providerTransactionId);
        params.put("vnp_OrderInfo", "Thanh toan don hang " + orderCode);
        params.put("vnp_OrderType", vnpayProperties.getOrderType());
        params.put("vnp_Locale", vnpayProperties.getLocale());
        params.put("vnp_ReturnUrl", vnpayProperties.getReturnUrl());
        params.put("vnp_IpAddr", "127.0.0.1");
        params.put("vnp_CreateDate", createDate);
        params.put("vnp_ExpireDate", expireDate);

        String hashData = params.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> urlEncode(entry.getKey()) + "=" + urlEncode(entry.getValue()))
                .collect(Collectors.joining("&"));
        String secureHash = hmacSha512(vnpayProperties.getHashSecret(), hashData);

        String queryString = params.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> urlEncode(entry.getKey()) + "=" + urlEncode(entry.getValue()))
                .collect(Collectors.joining("&"));

        return vnpayProperties.getPayUrl() + "?" + queryString + "&vnp_SecureHash=" + secureHash;
    }

    private String buildProviderTransactionId(PaymentMethodEnum method, String orderCode) {
        if (method != PaymentMethodEnum.VNPAY) {
            return null;
        }
        return buildTxnRef(orderCode, LocalDateTime.now());
    }

    private String buildTxnRef(String orderCode, LocalDateTime now) {
        return "VNP-" + orderCode + "-" + now.format(REFERENCE_TIME_FORMAT);
    }

    private String urlEncode(String input) {
        return URLEncoder.encode(input, StandardCharsets.UTF_8);
    }

    private String hmacSha512(String key, String data) {
        try {
            Mac hmac512 = Mac.getInstance("HmacSHA512");
            SecretKeySpec secretKey = new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA512");
            hmac512.init(secretKey);
            byte[] bytes = hmac512.doFinal(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder hash = new StringBuilder(bytes.length * 2);
            for (byte b : bytes) {
                hash.append(String.format("%02x", b));
            }
            return hash.toString();
        } catch (Exception ex) {
            throw new AppException(HttpStatus.INTERNAL_SERVER_ERROR, MessageCode.COMMON_INTERNAL_ERROR);
        }
    }

    private boolean acquireActionLock(String action, PaymentActionRequest request) {
        String normalizedOrderCode = normalizeOrderCode(request.getOrderCode());
        String requestScopedIdempotencyKey = resolveRequestScopedIdempotencyKey(request);
        String redisKey = "payment:idempotency:" + action + ":" + normalizedOrderCode + ":" + requestScopedIdempotencyKey;

        try {
            Boolean acquired = stringRedisTemplate.opsForValue().setIfAbsent(
                    redisKey,
                    "1",
                    Duration.ofSeconds(idempotencyTtlSeconds)
            );
            return Boolean.TRUE.equals(acquired);
        } catch (Exception ex) {
            LOGGER.warn("Redis idempotency lock unavailable. Continue without lock. key={}", redisKey, ex);
            return true;
        }
    }

    private String resolveRequestScopedIdempotencyKey(PaymentActionRequest request) {
        String normalized = trimToNull(request.getIdempotencyKey());
        if (StringUtils.hasText(normalized)) {
            return normalized;
        }
        return "default";
    }

    private void publishPaymentEvent(PaymentTransaction paymentTransaction) {
        String topic;
        String eventType;

        if (paymentTransaction.getStatus() == PaymentStatusEnum.SUCCESS) {
            topic = topicPaymentSucceeded;
            eventType = "PaymentTransactionSucceeded";
        } else if (paymentTransaction.getStatus() == PaymentStatusEnum.FAILED) {
            topic = topicPaymentFailed;
            eventType = "PaymentTransactionFailed";
        } else {
            return;
        }

        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("paymentId", paymentTransaction.getId());
            payload.put("paymentUuid", paymentTransaction.getUuid());
            payload.put("orderCode", paymentTransaction.getOrderCode());
            payload.put("customerId", paymentTransaction.getCustomerId());
            payload.put("status", paymentTransaction.getStatus().name());
            payload.put("method", paymentTransaction.getMethod().name());
            payload.put("amount", paymentTransaction.getAmount());
            payload.put("currency", paymentTransaction.getCurrency());
            payload.put("providerTransactionId", paymentTransaction.getProviderTransactionId());
            payload.put("actor", paymentTransaction.getActor());
            payload.put("note", paymentTransaction.getNote());
            payload.put("createdAt", paymentTransaction.getCreatedAt());
            payload.put("updatedAt", paymentTransaction.getUpdatedAt());

            Map<String, Object> envelope = new LinkedHashMap<>();
            envelope.put("eventId", UUID.randomUUID().toString());
            envelope.put("eventType", eventType);
            envelope.put("eventVersion", "v1");
            envelope.put("occurredAt", LocalDateTime.now());
            envelope.put("source", "payment-service");
            envelope.put("correlationId", paymentTransaction.getOrderCode());
            envelope.put("payload", payload);

            kafkaTemplate.send(
                    topic,
                    paymentTransaction.getOrderCode(),
                    objectMapper.writeValueAsString(envelope)
            );
        } catch (Exception ex) {
            LOGGER.warn(
                    "Failed to publish payment event. topic={}, orderCode={}, status={}",
                    topic,
                    paymentTransaction.getOrderCode(),
                    paymentTransaction.getStatus(),
                    ex
            );
        }
    }

    private PaymentTransactionResponse mapToResponse(PaymentTransaction paymentTransaction, boolean replayed) {
        return PaymentTransactionResponse.builder()
                .paymentId(paymentTransaction.getId())
                .paymentUuid(paymentTransaction.getUuid())
                .orderCode(paymentTransaction.getOrderCode())
                .customerId(paymentTransaction.getCustomerId())
                .amount(paymentTransaction.getAmount())
                .currency(paymentTransaction.getCurrency())
                .method(paymentTransaction.getMethod())
                .status(paymentTransaction.getStatus())
                .providerTransactionId(paymentTransaction.getProviderTransactionId())
                .paymentUrl(paymentTransaction.getPaymentUrl())
                .canSucceedInDemo(paymentTransaction.getMethod() == PaymentMethodEnum.VNPAY)
                .replayed(replayed)
                .actor(paymentTransaction.getActor())
                .note(paymentTransaction.getNote())
                .createdAt(paymentTransaction.getCreatedAt())
                .updatedAt(paymentTransaction.getUpdatedAt())
                .build();
    }
}
