package com.nqh.authservice.repositories;

import com.nqh.authservice.enums.TokenTypeEnum;
import com.nqh.authservice.pojos.RefreshToken;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

    Optional<RefreshToken> findByTokenHashAndTokenTypeAndRevokedAtIsNull(
            String tokenHash,
            TokenTypeEnum tokenType
    );

    List<RefreshToken> findByUserIdAndTokenTypeAndRevokedAtIsNull(UUID userId, TokenTypeEnum tokenType);

    List<RefreshToken> findByUserIdAndTokenTypeAndRevokedAtIsNullAndExpiresAtAfter(
            UUID userId,
            TokenTypeEnum tokenType,
            LocalDateTime now
    );
}
