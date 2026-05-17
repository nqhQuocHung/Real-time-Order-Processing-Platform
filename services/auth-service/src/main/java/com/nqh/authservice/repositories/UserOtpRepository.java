package com.nqh.authservice.repositories;

import com.nqh.authservice.enums.OtpPurposeEnum;
import com.nqh.authservice.pojos.UserOtp;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserOtpRepository extends JpaRepository<UserOtp, UUID> {

    Optional<UserOtp> findByUserIdAndPurpose(UUID userId, OtpPurposeEnum purpose);
}
