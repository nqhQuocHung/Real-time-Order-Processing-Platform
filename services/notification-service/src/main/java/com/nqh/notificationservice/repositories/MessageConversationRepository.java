package com.nqh.notificationservice.repositories;

import com.nqh.notificationservice.pojos.MessageConversation;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MessageConversationRepository extends JpaRepository<MessageConversation, UUID> {

    Optional<MessageConversation> findByIsActiveTrueAndUserIdAndPartnerId(UUID userId, UUID partnerId);

    Optional<MessageConversation> findByIsActiveTrueAndId(UUID conversationId);

    Page<MessageConversation> findByIsActiveTrueAndUserIdOrderByUpdatedAtDesc(UUID userId, Pageable pageable);

    Page<MessageConversation> findByIsActiveTrueAndPartnerIdOrderByUpdatedAtDesc(UUID partnerId, Pageable pageable);
}
