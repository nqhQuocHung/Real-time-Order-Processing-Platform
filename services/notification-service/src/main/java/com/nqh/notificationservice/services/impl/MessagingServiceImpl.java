package com.nqh.notificationservice.services.impl;

import com.nqh.notificationservice.common.exception.AppException;
import com.nqh.notificationservice.common.messages.MessageCode;
import com.nqh.notificationservice.dtos.MarkMessageConversationReadResponse;
import com.nqh.notificationservice.dtos.MessageConversationListResponse;
import com.nqh.notificationservice.dtos.MessageConversationResponse;
import com.nqh.notificationservice.dtos.MessageEntryListResponse;
import com.nqh.notificationservice.dtos.MessageEntryResponse;
import com.nqh.notificationservice.dtos.OpenMessageConversationRequest;
import com.nqh.notificationservice.dtos.SendMessageRequest;
import com.nqh.notificationservice.enums.MessageParticipantRoleEnum;
import com.nqh.notificationservice.pojos.MessageConversation;
import com.nqh.notificationservice.pojos.MessageEntry;
import com.nqh.notificationservice.repositories.MessageConversationRepository;
import com.nqh.notificationservice.repositories.MessageEntryRepository;
import com.nqh.notificationservice.services.AdminSseService;
import com.nqh.notificationservice.services.MessagingService;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class MessagingServiceImpl implements MessagingService {

    private static final int MAX_MESSAGE_PREVIEW_LENGTH = 500;

    private final MessageConversationRepository messageConversationRepository;
    private final MessageEntryRepository messageEntryRepository;
    private final AdminSseService adminSseService;

    public MessagingServiceImpl(
            MessageConversationRepository messageConversationRepository,
            MessageEntryRepository messageEntryRepository,
            AdminSseService adminSseService
    ) {
        this.messageConversationRepository = messageConversationRepository;
        this.messageEntryRepository = messageEntryRepository;
        this.adminSseService = adminSseService;
    }

    @Override
    @Transactional
    public MessageConversationResponse openConversation(
            UUID currentUserId,
            String currentUserName,
            MessageParticipantRoleEnum currentRole,
            OpenMessageConversationRequest request
    ) {
        if (currentUserId == null || request == null || request.getPartnerUserId() == null) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.COMMON_BAD_REQUEST);
        }

        if (request.getPartnerUserId().equals(currentUserId)) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.MSG_SELF_CONVERSATION_NOT_ALLOWED);
        }

        if (currentRole == MessageParticipantRoleEnum.ADMIN) {
            throw new AppException(HttpStatus.FORBIDDEN, MessageCode.MSG_ADMIN_NOT_SUPPORTED);
        }

        UUID userId = currentRole == MessageParticipantRoleEnum.PARTNER
                ? request.getPartnerUserId()
                : currentUserId;
        UUID partnerId = currentRole == MessageParticipantRoleEnum.PARTNER
                ? currentUserId
                : request.getPartnerUserId();

        MessageConversation conversation = messageConversationRepository
                .findByIsActiveTrueAndUserIdAndPartnerId(userId, partnerId)
                .orElseGet(() -> MessageConversation.builder()
                        .userId(userId)
                        .partnerId(partnerId)
                        .build());

        if (currentRole == MessageParticipantRoleEnum.PARTNER) {
            conversation.setPartnerDisplayName(firstNonBlank(currentUserName, conversation.getPartnerDisplayName()));
            conversation.setUserDisplayName(firstNonBlank(trimToNull(request.getPartnerDisplayName()), conversation.getUserDisplayName()));
        } else {
            conversation.setUserDisplayName(firstNonBlank(currentUserName, conversation.getUserDisplayName()));
            conversation.setPartnerDisplayName(firstNonBlank(trimToNull(request.getPartnerDisplayName()), conversation.getPartnerDisplayName()));
        }

        conversation.setProductId(null);
        conversation.setProductName(null);

        MessageConversation savedConversation = messageConversationRepository.save(conversation);
        return mapConversation(savedConversation, currentUserId);
    }

    @Override
    @Transactional(readOnly = true)
    public MessageConversationListResponse getConversations(
            UUID currentUserId,
            MessageParticipantRoleEnum currentRole,
            int page,
            int size
    ) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), sanitizePageSize(size));

        Page<MessageConversation> conversationPage;
        if (currentRole == MessageParticipantRoleEnum.PARTNER) {
            conversationPage = messageConversationRepository.findByIsActiveTrueAndPartnerIdOrderByUpdatedAtDesc(currentUserId, pageable);
        } else {
            conversationPage = messageConversationRepository.findByIsActiveTrueAndUserIdOrderByUpdatedAtDesc(currentUserId, pageable);
        }

        List<MessageConversationResponse> content = conversationPage.getContent()
                .stream()
                .map(conversation -> mapConversation(conversation, currentUserId))
                .toList();

        return MessageConversationListResponse.builder()
                .content(content)
                .page(conversationPage.getNumber())
                .size(conversationPage.getSize())
                .totalElements(conversationPage.getTotalElements())
                .totalPages(conversationPage.getTotalPages())
                .last(conversationPage.isLast())
                .build();
    }

    @Override
    @Transactional
    public MessageEntryListResponse getConversationMessages(
            UUID currentUserId,
            MessageParticipantRoleEnum currentRole,
            UUID conversationId,
            int page,
            int size,
            boolean markAsRead
    ) {
        MessageConversation conversation = findAuthorizedConversation(currentUserId, currentRole, conversationId);
        if (markAsRead) {
            messageEntryRepository.markConversationAsRead(conversation.getId(), currentUserId, LocalDateTime.now());
        }

        Pageable pageable = PageRequest.of(Math.max(page, 0), sanitizePageSize(size));
        Page<MessageEntry> messagePage = messageEntryRepository
                .findByIsActiveTrueAndConversation_IdOrderByCreatedAtDesc(conversation.getId(), pageable);

        List<MessageEntry> descendingMessages = messagePage.getContent();
        List<MessageEntryResponse> content = new ArrayList<>(descendingMessages.size());
        for (int index = descendingMessages.size() - 1; index >= 0; index--) {
            content.add(mapMessage(descendingMessages.get(index)));
        }

        return MessageEntryListResponse.builder()
                .content(content)
                .page(messagePage.getNumber())
                .size(messagePage.getSize())
                .totalElements(messagePage.getTotalElements())
                .totalPages(messagePage.getTotalPages())
                .last(messagePage.isLast())
                .build();
    }

    @Override
    @Transactional
    public MessageEntryResponse sendMessage(
            UUID currentUserId,
            String currentUserName,
            MessageParticipantRoleEnum currentRole,
            UUID conversationId,
            SendMessageRequest request
    ) {
        MessageConversation conversation = findAuthorizedConversation(currentUserId, currentRole, conversationId);
        String content = trimToNull(request != null ? request.getContent() : null);
        if (content == null) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.COMMON_BAD_REQUEST);
        }

        UUID recipientId = resolveRecipientId(conversation, currentUserId);
        MessageEntry entry = MessageEntry.builder()
                .conversation(conversation)
                .senderId(currentUserId)
                .senderRole(currentRole)
                .senderName(trimToNull(currentUserName))
                .recipientId(recipientId)
                .content(content)
                .build();
        MessageEntry savedEntry = messageEntryRepository.save(entry);

        conversation.setLastMessagePreview(buildMessagePreview(content));
        conversation.setLastMessageSenderId(currentUserId);
        conversation.setLastMessageSenderName(firstNonBlank(trimToNull(currentUserName), conversation.getLastMessageSenderName()));
        conversation.setLastMessageAt(savedEntry.getCreatedAt() != null ? savedEntry.getCreatedAt() : LocalDateTime.now());
        if (currentRole == MessageParticipantRoleEnum.PARTNER && trimToNull(currentUserName) != null) {
            conversation.setPartnerDisplayName(trimToNull(currentUserName));
        }
        if (currentRole == MessageParticipantRoleEnum.USER && trimToNull(currentUserName) != null) {
            conversation.setUserDisplayName(trimToNull(currentUserName));
        }
        messageConversationRepository.save(conversation);

        MessageEntryResponse response = mapMessage(savedEntry);
        pushRealtimeMessageEvent(conversation, response, recipientId, currentUserId);
        return response;
    }

    @Override
    @Transactional
    public MarkMessageConversationReadResponse markConversationAsRead(
            UUID currentUserId,
            MessageParticipantRoleEnum currentRole,
            UUID conversationId
    ) {
        MessageConversation conversation = findAuthorizedConversation(currentUserId, currentRole, conversationId);
        int markedCount = messageEntryRepository.markConversationAsRead(conversation.getId(), currentUserId, LocalDateTime.now());
        return MarkMessageConversationReadResponse.builder()
                .conversationId(conversation.getId())
                .markedCount(markedCount)
                .build();
    }

    private MessageConversation findAuthorizedConversation(
            UUID currentUserId,
            MessageParticipantRoleEnum currentRole,
            UUID conversationId
    ) {
        if (conversationId == null || currentUserId == null) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.COMMON_BAD_REQUEST);
        }

        MessageConversation conversation = messageConversationRepository
                .findByIsActiveTrueAndId(conversationId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, MessageCode.MSG_CONVERSATION_NOT_FOUND));

        boolean isParticipant = conversation.getUserId() != null && conversation.getUserId().equals(currentUserId)
                || conversation.getPartnerId() != null && conversation.getPartnerId().equals(currentUserId);
        if (!isParticipant && currentRole != MessageParticipantRoleEnum.ADMIN) {
            throw new AppException(HttpStatus.FORBIDDEN, MessageCode.MSG_CONVERSATION_FORBIDDEN);
        }
        return conversation;
    }

    private UUID resolveRecipientId(MessageConversation conversation, UUID senderId) {
        if (conversation.getUserId() != null && conversation.getUserId().equals(senderId)) {
            return conversation.getPartnerId();
        }
        return conversation.getUserId();
    }

    private MessageConversationResponse mapConversation(MessageConversation conversation, UUID currentUserId) {
        long unreadCount = messageEntryRepository.countByIsActiveTrueAndConversation_IdAndRecipientIdAndIsReadFalse(
                conversation.getId(),
                currentUserId
        );
        return MessageConversationResponse.builder()
                .conversationId(conversation.getId())
                .conversationUuid(conversation.getUuid())
                .userId(conversation.getUserId())
                .userDisplayName(conversation.getUserDisplayName())
                .partnerId(conversation.getPartnerId())
                .partnerDisplayName(conversation.getPartnerDisplayName())
                .productId(conversation.getProductId())
                .productName(conversation.getProductName())
                .lastMessagePreview(conversation.getLastMessagePreview())
                .lastMessageSenderId(conversation.getLastMessageSenderId())
                .lastMessageSenderName(conversation.getLastMessageSenderName())
                .lastMessageAt(conversation.getLastMessageAt())
                .unreadCount(unreadCount)
                .createdAt(conversation.getCreatedAt())
                .updatedAt(conversation.getUpdatedAt())
                .build();
    }

    private MessageEntryResponse mapMessage(MessageEntry entry) {
        return MessageEntryResponse.builder()
                .messageId(entry.getId())
                .messageUuid(entry.getUuid())
                .conversationId(entry.getConversation() != null ? entry.getConversation().getId() : null)
                .senderId(entry.getSenderId())
                .senderRole(entry.getSenderRole())
                .senderName(entry.getSenderName())
                .recipientId(entry.getRecipientId())
                .content(entry.getContent())
                .isRead(entry.getIsRead())
                .readAt(entry.getReadAt())
                .createdAt(entry.getCreatedAt())
                .updatedAt(entry.getUpdatedAt())
                .build();
    }

    private void pushRealtimeMessageEvent(
            MessageConversation conversation,
            MessageEntryResponse message,
            UUID recipientUserId,
            UUID senderUserId
    ) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("conversationId", conversation.getId());
        payload.put("userId", conversation.getUserId());
        payload.put("userDisplayName", conversation.getUserDisplayName());
        payload.put("partnerId", conversation.getPartnerId());
        payload.put("partnerDisplayName", conversation.getPartnerDisplayName());
        payload.put("productId", conversation.getProductId());
        payload.put("productName", conversation.getProductName());
        payload.put("lastMessageAt", conversation.getLastMessageAt());
        payload.put("message", message);

        if (recipientUserId != null) {
            adminSseService.sendToUser(recipientUserId.toString(), "chat.message.created", payload);
        }
        if (senderUserId != null) {
            adminSseService.sendToUser(senderUserId.toString(), "chat.message.created", payload);
        }
    }

    private int sanitizePageSize(int requestedSize) {
        if (requestedSize <= 0) {
            return 20;
        }
        return Math.min(requestedSize, 100);
    }

    private String buildMessagePreview(String messageContent) {
        if (messageContent.length() <= MAX_MESSAGE_PREVIEW_LENGTH) {
            return messageContent;
        }
        return messageContent.substring(0, MAX_MESSAGE_PREVIEW_LENGTH);
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (StringUtils.hasText(value)) {
                return value.trim();
            }
        }
        return null;
    }

    private String trimToNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }
}
