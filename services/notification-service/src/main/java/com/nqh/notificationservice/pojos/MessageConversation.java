package com.nqh.notificationservice.pojos;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "message_conversations", schema = "notification")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class MessageConversation extends BasePojo {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @EqualsAndHashCode.Include
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "user_display_name", length = 120)
    private String userDisplayName;

    @Column(name = "partner_id", nullable = false)
    private UUID partnerId;

    @Column(name = "partner_display_name", length = 120)
    private String partnerDisplayName;

    @Column(name = "product_id")
    private UUID productId;

    @Column(name = "product_name", length = 255)
    private String productName;

    @Column(name = "last_message_preview", length = 500)
    private String lastMessagePreview;

    @Column(name = "last_message_sender_id")
    private UUID lastMessageSenderId;

    @Column(name = "last_message_sender_name", length = 120)
    private String lastMessageSenderName;

    @Column(name = "last_message_at")
    private LocalDateTime lastMessageAt;
}
