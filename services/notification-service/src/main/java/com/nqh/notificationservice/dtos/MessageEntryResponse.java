package com.nqh.notificationservice.dtos;

import com.nqh.notificationservice.enums.MessageParticipantRoleEnum;
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
public class MessageEntryResponse {
    private UUID messageId;
    private UUID messageUuid;
    private UUID conversationId;
    private UUID senderId;
    private MessageParticipantRoleEnum senderRole;
    private String senderName;
    private UUID recipientId;
    private String content;
    private Boolean isRead;
    private LocalDateTime readAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
