package com.nqh.notificationservice.services.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nqh.notificationservice.common.exception.AppException;
import com.nqh.notificationservice.common.messages.MessageCode;
import com.nqh.notificationservice.dtos.CreateNotificationRequest;
import com.nqh.notificationservice.dtos.NotificationListResponse;
import com.nqh.notificationservice.dtos.NotificationLogResponse;
import com.nqh.notificationservice.dtos.UpdateNotificationStatusRequest;
import com.nqh.notificationservice.enums.NotificationChannelEnum;
import com.nqh.notificationservice.enums.NotificationStatusEnum;
import com.nqh.notificationservice.pojos.NotificationLog;
import com.nqh.notificationservice.repositories.NotificationLogRepository;
import com.nqh.notificationservice.services.NotificationService;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.EnumSet;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
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
public class NotificationServiceImpl implements NotificationService {

    private static final DateTimeFormatter NOTIFICATION_CODE_TIME_PATTERN = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private static final Random RANDOM = new Random();
    private static final String NOTIFICATION_CODE_PREFIX = "NOTI";
    private static final Map<NotificationStatusEnum, Set<NotificationStatusEnum>> ALLOWED_TRANSITIONS = Map.of(
            NotificationStatusEnum.PENDING, EnumSet.of(NotificationStatusEnum.SENT, NotificationStatusEnum.FAILED, NotificationStatusEnum.CANCELLED),
            NotificationStatusEnum.FAILED, EnumSet.of(NotificationStatusEnum.SENT, NotificationStatusEnum.CANCELLED),
            NotificationStatusEnum.SENT, EnumSet.noneOf(NotificationStatusEnum.class),
            NotificationStatusEnum.CANCELLED, EnumSet.noneOf(NotificationStatusEnum.class)
    );

    private final NotificationLogRepository notificationLogRepository;
    private final ObjectMapper objectMapper;
    private final String defaultRecipient;

    public NotificationServiceImpl(
            NotificationLogRepository notificationLogRepository,
            ObjectMapper objectMapper,
            @Value("${app.notification.default-recipient:no-reply@example.local}") String defaultRecipient
    ) {
        this.notificationLogRepository = notificationLogRepository;
        this.objectMapper = objectMapper;
        this.defaultRecipient = defaultRecipient;
    }

