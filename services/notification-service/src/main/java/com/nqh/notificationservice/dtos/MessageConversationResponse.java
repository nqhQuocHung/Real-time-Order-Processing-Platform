package com.nqh.notificationservice.dtos;

import java.time.LocalDateTime;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MessageConversationResponse {
    private UUID conversationId;
    private UUID conversationUuid;
    private UUID userId;
    private String userDisplayName;
    private UUID partnerId;
    private String partnerDisplayName;
    private UUID productId;
    private String productName;
    private String lastMessagePreview;
    private UUID lastMessageSenderId;
    private String lastMessageSenderName;
    private LocalDateTime lastMessageAt;
    private long unreadCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
