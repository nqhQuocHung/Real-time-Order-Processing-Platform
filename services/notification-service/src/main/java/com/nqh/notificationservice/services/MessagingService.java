package com.nqh.notificationservice.services;

import com.nqh.notificationservice.dtos.MarkMessageConversationReadResponse;
import com.nqh.notificationservice.dtos.MessageConversationListResponse;
import com.nqh.notificationservice.dtos.MessageConversationResponse;
import com.nqh.notificationservice.dtos.MessageEntryListResponse;
import com.nqh.notificationservice.dtos.MessageEntryResponse;
import com.nqh.notificationservice.dtos.OpenMessageConversationRequest;
import com.nqh.notificationservice.dtos.SendMessageRequest;
import com.nqh.notificationservice.enums.MessageParticipantRoleEnum;
import java.util.UUID;

public interface MessagingService {

    MessageConversationResponse openConversation(
            UUID currentUserId,
            String currentUserName,
            MessageParticipantRoleEnum currentRole,
            OpenMessageConversationRequest request
    );

    MessageConversationListResponse getConversations(
            UUID currentUserId,
            MessageParticipantRoleEnum currentRole,
            int page,
            int size
    );

    MessageEntryListResponse getConversationMessages(
            UUID currentUserId,
            MessageParticipantRoleEnum currentRole,
            UUID conversationId,
            int page,
            int size,
            boolean markAsRead
    );

    MessageEntryResponse sendMessage(
            UUID currentUserId,
            String currentUserName,
            MessageParticipantRoleEnum currentRole,
            UUID conversationId,
            SendMessageRequest request
    );

    MarkMessageConversationReadResponse markConversationAsRead(
            UUID currentUserId,
            MessageParticipantRoleEnum currentRole,
            UUID conversationId
    );
}