    @Override
    @Transactional
    public NotificationLogResponse createNotification(CreateNotificationRequest request) {
        NotificationLog notificationLog = NotificationLog.builder()
                .notificationCode(generateNotificationCode())
                .orderCode(normalizeRequired(request.getOrderCode(), MessageCode.NOTI_ORDER_CODE_REQUIRED, 64))
                .eventType(normalizeRequired(request.getEventType(), MessageCode.NOTI_EVENT_TYPE_REQUIRED, 120))
                .channel(request.getChannel())
                .recipient(normalizeRequired(request.getRecipient(), MessageCode.NOTI_RECIPIENT_REQUIRED, 255))
                .title(trimToMaxLength(request.getTitle(), 255))
                .content(normalizeRequired(request.getContent(), MessageCode.NOTI_CONTENT_REQUIRED, 2000))
                .status(NotificationStatusEnum.PENDING)
                .provider(trimToMaxLength(request.getProvider(), 120))
                .actor(trimToMaxLength(request.getActor(), 120))
                .note(trimToMaxLength(request.getNote(), 255))
                .build();

        NotificationLog saved = notificationLogRepository.save(notificationLog);
        return mapToResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public NotificationLogResponse getNotificationByCode(String notificationCode) {
        NotificationLog notificationLog = findByCodeOrThrow(notificationCode);
        return mapToResponse(notificationLog);
    }

    @Override
    @Transactional(readOnly = true)
    public NotificationListResponse getNotifications(
            String orderCode,
            NotificationStatusEnum status,
            NotificationChannelEnum channel,
            LocalDateTime createdFrom,
            LocalDateTime createdTo,
            int page,
            int size
    ) {
        validateDateRange(createdFrom, createdTo);

        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Specification<NotificationLog> specification = buildSpecification(orderCode, status, channel, createdFrom, createdTo);
        Page<NotificationLog> notificationPage = notificationLogRepository.findAll(specification, pageable);

        return NotificationListResponse.builder()
                .content(notificationPage.getContent().stream().map(this::mapToResponse).toList())
                .page(notificationPage.getNumber())
                .size(notificationPage.getSize())
                .totalElements(notificationPage.getTotalElements())
                .totalPages(notificationPage.getTotalPages())
                .last(notificationPage.isLast())
                .build();
    }

    @Override
    @Transactional
    public NotificationLogResponse updateNotificationStatus(String notificationCode, UpdateNotificationStatusRequest request) {
        NotificationLog notificationLog = findByCodeOrThrow(notificationCode);
        NotificationStatusEnum currentStatus = notificationLog.getStatus();
        NotificationStatusEnum targetStatus = request.getStatus();

        if (currentStatus != targetStatus
                && !ALLOWED_TRANSITIONS.getOrDefault(currentStatus, Set.of()).contains(targetStatus)) {
            throw new AppException(HttpStatus.CONFLICT, MessageCode.NOTI_STATUS_TRANSITION_INVALID);
        }

        notificationLog.setStatus(targetStatus);
        notificationLog.setProviderMessageId(trimToMaxLength(request.getProviderMessageId(), 120));
        notificationLog.setActor(trimToMaxLength(request.getActor(), 120));
        notificationLog.setNote(trimToMaxLength(request.getNote(), 255));
        notificationLog.setErrorMessage(trimToMaxLength(request.getErrorMessage(), 500));

        if (targetStatus == NotificationStatusEnum.SENT && notificationLog.getSentAt() == null) {
            notificationLog.setSentAt(LocalDateTime.now());
        }
        if (targetStatus != NotificationStatusEnum.FAILED) {
            notificationLog.setErrorMessage(null);
        }

        NotificationLog saved = notificationLogRepository.save(notificationLog);
        return mapToResponse(saved);
    }

    @Override
    @Transactional
    public NotificationLogResponse logNotificationFromEvent(String topic, String eventType, String rawMessage) {
        JsonNode rootNode = parseJsonNode(rawMessage);
        String orderCode = firstNonBlank(
                extractField(rootNode, "payload.orderCode"),
                extractField(rootNode, "payload.orderId"),
                extractField(rootNode, "orderCode"),
                extractField(rootNode, "orderId"),
                "UNKNOWN"
        );
        String recipient = firstNonBlank(
                extractField(rootNode, "payload.recipient"),
                extractField(rootNode, "payload.customerEmail"),
                extractField(rootNode, "recipient"),
                extractField(rootNode, "customerEmail"),
                defaultRecipient
        );

        NotificationLog notificationLog = NotificationLog.builder()
                .notificationCode(generateNotificationCode())
                .orderCode(trimToMaxLength(orderCode, 64))
                .eventType(trimToMaxLength(eventType, 120))
                .channel(NotificationChannelEnum.EMAIL)
                .recipient(trimToMaxLength(recipient, 255))
                .title(trimToMaxLength(buildTitle(eventType), 255))
                .content(trimToMaxLength(buildEventContent(rawMessage), 2000))
                .status(NotificationStatusEnum.SENT)
                .provider("KAFKA_EVENT")
                .actor("NOTIFICATION_CONSUMER")
                .note(trimToMaxLength("topic=" + topic, 255))
                .sentAt(LocalDateTime.now())
                .build();

        NotificationLog saved = notificationLogRepository.save(notificationLog);
        return mapToResponse(saved);
    }

    private JsonNode parseJsonNode(String rawMessage) {
        if (!StringUtils.hasText(rawMessage)) {
            return null;
        }
        try {
            return objectMapper.readTree(rawMessage);
        } catch (Exception ex) {
            return null;
        }
    }

    private String extractField(JsonNode rootNode, String path) {
        if (rootNode == null || !StringUtils.hasText(path)) {
            return null;
        }

        JsonNode current = rootNode;
        String[] segments = path.split("\\.");
        for (String segment : segments) {
            if (current == null) {
                return null;
            }
            current = current.get(segment);
        }

        if (current == null || current.isNull()) {
            return null;
        }
        return current.asText();
    }

    private String buildTitle(String eventType) {
        return "Notification for " + eventType;
    }

    private String buildEventContent(String rawMessage) {
        if (!StringUtils.hasText(rawMessage)) {
            return "Event received with empty payload";
        }
        return "Event payload: " + rawMessage.trim();
    }

    private NotificationLog findByCodeOrThrow(String notificationCode) {
        String normalizedCode = normalizeRequired(notificationCode, MessageCode.NOTI_NOTIFICATION_CODE_REQUIRED, 80);
        return notificationLogRepository.findByNotificationCode(normalizedCode)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, MessageCode.NOTI_NOT_FOUND));
    }

    private void validateDateRange(LocalDateTime createdFrom, LocalDateTime createdTo) {
        if (createdFrom != null && createdTo != null && createdFrom.isAfter(createdTo)) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.NOTI_DATE_RANGE_INVALID);
        }
    }

    private Specification<NotificationLog> buildSpecification(
            String orderCode,
            NotificationStatusEnum status,
            NotificationChannelEnum channel,
            LocalDateTime createdFrom,
            LocalDateTime createdTo
    ) {
        Specification<NotificationLog> specification = Specification.where(null);

        if (StringUtils.hasText(orderCode)) {
            specification = specification.and((root, query, cb) -> cb.equal(root.get("orderCode"), orderCode.trim()));
        }
        if (status != null) {
            specification = specification.and((root, query, cb) -> cb.equal(root.get("status"), status));
        }
        if (channel != null) {
            specification = specification.and((root, query, cb) -> cb.equal(root.get("channel"), channel));
        }
        if (createdFrom != null) {
            specification = specification.and((root, query, cb) -> cb.greaterThanOrEqualTo(root.get("createdAt"), createdFrom));
        }
        if (createdTo != null) {
            specification = specification.and((root, query, cb) -> cb.lessThanOrEqualTo(root.get("createdAt"), createdTo));
        }

        return specification;
    }

    private String generateNotificationCode() {
        int suffix = RANDOM.nextInt(1_000_000);
        String timestamp = LocalDateTime.now().format(NOTIFICATION_CODE_TIME_PATTERN);
        return String.format(
                Locale.ROOT,
                "%s-%s-%06d",
                NOTIFICATION_CODE_PREFIX,
                timestamp,
                suffix
        );
    }

    private String normalizeRequired(String value, MessageCode messageCode, int maxLength) {
        if (!StringUtils.hasText(value)) {
            throw new AppException(HttpStatus.BAD_REQUEST, messageCode);
        }
        String normalized = value.trim();
        if (normalized.length() > maxLength) {
            return normalized.substring(0, maxLength);
        }
        return normalized;
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

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (StringUtils.hasText(value)) {
                return value.trim();
            }
        }
        return null;
    }

    private NotificationLogResponse mapToResponse(NotificationLog notificationLog) {
        return NotificationLogResponse.builder()
                .notificationId(notificationLog.getId())
                .notificationUuid(notificationLog.getUuid())
                .notificationCode(notificationLog.getNotificationCode())
                .orderCode(notificationLog.getOrderCode())
                .eventType(notificationLog.getEventType())
                .channel(notificationLog.getChannel())
                .recipient(notificationLog.getRecipient())
                .title(notificationLog.getTitle())
                .content(notificationLog.getContent())
                .status(notificationLog.getStatus())
                .provider(notificationLog.getProvider())
                .providerMessageId(notificationLog.getProviderMessageId())
                .actor(notificationLog.getActor())
                .note(notificationLog.getNote())
                .errorMessage(notificationLog.getErrorMessage())
                .sentAt(notificationLog.getSentAt())
                .createdAt(notificationLog.getCreatedAt())
                .updatedAt(notificationLog.getUpdatedAt())
                .build();
    }
}
