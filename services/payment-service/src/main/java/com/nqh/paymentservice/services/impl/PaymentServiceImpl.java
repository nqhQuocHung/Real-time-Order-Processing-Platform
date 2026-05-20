package com.nqh.paymentservice.services.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nqh.paymentservice.common.exception.AppException;
import com.nqh.paymentservice.common.messages.MessageCode;
import com.nqh.paymentservice.configurations.VnpayProperties;
import com.nqh.paymentservice.dtos.CreatePaymentIntentRequest;
import com.nqh.paymentservice.dtos.PaymentActionRequest;
import com.nqh.paymentservice.dtos.PaymentRefundRequest;
import com.nqh.paymentservice.dtos.PaymentRefundResponse;
import com.nqh.paymentservice.dtos.PaymentTransactionResponse;
import com.nqh.paymentservice.enums.PaymentMethodEnum;
import com.nqh.paymentservice.enums.PaymentRefundStatusEnum;
import com.nqh.paymentservice.enums.PaymentStatusEnum;
import com.nqh.paymentservice.pojos.PaymentRefund;
import com.nqh.paymentservice.pojos.PaymentTransaction;
import com.nqh.paymentservice.repositories.PaymentRefundRepository;
import com.nqh.paymentservice.repositories.PaymentTransactionRepository;
import com.nqh.paymentservice.services.PaymentService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
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
    private static final ZoneId VNPAY_TIME_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final int VNPAY_TXN_REF_MAX_LENGTH = 100;

    private final PaymentTransactionRepository paymentTransactionRepository;
    private final PaymentRefundRepository paymentRefundRepository;
    private final VnpayProperties vnpayProperties;
    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final long idempotencyTtlSeconds;
    private final String topicPaymentSucceeded;
    private final String topicPaymentFailed;
    private final String topicPaymentRefundSucceeded;
    private final String topicPaymentRefundFailed;

    public PaymentServiceImpl(
            PaymentTransactionRepository paymentTransactionRepository,
            PaymentRefundRepository paymentRefundRepository,
            VnpayProperties vnpayProperties,
            StringRedisTemplate stringRedisTemplate,
            ObjectMapper objectMapper,
            KafkaTemplate<String, String> kafkaTemplate,
            @org.springframework.beans.factory.annotation.Value("${app.payment.idempotency.ttl-seconds:300}") long idempotencyTtlSeconds,
            @org.springframework.beans.factory.annotation.Value("${app.payment.topic.transaction-succeeded:payment.transaction.succeeded.v1}") String topicPaymentSucceeded,
            @org.springframework.beans.factory.annotation.Value("${app.payment.topic.transaction-failed:payment.transaction.failed.v1}") String topicPaymentFailed,
            @org.springframework.beans.factory.annotation.Value("${app.payment.topic.refund-succeeded:payment.refund.succeeded.v1}") String topicPaymentRefundSucceeded,
            @org.springframework.beans.factory.annotation.Value("${app.payment.topic.refund-failed:payment.refund.failed.v1}") String topicPaymentRefundFailed
    ) {
        this.paymentTransactionRepository = paymentTransactionRepository;
        this.paymentRefundRepository = paymentRefundRepository;
        this.vnpayProperties = vnpayProperties;
        this.stringRedisTemplate = stringRedisTemplate;
        this.objectMapper = objectMapper;
        this.kafkaTemplate = kafkaTemplate;
        this.idempotencyTtlSeconds = idempotencyTtlSeconds;
        this.topicPaymentSucceeded = topicPaymentSucceeded;
        this.topicPaymentFailed = topicPaymentFailed;
        this.topicPaymentRefundSucceeded = topicPaymentRefundSucceeded;
        this.topicPaymentRefundFailed = topicPaymentRefundFailed;
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
                .paymentUrl(buildPaymentUrl(
                        request.getMethod(),
                        orderCode,
                        request.getAmount(),
                        request.getCurrency(),
                        providerTransactionId
                ))
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

    @Override
    @Transactional
    public PaymentRefundResponse refundPayment(PaymentRefundRequest request) {
        validateRefundRequest(request);

        PaymentTransaction paymentTransaction = findByOrderCodeOrThrow(request.getOrderCode());
        if (paymentTransaction.getStatus() != PaymentStatusEnum.SUCCESS) {
            throw new AppException(HttpStatus.CONFLICT, MessageCode.PAYMENT_REFUND_NOT_ALLOWED);
        }
        if (paymentTransaction.getMethod() != PaymentMethodEnum.VNPAY) {
            throw new AppException(HttpStatus.CONFLICT, MessageCode.PAYMENT_REFUND_METHOD_NOT_SUPPORTED);
        }

        PaymentRefund existingRefundByOrder = paymentRefundRepository.findByOrderCode(paymentTransaction.getOrderCode())
                .orElse(null);
        if (existingRefundByOrder != null) {
            return mapToRefundResponse(existingRefundByOrder);
        }

        PaymentRefund existingRefundByIdempotency = paymentRefundRepository
                .findByIdempotencyKey(request.getIdempotencyKey().trim())
                .orElse(null);
        if (existingRefundByIdempotency != null) {
            return mapToRefundResponse(existingRefundByIdempotency);
        }

        BigDecimal refundAmount = resolveRefundAmount(request.getRefundAmount(), paymentTransaction.getAmount());
        PaymentRefund refund = PaymentRefund.builder()
                .paymentTransaction(paymentTransaction)
                .orderCode(paymentTransaction.getOrderCode())
                .customerId(paymentTransaction.getCustomerId())
                .amount(refundAmount)
                .currency(resolveRefundCurrency(request.getCurrency(), paymentTransaction.getCurrency()))
                .refundAccountName(request.getRefundAccountName().trim())
                .refundAccountNumber(request.getRefundAccountNumber().trim())
                .refundBankCode(request.getRefundBankCode().trim().toUpperCase(Locale.ROOT))
                .refundReason(request.getRefundReason().trim())
                .status(PaymentRefundStatusEnum.REQUESTED)
                .providerRefundId(null)
                .refundUrl(null)
                .actor(resolveActor(request.getActor()))
                .idempotencyKey(request.getIdempotencyKey().trim())
                .note(trimToNull(request.getNote()))
                .processedAt(null)
                .build();

        try {
            String providerRefundId = buildProviderRefundId(paymentTransaction.getOrderCode());
            String refundUrl = buildRefundUrl(
                    paymentTransaction.getOrderCode(),
                    refundAmount,
                    refund.getCurrency(),
                    providerRefundId
            );
            refund.setStatus(PaymentRefundStatusEnum.REFUNDED);
            refund.setProviderRefundId(providerRefundId);
            refund.setRefundUrl(refundUrl);
            refund.setProcessedAt(LocalDateTime.now());
            if (paymentTransaction.getMethod() == PaymentMethodEnum.VNPAY) {
                refund.setNote(mergeNote(refund.getNote(), "VNPAY refund executed"));
            }
            PaymentRefund saved = paymentRefundRepository.save(refund);
            publishPaymentRefundEvent(saved);
            return mapToRefundResponse(saved);
        } catch (Exception ex) {
            refund.setStatus(PaymentRefundStatusEnum.FAILED);
            refund.setProcessedAt(LocalDateTime.now());
            refund.setNote(mergeNote(refund.getNote(), trimToNull(ex.getMessage())));
            PaymentRefund failed = paymentRefundRepository.save(refund);
            publishPaymentRefundEvent(failed);
            throw new AppException(HttpStatus.BAD_GATEWAY, MessageCode.PAYMENT_REFUND_EXECUTION_FAILED);
        }
    }

    private PaymentTransaction findByOrderCodeOrThrow(String orderCode) {
        String normalized = normalizeOrderCode(orderCode);
        return paymentTransactionRepository.findByOrderCode(normalized)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, MessageCode.PAYMENT_NOT_FOUND));
    }

    private void validateRefundRequest(PaymentRefundRequest request) {
        if (!StringUtils.hasText(request.getIdempotencyKey())) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.PAYMENT_REFUND_IDEMPOTENCY_KEY_REQUIRED);
        }
        if (!StringUtils.hasText(request.getRefundAccountName())
                || !StringUtils.hasText(request.getRefundAccountNumber())
                || !StringUtils.hasText(request.getRefundBankCode())) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.PAYMENT_REFUND_ACCOUNT_INFO_REQUIRED);
        }
        if (!StringUtils.hasText(request.getRefundReason())) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.COMMON_BAD_REQUEST);
        }
    }

    private BigDecimal resolveRefundAmount(BigDecimal requestedAmount, BigDecimal paymentAmount) {
        BigDecimal baseAmount = paymentAmount != null
                ? paymentAmount.setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

        if (requestedAmount == null) {
            return baseAmount;
        }

        BigDecimal normalized = requestedAmount.setScale(2, RoundingMode.HALF_UP);
        if (normalized.signum() <= 0 || normalized.compareTo(baseAmount) > 0) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.PAYMENT_REFUND_INVALID_AMOUNT);
        }
        return normalized;
    }

    private String resolveRefundCurrency(String requestedCurrency, String paymentCurrency) {
        String normalizedPaymentCurrency = normalizeCurrency(paymentCurrency);
        String normalizedRequestCurrency = trimToNull(requestedCurrency);
        if (!StringUtils.hasText(normalizedRequestCurrency)) {
            return normalizedPaymentCurrency;
        }

        String upper = normalizedRequestCurrency.toUpperCase(Locale.ROOT);
        if (!upper.equals(normalizedPaymentCurrency)) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.PAYMENT_REFUND_INVALID_AMOUNT);
        }
        return upper;
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

        LocalDateTime now = LocalDateTime.now(VNPAY_TIME_ZONE);
        String createDate = now.format(VNPAY_DATE_FORMAT);
        String expireDate = now.plusMinutes(15).format(VNPAY_DATE_FORMAT);

        String currCode = normalizeCurrency(currency);
        if (!"VND".equals(currCode)) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.COMMON_BAD_REQUEST);
        }

        long amountInMinorUnit = amount
                .setScale(2, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
                .longValueExact();

        Map<String, String> params = new TreeMap<>();
        putIfHasText(params, "vnp_Amount", String.valueOf(amountInMinorUnit));
        putIfHasText(params, "vnp_Command", vnpayProperties.getCommand());
        putIfHasText(params, "vnp_CreateDate", createDate);
        putIfHasText(params, "vnp_CurrCode", currCode);
        putIfHasText(params, "vnp_ExpireDate", expireDate);
        putIfHasText(params, "vnp_IpAddr", "127.0.0.1");
        putIfHasText(params, "vnp_Locale", vnpayProperties.getLocale());
        putIfHasText(params, "vnp_OrderInfo", buildVnpayOrderInfo(orderCode));
        putIfHasText(params, "vnp_OrderType", vnpayProperties.getOrderType());
        putIfHasText(params, "vnp_ReturnUrl", vnpayProperties.getReturnUrl());
        putIfHasText(params, "vnp_TmnCode", vnpayProperties.getTmnCode());
        putIfHasText(params, "vnp_TxnRef", normalizeTxnRef(providerTransactionId));
        putIfHasText(params, "vnp_Version", vnpayProperties.getVersion());

        validateRequiredVnpParams(params);

        String hashData = buildHashData(params);
        String secureHash = hmacSha512(trimToNull(vnpayProperties.getHashSecret()), hashData);

        String queryString = buildQueryString(params);
        String payUrl = trimToNull(vnpayProperties.getPayUrl());
        if (payUrl == null) {
            throw new AppException(HttpStatus.INTERNAL_SERVER_ERROR, MessageCode.COMMON_INTERNAL_ERROR);
        }

        LOGGER.debug("VNPAY hashData={}", hashData);

        return payUrl + "?" + queryString + "&vnp_SecureHash=" + secureHash;
    }

    private String buildProviderTransactionId(PaymentMethodEnum method, String orderCode) {
        if (method != PaymentMethodEnum.VNPAY) {
            return null;
        }
        return buildTxnRef(orderCode, LocalDateTime.now(VNPAY_TIME_ZONE));
    }

    private String buildTxnRef(String orderCode, LocalDateTime now) {
        String normalizedOrderCode = normalizeAlphaNumeric(orderCode);
        String timestamp = now.format(REFERENCE_TIME_FORMAT);
        String prefix = "VNP";
        int remaining = VNPAY_TXN_REF_MAX_LENGTH - prefix.length() - timestamp.length();
        if (remaining < 1) {
            throw new AppException(HttpStatus.INTERNAL_SERVER_ERROR, MessageCode.COMMON_INTERNAL_ERROR);
        }

        if (normalizedOrderCode.length() > remaining) {
            normalizedOrderCode = normalizedOrderCode.substring(normalizedOrderCode.length() - remaining);
        }

        return prefix + normalizedOrderCode + timestamp;
    }

    private String buildProviderRefundId(String orderCode) {
        String normalizedOrderCode = normalizeAlphaNumeric(orderCode);
        String timestamp = LocalDateTime.now(VNPAY_TIME_ZONE).format(REFERENCE_TIME_FORMAT);
        String prefix = "RFD";
        int remaining = VNPAY_TXN_REF_MAX_LENGTH - prefix.length() - timestamp.length();
        if (remaining < 1) {
            throw new AppException(HttpStatus.INTERNAL_SERVER_ERROR, MessageCode.COMMON_INTERNAL_ERROR);
        }

        if (normalizedOrderCode.length() > remaining) {
            normalizedOrderCode = normalizedOrderCode.substring(normalizedOrderCode.length() - remaining);
        }

        return prefix + normalizedOrderCode + timestamp;
    }

    private String urlEncode(String input) {
        return URLEncoder.encode(input, StandardCharsets.UTF_8);
    }

    private String buildHashData(Map<String, String> params) {
        return params.entrySet().stream()
                .map(entry -> entry.getKey() + "=" + urlEncode(entry.getValue()))
                .collect(Collectors.joining("&"));
    }

    private String buildQueryString(Map<String, String> params) {
        return params.entrySet().stream()
                .map(entry -> entry.getKey() + "=" + urlEncode(entry.getValue()))
                .collect(Collectors.joining("&"));
    }

    private String hmacSha512(String key, String data) {
        try {
            if (!StringUtils.hasText(key)) {
                throw new AppException(HttpStatus.INTERNAL_SERVER_ERROR, MessageCode.COMMON_INTERNAL_ERROR);
            }

            Mac hmac512 = Mac.getInstance("HmacSHA512");
            SecretKeySpec secretKey = new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA512");
            hmac512.init(secretKey);

            byte[] bytes = hmac512.doFinal(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder hash = new StringBuilder(bytes.length * 2);
            for (byte b : bytes) {
                hash.append(String.format("%02x", b));
            }
            return hash.toString();
        } catch (AppException ex) {
            throw ex;
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

    private void putIfHasText(Map<String, String> target, String key, String value) {
        String normalized = trimToNull(value);
        if (normalized != null) {
            target.put(key, normalized);
        }
    }

    private String normalizeAlphaNumeric(String value) {
        String normalized = trimToNull(value);
        if (normalized == null) {
            return UUID.randomUUID().toString().replace("-", "").toUpperCase(Locale.ROOT);
        }

        String compact = normalized.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
        if (!StringUtils.hasText(compact)) {
            return UUID.randomUUID().toString().replace("-", "").toUpperCase(Locale.ROOT);
        }
        return compact;
    }

    private String normalizeTxnRef(String txnRef) {
        String normalized = normalizeAlphaNumeric(txnRef);
        if (normalized.length() <= VNPAY_TXN_REF_MAX_LENGTH) {
            return normalized;
        }
        return normalized.substring(normalized.length() - VNPAY_TXN_REF_MAX_LENGTH);
    }

    private String buildVnpayOrderInfo(String orderCode) {
        String normalizedOrderCode = normalizeAlphaNumeric(orderCode);
        return "Thanh toan don hang " + normalizedOrderCode;
    }

    private String buildVnpayRefundOrderInfo(String orderCode) {
        String normalizedOrderCode = normalizeAlphaNumeric(orderCode);
        return "Hoan tien don hang " + normalizedOrderCode;
    }

    private String buildRefundUrl(
            String orderCode,
            BigDecimal amount,
            String currency,
            String providerRefundId
    ) {
        if (!StringUtils.hasText(providerRefundId) || !StringUtils.hasText(vnpayProperties.getPayUrl())) {
            return null;
        }

        LocalDateTime now = LocalDateTime.now(VNPAY_TIME_ZONE);
        String createDate = now.format(VNPAY_DATE_FORMAT);
        String expireDate = now.plusMinutes(15).format(VNPAY_DATE_FORMAT);

        String currCode = normalizeCurrency(currency);
        if (!"VND".equals(currCode)) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.COMMON_BAD_REQUEST);
        }

        long amountInMinorUnit = amount
                .setScale(2, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
                .longValueExact();

        Map<String, String> params = new TreeMap<>();
        putIfHasText(params, "vnp_Amount", String.valueOf(amountInMinorUnit));
        putIfHasText(params, "vnp_Command", vnpayProperties.getCommand());
        putIfHasText(params, "vnp_CreateDate", createDate);
        putIfHasText(params, "vnp_CurrCode", currCode);
        putIfHasText(params, "vnp_ExpireDate", expireDate);
        putIfHasText(params, "vnp_IpAddr", "127.0.0.1");
        putIfHasText(params, "vnp_Locale", vnpayProperties.getLocale());
        putIfHasText(params, "vnp_OrderInfo", buildVnpayRefundOrderInfo(orderCode));
        putIfHasText(params, "vnp_OrderType", vnpayProperties.getOrderType());
        putIfHasText(params, "vnp_ReturnUrl", buildRefundReturnUrl());
        putIfHasText(params, "vnp_TmnCode", vnpayProperties.getTmnCode());
        putIfHasText(params, "vnp_TxnRef", normalizeTxnRef(providerRefundId));
        putIfHasText(params, "vnp_Version", vnpayProperties.getVersion());

        validateRequiredVnpParams(params);

        String hashData = buildHashData(params);
        String secureHash = hmacSha512(trimToNull(vnpayProperties.getHashSecret()), hashData);
        String queryString = buildQueryString(params);

        return vnpayProperties.getPayUrl().trim() + "?" + queryString + "&vnp_SecureHash=" + secureHash;
    }

    private String buildRefundReturnUrl() {
        String baseReturnUrl = trimToNull(vnpayProperties.getReturnUrl());
        if (!StringUtils.hasText(baseReturnUrl)) {
            throw new AppException(HttpStatus.INTERNAL_SERVER_ERROR, MessageCode.COMMON_INTERNAL_ERROR);
        }

        String separator = baseReturnUrl.contains("?") ? "&" : "?";
        return baseReturnUrl
                + separator
                + "paymentContext=refund"
                + "&returnTargetPath=%2Fpartner%2Forders";
    }

    private String normalizeCurrency(String currency) {
        String normalized = trimToNull(currency);
        if (normalized == null) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.COMMON_BAD_REQUEST);
        }
        return normalized.toUpperCase(Locale.ROOT);
    }

    private void validateRequiredVnpParams(Map<String, String> params) {
        String[] requiredKeys = {
                "vnp_Version",
                "vnp_Command",
                "vnp_TmnCode",
                "vnp_Amount",
                "vnp_CurrCode",
                "vnp_TxnRef",
                "vnp_OrderInfo",
                "vnp_OrderType",
                "vnp_Locale",
                "vnp_ReturnUrl",
                "vnp_IpAddr",
                "vnp_CreateDate",
                "vnp_ExpireDate"
        };

        for (String key : requiredKeys) {
            String value = params.get(key);
            if (!StringUtils.hasText(value)) {
                throw new AppException(HttpStatus.INTERNAL_SERVER_ERROR, MessageCode.COMMON_INTERNAL_ERROR);
            }
        }
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

    private void publishPaymentRefundEvent(PaymentRefund paymentRefund) {
        String topic;
        String eventType;
        if (paymentRefund.getStatus() == PaymentRefundStatusEnum.REFUNDED) {
            topic = topicPaymentRefundSucceeded;
            eventType = "PaymentRefundSucceeded";
        } else if (paymentRefund.getStatus() == PaymentRefundStatusEnum.FAILED) {
            topic = topicPaymentRefundFailed;
            eventType = "PaymentRefundFailed";
        } else {
            return;
        }

        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("refundId", paymentRefund.getId());
            payload.put("refundUuid", paymentRefund.getUuid());
            payload.put("paymentId", paymentRefund.getPaymentTransaction().getId());
            payload.put("orderCode", paymentRefund.getOrderCode());
            payload.put("customerId", paymentRefund.getCustomerId());
            payload.put("amount", paymentRefund.getAmount());
            payload.put("currency", paymentRefund.getCurrency());
            payload.put("status", paymentRefund.getStatus().name());
            payload.put("providerRefundId", paymentRefund.getProviderRefundId());
            payload.put("refundUrl", paymentRefund.getRefundUrl());
            payload.put("refundBankCode", paymentRefund.getRefundBankCode());
            payload.put("refundAccountNumberMasked", maskAccountNumber(paymentRefund.getRefundAccountNumber()));
            payload.put("refundReason", paymentRefund.getRefundReason());
            payload.put("actor", paymentRefund.getActor());
            payload.put("note", paymentRefund.getNote());
            payload.put("processedAt", paymentRefund.getProcessedAt());
            payload.put("createdAt", paymentRefund.getCreatedAt());
            payload.put("updatedAt", paymentRefund.getUpdatedAt());

            Map<String, Object> envelope = new LinkedHashMap<>();
            envelope.put("eventId", UUID.randomUUID().toString());
            envelope.put("eventType", eventType);
            envelope.put("eventVersion", "v1");
            envelope.put("occurredAt", LocalDateTime.now());
            envelope.put("source", "payment-service");
            envelope.put("correlationId", paymentRefund.getOrderCode());
            envelope.put("payload", payload);

            kafkaTemplate.send(
                    topic,
                    paymentRefund.getOrderCode(),
                    objectMapper.writeValueAsString(envelope)
            );
        } catch (Exception ex) {
            LOGGER.warn(
                    "Failed to publish payment refund event. topic={}, orderCode={}, status={}",
                    topic,
                    paymentRefund.getOrderCode(),
                    paymentRefund.getStatus(),
                    ex
            );
        }
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

    private PaymentRefundResponse mapToRefundResponse(PaymentRefund paymentRefund) {
        return PaymentRefundResponse.builder()
                .refundId(paymentRefund.getId())
                .refundUuid(paymentRefund.getUuid())
                .paymentId(paymentRefund.getPaymentTransaction().getId())
                .orderCode(paymentRefund.getOrderCode())
                .customerId(paymentRefund.getCustomerId())
                .amount(paymentRefund.getAmount())
                .currency(paymentRefund.getCurrency())
                .status(paymentRefund.getStatus())
                .providerRefundId(paymentRefund.getProviderRefundId())
                .refundUrl(paymentRefund.getRefundUrl())
                .actor(paymentRefund.getActor())
                .idempotencyKey(paymentRefund.getIdempotencyKey())
                .note(paymentRefund.getNote())
                .processedAt(paymentRefund.getProcessedAt())
                .createdAt(paymentRefund.getCreatedAt())
                .updatedAt(paymentRefund.getUpdatedAt())
                .build();
    }
}
