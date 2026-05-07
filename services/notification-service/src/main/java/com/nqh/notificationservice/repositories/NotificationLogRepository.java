package com.nqh.notificationservice.repositories;

import com.nqh.notificationservice.pojos.NotificationLog;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface NotificationLogRepository extends JpaRepository<NotificationLog, UUID>, JpaSpecificationExecutor<NotificationLog> {
    Optional<NotificationLog> findByNotificationCode(String notificationCode);
}
