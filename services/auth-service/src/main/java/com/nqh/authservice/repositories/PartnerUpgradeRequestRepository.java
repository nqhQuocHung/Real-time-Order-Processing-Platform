package com.nqh.authservice.repositories;

import com.nqh.authservice.enums.PartnerRequestStatusEnum;
import com.nqh.authservice.pojos.PartnerUpgradeRequest;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PartnerUpgradeRequestRepository extends JpaRepository<PartnerUpgradeRequest, UUID> {

    @EntityGraph(attributePaths = {"user"})
    Page<PartnerUpgradeRequest> findByStatusOrderByCreatedAtDesc(
            PartnerRequestStatusEnum status,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {"user"})
    Page<PartnerUpgradeRequest> findAllByOrderByCreatedAtDesc(Pageable pageable);

    @EntityGraph(attributePaths = {"user"})
    Optional<PartnerUpgradeRequest> findTopByUserIdOrderByCreatedAtDesc(UUID userId);

    boolean existsByUserIdAndStatus(UUID userId, PartnerRequestStatusEnum status);

    @EntityGraph(attributePaths = {"user"})
    Optional<PartnerUpgradeRequest> findById(UUID id);
}
