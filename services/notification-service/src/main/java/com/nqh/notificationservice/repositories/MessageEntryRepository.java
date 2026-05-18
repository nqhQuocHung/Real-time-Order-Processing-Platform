package com.nqh.notificationservice.repositories;

import com.nqh.notificationservice.pojos.MessageEntry;
import java.time.LocalDateTime;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MessageEntryRepository extends JpaRepository<MessageEntry, UUID> {

    Page<MessageEntry> findByIsActiveTrueAndConversation_IdOrderByCreatedAtDesc(UUID conversationId, Pageable pageable);

    long countByIsActiveTrueAndConversation_IdAndRecipientIdAndIsReadFalse(UUID conversationId, UUID recipientId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update MessageEntry entry
            set entry.isRead = true,
                entry.readAt = :readAt
            where entry.conversation.id = :conversationId
              and entry.recipientId = :recipientId
              and entry.isRead = false
              and entry.isActive = true
            """)
    int markConversationAsRead(
            @Param("conversationId") UUID conversationId,
            @Param("recipientId") UUID recipientId,
            @Param("readAt") LocalDateTime readAt
    );
}
