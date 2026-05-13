package com.nqh.authservice.services.impl;

import com.nqh.authservice.common.exception.AppException;
import com.nqh.authservice.common.messages.MessageCode;
import com.nqh.authservice.configurations.MailTemplateProperties;
import com.nqh.authservice.dtos.ActivateUserResponse;
import com.nqh.authservice.dtos.AdminUserListResponse;
import com.nqh.authservice.dtos.AdminUserStatisticsResponse;
import com.nqh.authservice.dtos.AdminUserSummaryResponse;
import com.nqh.authservice.dtos.CheckRoleResponse;
import com.nqh.authservice.dtos.ChangePasswordOtpRequest;
import com.nqh.authservice.dtos.ChangePasswordOtpResponse;
import com.nqh.authservice.dtos.ChangePasswordRequest;
import com.nqh.authservice.dtos.ChangePasswordResponse;
import com.nqh.authservice.dtos.CreateMenuRequest;
import com.nqh.authservice.dtos.CreatePartnerUpgradeRequest;
import com.nqh.authservice.dtos.CreateRoleRequest;
import com.nqh.authservice.dtos.ForgotPasswordOtpRequest;
import com.nqh.authservice.dtos.ForgotPasswordOtpResponse;
import com.nqh.authservice.dtos.ForgotPasswordRequest;
import com.nqh.authservice.dtos.ForgotPasswordResponse;
import com.nqh.authservice.dtos.GrantPermissionRequest;
import com.nqh.authservice.dtos.GrantPermissionResponse;
import com.nqh.authservice.dtos.LoginRequest;
import com.nqh.authservice.dtos.LoginResponse;
import com.nqh.authservice.dtos.MenuSummaryResponse;
import com.nqh.authservice.dtos.RefreshTokenRequest;
import com.nqh.authservice.dtos.RefreshTokenResponse;
import com.nqh.authservice.dtos.RegisterRequest;
import com.nqh.authservice.dtos.RegisterResponse;
import com.nqh.authservice.dtos.MenuItemResponse;
import com.nqh.authservice.dtos.PermissionSummaryResponse;
import com.nqh.authservice.dtos.PartnerUpgradeRequestDecisionRequest;
import com.nqh.authservice.dtos.PartnerUpgradeRequestListResponse;
import com.nqh.authservice.dtos.PartnerUpgradeRequestResponse;
import com.nqh.authservice.dtos.RoleSummaryResponse;
import com.nqh.authservice.dtos.UpdateRoleMenusRequest;
import com.nqh.authservice.dtos.UpdateMenuRequest;
import com.nqh.authservice.dtos.UpdateUserRequest;
import com.nqh.authservice.dtos.UpdateUserResponse;
import com.nqh.authservice.dtos.UserProfileResponse;
import com.nqh.authservice.enums.GenderEnum;
import com.nqh.authservice.enums.OtpPurposeEnum;
import com.nqh.authservice.enums.PartnerRequestDecisionActionEnum;
import com.nqh.authservice.enums.PartnerRequestStatusEnum;
import com.nqh.authservice.enums.TokenTypeEnum;
import com.nqh.authservice.enums.UserStatusEnum;
import com.nqh.authservice.kafka.producers.PartnerKafkaProducer;
import com.nqh.authservice.pojos.RefreshToken;
import com.nqh.authservice.pojos.Permission;
import com.nqh.authservice.pojos.PartnerUpgradeRequest;
import com.nqh.authservice.pojos.Role;
import com.nqh.authservice.pojos.Menu;
import com.nqh.authservice.pojos.User;
import com.nqh.authservice.pojos.UserOtp;
import com.nqh.authservice.repositories.MenuRepository;
import com.nqh.authservice.repositories.PartnerUpgradeRequestRepository;
import com.nqh.authservice.repositories.PermissionRepository;
import com.nqh.authservice.repositories.RefreshTokenRepository;
import com.nqh.authservice.repositories.RoleRepository;
import com.nqh.authservice.repositories.UserOtpRepository;
import com.nqh.authservice.repositories.UserRepository;
import com.nqh.authservice.services.AuthService;
import com.nqh.authservice.services.EmailService;
import com.nqh.authservice.services.JwtTokenProvider;
import com.nqh.authservice.services.UploadService;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final MenuRepository menuRepository;
    private final PartnerUpgradeRequestRepository partnerUpgradeRequestRepository;
    private final PermissionRepository permissionRepository;
    private final UserOtpRepository userOtpRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final UploadService uploadService;
    private final EmailService emailService;
    private final MailTemplateProperties mailTemplateProperties;
    private final String defaultRoleCode;
    private final String adminRoleCode;
    private final String defaultAvatarUrl;
    private final int maxOtpFailedAttempts;
    private final int changePasswordOtpExpirationMinutes;
    private final int forgotPasswordOtpExpirationMinutes;

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private final PartnerKafkaProducer partnerKafkaProducer;

    public AuthServiceImpl(
            UserRepository userRepository,
            RoleRepository roleRepository,
            MenuRepository menuRepository,
            PartnerUpgradeRequestRepository partnerUpgradeRequestRepository,
            PermissionRepository permissionRepository,
            UserOtpRepository userOtpRepository,
            RefreshTokenRepository refreshTokenRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenProvider jwtTokenProvider,
            UploadService uploadService,
            EmailService emailService,
            MailTemplateProperties mailTemplateProperties,
            @Value("${app.default-role:USER}") String defaultRoleCode,
            @Value("${app.admin-role:ADMIN}") String adminRoleCode,
            @Value("${app.avatar.default-url:}") String defaultAvatarUrl,
            @Value("${MAX.OTP.FAILED.ATTEMPTS:5}") int maxOtpFailedAttempts,
            @Value("${app.otp.change-password-expiration-minutes:5}") int changePasswordOtpExpirationMinutes,
            @Value("${app.otp.forgot-password-expiration-minutes:10}") int forgotPasswordOtpExpirationMinutes,
            PartnerKafkaProducer partnerKafkaProducer

    ) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.menuRepository = menuRepository;
        this.partnerUpgradeRequestRepository = partnerUpgradeRequestRepository;
        this.permissionRepository = permissionRepository;
        this.userOtpRepository = userOtpRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
        this.uploadService = uploadService;
        this.emailService = emailService;
        this.mailTemplateProperties = mailTemplateProperties;
        this.defaultRoleCode = defaultRoleCode;
        this.adminRoleCode = adminRoleCode;
        this.defaultAvatarUrl = defaultAvatarUrl;
        this.maxOtpFailedAttempts = maxOtpFailedAttempts;
        this.changePasswordOtpExpirationMinutes = changePasswordOtpExpirationMinutes;
        this.forgotPasswordOtpExpirationMinutes = forgotPasswordOtpExpirationMinutes;
        this.partnerKafkaProducer = partnerKafkaProducer;
    }

    @Override
    @Transactional
    public RegisterResponse register(RegisterRequest request) {
        if (userRepository.existsByUsernameIgnoreCase(request.getUsername())) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.AUTH_USERNAME_ALREADY_EXISTS);
        }
        if (userRepository.existsByEmailIgnoreCase(request.getEmail())) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.AUTH_EMAIL_ALREADY_EXISTS);
        }
        if (StringUtils.hasText(request.getPhone()) && userRepository.existsByPhone(request.getPhone())) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.AUTH_PHONE_ALREADY_EXISTS);
        }

        Role role = roleRepository.findByCodeIgnoreCase(defaultRoleCode)
                .orElseGet(() -> roleRepository.save(Role.builder()
                        .code(defaultRoleCode.toUpperCase())
                        .name(defaultRoleCode.toUpperCase())
                        .build()));

        String avatarUrl = defaultAvatarUrl;
        MultipartFile avatar = request.getAvatar();
        if (avatar != null && !avatar.isEmpty()) {
            avatarUrl = uploadService.uploadAvatar(avatar);
        }

        User user = User.builder()
                .username(request.getUsername().trim())
                .email(request.getEmail().trim().toLowerCase())
                .phone(StringUtils.hasText(request.getPhone()) ? request.getPhone().trim() : null)
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .avatar(avatarUrl)
                .status(UserStatusEnum.PENDING_VERIFICATION)
                .emailVerified(false)
                .failedLoginCount(0)
                .lastLoginAt(null)
                .gender(request.getGender() != null ? request.getGender() : GenderEnum.UNKNOWN)
                .roles(Set.of(role))
                .build();

        user.setIsActive(Boolean.FALSE);

        User savedUser = userRepository.save(user);
        sendRegisterSuccessEmail(savedUser);

        return RegisterResponse.builder()
                .userId(savedUser.getId())
                .username(savedUser.getUsername())
                .email(savedUser.getEmail())
                .isActive(savedUser.getIsActive())
                .build();
    }

    @Override
    @Transactional
    public LoginResponse login(LoginRequest request) {
        User user = userRepository
                .findGraphByUsernameIgnoreCaseOrEmailIgnoreCase(request.getUsernameOrEmail(), request.getUsernameOrEmail())
                .orElseThrow(() -> new AppException(HttpStatus.UNAUTHORIZED, MessageCode.AUTH_INVALID_CREDENTIALS));

        if (user.getStatus() == UserStatusEnum.LOCKED || user.getStatus() == UserStatusEnum.DISABLED) {
            throw new AppException(HttpStatus.FORBIDDEN, MessageCode.AUTH_USER_LOCKED);
        }

        if (!Boolean.TRUE.equals(user.getIsActive())) {
            throw new AppException(HttpStatus.FORBIDDEN, MessageCode.AUTH_USER_INACTIVE);
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            int failedCount = user.getFailedLoginCount() == null ? 1 : user.getFailedLoginCount() + 1;
            user.setFailedLoginCount(failedCount);

            boolean shouldLockAccount = failedCount >= maxOtpFailedAttempts;
            if (shouldLockAccount) {
                user.setStatus(UserStatusEnum.LOCKED);
            }
            User savedUser = userRepository.save(user);

            if (shouldLockAccount) {
                sendAccountLockedEmail(savedUser);
            }
            throw new AppException(HttpStatus.UNAUTHORIZED, MessageCode.AUTH_INVALID_CREDENTIALS);
        }

        String accessToken = jwtTokenProvider.generateAccessToken(user);
        String refreshToken = jwtTokenProvider.generateRefreshToken(user);

        LocalDateTime now = LocalDateTime.now();
        user.setFailedLoginCount(0);
        user.setLastLoginAt(now);
        userRepository.save(user);

        persistToken(
                user,
                accessToken,
                TokenTypeEnum.ACCESS,
                now.plus(Duration.ofMillis(jwtTokenProvider.getExpirationMillis()))
        );
        persistToken(
                user,
                refreshToken,
                TokenTypeEnum.REFRESH,
                now.plus(Duration.ofMillis(jwtTokenProvider.getRefreshExpirationMillis()))
        );

        return LoginResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType(jwtTokenProvider.getTokenType())
                .expiresIn(jwtTokenProvider.getExpirationMillis())
                .userId(user.getId().toString())
                .username(user.getUsername())
                .email(user.getEmail())
                .build();
    }

    @Override
    @Transactional
    public ChangePasswordOtpResponse sendChangePasswordOtp(ChangePasswordOtpRequest request) {
        User user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, MessageCode.AUTH_USER_NOT_FOUND));

        if (!passwordEncoder.matches(request.getOldPassword(), user.getPasswordHash())) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.AUTH_OLD_PASSWORD_INCORRECT);
        }

        String otp = generateNumericOtp(6);
        LocalDateTime expiresAt = LocalDateTime.now().plusMinutes(changePasswordOtpExpirationMinutes);

        UserOtp userOtp = userOtpRepository
                .findByUserIdAndPurpose(user.getId(), OtpPurposeEnum.CHANGE_PASSWORD)
                .orElseGet(() -> UserOtp.builder()
                        .user(user)
                        .purpose(OtpPurposeEnum.CHANGE_PASSWORD)
                        .failedAttempts(0)
                        .resendCount(0)
                        .used(false)
                        .build());

        int resendCount = userOtp.getResendCount() == null ? 0 : userOtp.getResendCount();
        userOtp.setResendCount(userOtp.getId() == null ? 0 : resendCount + 1);
        userOtp.setFailedAttempts(0);
        userOtp.setUsed(false);
        userOtp.setOtpCodeHash(passwordEncoder.encode(otp));
        userOtp.setExpiresAt(expiresAt);
        userOtpRepository.save(userOtp);

        sendChangePasswordOtpEmail(user, otp, changePasswordOtpExpirationMinutes);

        return ChangePasswordOtpResponse.builder()
                .userId(user.getId())
                .email(user.getEmail())
                .expiresAt(expiresAt)
                .message(MessageCode.AUTH_CHANGE_PASSWORD_OTP_SENT.name())
                .build();
    }

    @Override
    @Transactional
    public ChangePasswordResponse changePassword(ChangePasswordRequest request) {
        User user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, MessageCode.AUTH_USER_NOT_FOUND));

        UserOtp userOtp = userOtpRepository
                .findByUserIdAndPurpose(user.getId(), OtpPurposeEnum.CHANGE_PASSWORD)
                .orElseThrow(() -> new AppException(HttpStatus.BAD_REQUEST, MessageCode.AUTH_OTP_REQUIRED));

        validateOtpState(userOtp);

        if (!passwordEncoder.matches(request.getOtp(), userOtp.getOtpCodeHash())) {
            int failedAttempts = userOtp.getFailedAttempts() == null ? 0 : userOtp.getFailedAttempts();
            int updatedFailedAttempts = failedAttempts + 1;
            userOtp.setFailedAttempts(updatedFailedAttempts);
            userOtpRepository.save(userOtp);

            if (updatedFailedAttempts >= maxOtpFailedAttempts) {
                throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.AUTH_OTP_LOCKED);
            }
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.AUTH_OTP_INVALID);
        }

        if (passwordEncoder.matches(request.getNewPassword(), user.getPasswordHash())) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.AUTH_NEW_PASSWORD_SAME_AS_OLD);
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setFailedLoginCount(0);
        if (user.getStatus() == UserStatusEnum.LOCKED && Boolean.TRUE.equals(user.getIsActive())) {
            user.setStatus(UserStatusEnum.ACTIVE);
        }
        userRepository.save(user);

        userOtp.setUsed(true);
        userOtp.setFailedAttempts(0);
        userOtpRepository.save(userOtp);

        LocalDateTime now = LocalDateTime.now();
        revokeActiveAccessTokens(user.getId(), now);
        revokeActiveRefreshTokens(user.getId(), now);

        return ChangePasswordResponse.builder()
                .userId(user.getId())
                .message(MessageCode.AUTH_CHANGE_PASSWORD_SUCCESS.name())
                .build();
    }

    @Override
    @Transactional
    public ForgotPasswordOtpResponse sendForgotPasswordOtp(ForgotPasswordOtpRequest request) {
        User user = findUserByUsernameOrEmail(request.getUsernameOrEmail());

        String otp = generateNumericOtp(6);
        LocalDateTime expiresAt = LocalDateTime.now().plusMinutes(forgotPasswordOtpExpirationMinutes);

        UserOtp userOtp = userOtpRepository
                .findByUserIdAndPurpose(user.getId(), OtpPurposeEnum.FORGOT_PASSWORD)
                .orElseGet(() -> UserOtp.builder()
                        .user(user)
                        .purpose(OtpPurposeEnum.FORGOT_PASSWORD)
                        .failedAttempts(0)
                        .resendCount(0)
                        .used(false)
                        .build());

        int resendCount = userOtp.getResendCount() == null ? 0 : userOtp.getResendCount();
        userOtp.setResendCount(userOtp.getId() == null ? 0 : resendCount + 1);
        userOtp.setFailedAttempts(0);
        userOtp.setUsed(false);
        userOtp.setOtpCodeHash(passwordEncoder.encode(otp));
        userOtp.setExpiresAt(expiresAt);
        userOtpRepository.save(userOtp);

        sendForgotPasswordOtpEmail(user, otp, forgotPasswordOtpExpirationMinutes);

        return ForgotPasswordOtpResponse.builder()
                .userId(user.getId())
                .email(user.getEmail())
                .expiresAt(expiresAt)
                .message(MessageCode.AUTH_FORGOT_PASSWORD_OTP_SENT.name())
                .build();
    }

    @Override
    @Transactional
    public ForgotPasswordResponse forgotPassword(ForgotPasswordRequest request) {
        User user = findUserByUsernameOrEmail(request.getUsernameOrEmail());

        UserOtp userOtp = userOtpRepository
                .findByUserIdAndPurpose(user.getId(), OtpPurposeEnum.FORGOT_PASSWORD)
                .orElseThrow(() -> new AppException(HttpStatus.BAD_REQUEST, MessageCode.AUTH_OTP_REQUIRED));

        validateOtpState(userOtp);

        if (!passwordEncoder.matches(request.getOtp(), userOtp.getOtpCodeHash())) {
            int failedAttempts = userOtp.getFailedAttempts() == null ? 0 : userOtp.getFailedAttempts();
            int updatedFailedAttempts = failedAttempts + 1;
            userOtp.setFailedAttempts(updatedFailedAttempts);
            userOtpRepository.save(userOtp);

            if (updatedFailedAttempts >= maxOtpFailedAttempts) {
                throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.AUTH_OTP_LOCKED);
            }
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.AUTH_OTP_INVALID);
        }

        if (passwordEncoder.matches(request.getNewPassword(), user.getPasswordHash())) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.AUTH_NEW_PASSWORD_SAME_AS_OLD);
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setFailedLoginCount(0);
        if (user.getStatus() == UserStatusEnum.LOCKED && Boolean.TRUE.equals(user.getIsActive())) {
            user.setStatus(UserStatusEnum.ACTIVE);
        }
        userRepository.save(user);

        userOtp.setUsed(true);
        userOtp.setFailedAttempts(0);
        userOtpRepository.save(userOtp);

        LocalDateTime now = LocalDateTime.now();
        revokeActiveAccessTokens(user.getId(), now);
        revokeActiveRefreshTokens(user.getId(), now);

        return ForgotPasswordResponse.builder()
                .userId(user.getId())
                .message(MessageCode.AUTH_FORGOT_PASSWORD_SUCCESS.name())
                .build();
    }

    @Override
    @Transactional
    public RefreshTokenResponse refreshToken(RefreshTokenRequest request) {
        if (request == null || !StringUtils.hasText(request.getRefreshToken())) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.AUTH_REFRESH_TOKEN_REQUIRED);
        }

        String rawRefreshToken = request.getRefreshToken().trim();
        UUID userId;
        try {
            userId = jwtTokenProvider.extractUserId(rawRefreshToken);
        } catch (Exception ex) {
            throw new AppException(HttpStatus.UNAUTHORIZED, MessageCode.AUTH_INVALID_TOKEN);
        }

        User user = userRepository.findGraphById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.UNAUTHORIZED, MessageCode.AUTH_INVALID_TOKEN));

        if (!jwtTokenProvider.isTokenValid(rawRefreshToken, userId)) {
            throw new AppException(HttpStatus.UNAUTHORIZED, MessageCode.AUTH_INVALID_TOKEN);
        }

        RefreshToken persistedRefreshToken = refreshTokenRepository
                .findByTokenHashAndTokenTypeAndRevokedAtIsNull(hashToken(rawRefreshToken), TokenTypeEnum.REFRESH)
                .orElseThrow(() -> new AppException(HttpStatus.UNAUTHORIZED, MessageCode.AUTH_REFRESH_TOKEN_NOT_FOUND));

        LocalDateTime now = LocalDateTime.now();
        if (persistedRefreshToken.getExpiresAt() == null || persistedRefreshToken.getExpiresAt().isBefore(now)) {
            throw new AppException(HttpStatus.UNAUTHORIZED, MessageCode.AUTH_REFRESH_TOKEN_EXPIRED);
        }

        persistedRefreshToken.setRevokedAt(now);
        refreshTokenRepository.save(persistedRefreshToken);
        revokeActiveAccessTokens(user.getId(), now);

        String newAccessToken = jwtTokenProvider.generateAccessToken(user);
        String newRefreshToken = jwtTokenProvider.generateRefreshToken(user);

        persistToken(
                user,
                newAccessToken,
                TokenTypeEnum.ACCESS,
                now.plus(Duration.ofMillis(jwtTokenProvider.getExpirationMillis()))
        );
        persistToken(
                user,
                newRefreshToken,
                TokenTypeEnum.REFRESH,
                now.plus(Duration.ofMillis(jwtTokenProvider.getRefreshExpirationMillis()))
        );

        return RefreshTokenResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(newRefreshToken)
                .tokenType(jwtTokenProvider.getTokenType())
                .expiresIn(jwtTokenProvider.getExpirationMillis())
                .refreshExpiresIn(jwtTokenProvider.getRefreshExpirationMillis())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public UserProfileResponse me(String authorizationHeader) {
        User user = resolveAuthenticatedUser(authorizationHeader);
        return mapToUserProfile(user);
    }

    @Override
    @Transactional(readOnly = true)
    public UserProfileResponse getUserById(UUID userId) {
        User user = userRepository.findGraphById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, MessageCode.AUTH_USER_NOT_FOUND));

        return mapToUserProfile(user);
    }

    @Override
    @Transactional
    public PartnerUpgradeRequestResponse createPartnerUpgradeRequest(
            String authorizationHeader,
            CreatePartnerUpgradeRequest request
    ) {
        User authenticatedUser = resolveAuthenticatedUser(authorizationHeader);

        if (!hasRole(authenticatedUser, "USER") || hasRole(authenticatedUser, "SHOPEE_PARTNER")) {
            throw new AppException(HttpStatus.FORBIDDEN, MessageCode.AUTH_FORBIDDEN);
        }

        if (partnerUpgradeRequestRepository.existsByUserIdAndStatus(
                authenticatedUser.getId(),
                PartnerRequestStatusEnum.PENDING
        )) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.COMMON_BAD_REQUEST);
        }

        PartnerUpgradeRequest partnerUpgradeRequest = PartnerUpgradeRequest.builder()
                .user(authenticatedUser)
                .status(PartnerRequestStatusEnum.PENDING)
                .shopName(trimToNull(request.getShopName()))
                .requestNote(trimToNull(request.getRequestNote()))
                .build();

        partnerUpgradeRequest.setIsActive(Boolean.TRUE);

        PartnerUpgradeRequest saved = partnerUpgradeRequestRepository.save(partnerUpgradeRequest);

        partnerKafkaProducer.publishPartnerRequestCreated(saved);

        return mapToPartnerUpgradeRequestResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public PartnerUpgradeRequestResponse getMyLatestPartnerUpgradeRequest(String authorizationHeader) {
        User authenticatedUser = resolveAuthenticatedUser(authorizationHeader);

        return partnerUpgradeRequestRepository
                .findTopByUserIdOrderByCreatedAtDesc(authenticatedUser.getId())
                .map(this::mapToPartnerUpgradeRequestResponse)
                .orElse(null);
    }

    @Override
    @Transactional(readOnly = true)
    public PartnerUpgradeRequestListResponse getPartnerUpgradeRequests(
            String authorizationHeader,
            PartnerRequestStatusEnum status,
            int page,
            int size
    ) {
        requireManagePartnersPermission(authorizationHeader);

        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 100);
        Pageable pageable = PageRequest.of(
                safePage,
                safeSize,
                Sort.by(Sort.Direction.DESC, "createdAt")
        );

        Page<PartnerUpgradeRequest> requestPage = status == null
                ? partnerUpgradeRequestRepository.findAllByOrderByCreatedAtDesc(pageable)
                : partnerUpgradeRequestRepository.findByStatusOrderByCreatedAtDesc(status, pageable);

        return PartnerUpgradeRequestListResponse.builder()
                .content(requestPage.getContent().stream().map(this::mapToPartnerUpgradeRequestResponse).toList())
                .page(requestPage.getNumber())
                .size(requestPage.getSize())
                .totalElements(requestPage.getTotalElements())
                .totalPages(requestPage.getTotalPages())
                .last(requestPage.isLast())
                .build();
    }

    @Override
    @Transactional
    public PartnerUpgradeRequestResponse decidePartnerUpgradeRequest(
            String authorizationHeader,
            UUID requestId,
            PartnerUpgradeRequestDecisionRequest request
    ) {
        User reviewer = requireManagePartnersPermission(authorizationHeader);

        PartnerUpgradeRequest partnerUpgradeRequest = partnerUpgradeRequestRepository.findById(requestId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, MessageCode.COMMON_RESOURCE_NOT_FOUND));

        if (partnerUpgradeRequest.getStatus() != PartnerRequestStatusEnum.PENDING) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.COMMON_BAD_REQUEST);
        }

        PartnerRequestDecisionActionEnum action = request.getAction();
        if (action == PartnerRequestDecisionActionEnum.APPROVE) {
            Role partnerRole = roleRepository.findByCodeIgnoreCase("SHOPEE_PARTNER")
                    .orElseThrow(() -> new AppException(HttpStatus.BAD_REQUEST, MessageCode.COMMON_BAD_REQUEST));
            Set<Role> roles = partnerUpgradeRequest.getUser().getRoles();
            if (roles == null) {
                roles = new LinkedHashSet<>();
                partnerUpgradeRequest.getUser().setRoles(roles);
            }
            roles.add(partnerRole);
            userRepository.save(partnerUpgradeRequest.getUser());
            partnerUpgradeRequest.setStatus(PartnerRequestStatusEnum.APPROVED);
        } else {
            partnerUpgradeRequest.setStatus(PartnerRequestStatusEnum.REJECTED);
        }

        partnerUpgradeRequest.setReviewNote(trimToNull(request.getReviewNote()));
        partnerUpgradeRequest.setReviewedBy(trimToNull(reviewer.getUsername()));
        partnerUpgradeRequest.setReviewedAt(LocalDateTime.now());

        PartnerUpgradeRequest saved = partnerUpgradeRequestRepository.save(partnerUpgradeRequest);
        partnerKafkaProducer.publishPartnerRequestDecided(saved, action.name());
        return mapToPartnerUpgradeRequestResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public AdminUserListResponse getUsers(
            String authorizationHeader,
            String keyword,
            String roleCode,
            UserStatusEnum status,
            Boolean isActive,
            int page,
            int size
    ) {
        User authenticatedUser = resolveAuthenticatedUser(authorizationHeader);
        if (!hasPermission(authenticatedUser, "MANAGE_USERS")) {
            throw new AppException(HttpStatus.FORBIDDEN, MessageCode.AUTH_FORBIDDEN);
        }

        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 200);
        Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt"));
        String normalizedKeyword = trimToNull(keyword);
        String normalizedRoleCode = StringUtils.hasText(roleCode) ? normalizeRoleCode(roleCode) : null;
        Specification<User> specification = (root, query, criteriaBuilder) -> {
            query.distinct(true);
            List<Predicate> predicates = new ArrayList<>();

            if (StringUtils.hasText(normalizedKeyword)) {
                String keywordLike = "%" + normalizedKeyword.toLowerCase(Locale.ROOT) + "%";
                predicates.add(criteriaBuilder.or(
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("username")), keywordLike),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("email")), keywordLike)
                ));
            }

            if (StringUtils.hasText(normalizedRoleCode)) {
                Join<User, Role> roleJoin = root.join("roles", JoinType.LEFT);
                predicates.add(criteriaBuilder.equal(criteriaBuilder.upper(roleJoin.get("code")), normalizedRoleCode));
            }

            if (status != null) {
                predicates.add(criteriaBuilder.equal(root.get("status"), status));
            }

            if (isActive != null) {
                predicates.add(criteriaBuilder.equal(root.get("isActive"), isActive));
            }

            return criteriaBuilder.and(predicates.toArray(new Predicate[0]));
        };

        Page<User> usersPage = userRepository.findAll(specification, pageable);

        boolean noFilterRequested = normalizedKeyword == null
                && normalizedRoleCode == null
                && status == null
                && isActive == null;

        if (noFilterRequested && usersPage.isEmpty()) {
            usersPage = userRepository.findAll(pageable);
        }

        return AdminUserListResponse.builder()
                .content(usersPage.getContent().stream().map(this::mapToAdminUserSummary).toList())
                .page(usersPage.getNumber())
                .size(usersPage.getSize())
                .totalElements(usersPage.getTotalElements())
                .totalPages(usersPage.getTotalPages())
                .last(usersPage.isLast())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public AdminUserStatisticsResponse getUserStatistics(String authorizationHeader) {
        User authenticatedUser = resolveAuthenticatedUser(authorizationHeader);
        if (!hasPermission(authenticatedUser, "MANAGE_USERS")) {
            throw new AppException(HttpStatus.FORBIDDEN, MessageCode.AUTH_FORBIDDEN);
        }

        return AdminUserStatisticsResponse.builder()
                .totalUsers(userRepository.count())
                .totalPartners(userRepository.countByRoleCode("SHOPEE_PARTNER"))
                .totalActiveUsers(userRepository.countByIsActiveTrue())
                .totalInactiveUsers(userRepository.countByIsActiveFalse())
                .totalPendingUsers(userRepository.countByStatus(UserStatusEnum.PENDING_VERIFICATION))
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public CheckRoleResponse checkRole(String authorizationHeader, String roleCode) {
        User authenticatedUser = resolveAuthenticatedUser(authorizationHeader);
        String normalizedRoleCode = normalizeRoleCode(roleCode);
        boolean hasRole = hasRole(authenticatedUser, normalizedRoleCode);

        return CheckRoleResponse.builder()
                .userId(authenticatedUser.getId())
                .roleCode(normalizedRoleCode)
                .hasRole(hasRole)
                .build();
    }

    @Override
    @Transactional
    public GrantPermissionResponse grantPermission(String authorizationHeader, GrantPermissionRequest request) {
        User authenticatedUser = resolveAuthenticatedUser(authorizationHeader);
        String normalizedAdminRoleCode = normalizeRoleCode(adminRoleCode);
        if (!hasRole(authenticatedUser, normalizedAdminRoleCode)) {
            throw new AppException(HttpStatus.FORBIDDEN, MessageCode.AUTH_FORBIDDEN);
        }

        User user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, MessageCode.AUTH_USER_NOT_FOUND));

        String normalizedRoleCode = normalizeRoleCode(request.getRoleCode());
        Role role = roleRepository.findByCodeIgnoreCase(normalizedRoleCode)
                .orElseGet(() -> roleRepository.save(Role.builder()
                        .code(normalizedRoleCode)
                        .name(normalizedRoleCode)
                        .build()));

        Set<Role> roles = user.getRoles() != null ? new HashSet<>(user.getRoles()) : new HashSet<>();
        boolean roleAdded = roles.add(role);
        user.setRoles(roles);
        userRepository.save(user);

        if (roleAdded) {
            LocalDateTime now = LocalDateTime.now();
            revokeActiveAccessTokens(user.getId(), now);
            revokeActiveRefreshTokens(user.getId(), now);
        }

        return GrantPermissionResponse.builder()
                .userId(user.getId())
                .roles(user.getRoles().stream().map(Role::getCode).sorted().toList())
                .message(MessageCode.AUTH_PERMISSION_GRANTED.name())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<RoleSummaryResponse> getRoles(String authorizationHeader) {
        requireManageUsersPermission(authorizationHeader);

        return roleRepository.findAllByOrderByCodeAsc().stream()
                .map(this::mapToRoleSummary)
                .toList();
    }

    @Override
    @Transactional
    public RoleSummaryResponse createRole(String authorizationHeader, CreateRoleRequest request) {
        requireManageUsersPermission(authorizationHeader);

        String normalizedRoleCode = normalizeRoleCode(request.getCode());
        if (roleRepository.existsByCodeIgnoreCase(normalizedRoleCode)) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.COMMON_BAD_REQUEST);
        }

        String normalizedRoleName = StringUtils.hasText(request.getName())
                ? request.getName().trim()
                : normalizedRoleCode;

        Role role = Role.builder()
                .code(normalizedRoleCode)
                .name(normalizedRoleName)
                .build();
        role.setIsActive(Boolean.TRUE);

        Role savedRole = roleRepository.save(role);
        return mapToRoleSummary(savedRole);
    }

    @Override
    @Transactional(readOnly = true)
    public List<MenuSummaryResponse> getMenus(String authorizationHeader) {
        requireManageUsersPermission(authorizationHeader);

        return menuRepository.findAllByOrderByDisplayOrderAscMenuKeyAsc().stream()
                .map(this::mapToMenuSummary)
                .toList();
    }

    @Override
    @Transactional
    public MenuSummaryResponse createMenu(String authorizationHeader, CreateMenuRequest request) {
        requireManageUsersPermission(authorizationHeader);

        String normalizedPath = normalizeMenuPathOrNull(request.getPath());
        String normalizedMenuKey = StringUtils.hasText(request.getMenuKey())
                ? normalizeMenuKey(request.getMenuKey())
                : deriveMenuKeyFromPath(normalizedPath);
        if (!StringUtils.hasText(normalizedMenuKey)) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.COMMON_BAD_REQUEST);
        }

        if (menuRepository.existsByMenuKeyIgnoreCase(normalizedMenuKey)) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.COMMON_BAD_REQUEST);
        }

        if (StringUtils.hasText(normalizedPath) && menuRepository.existsByPathIgnoreCase(normalizedPath)) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.COMMON_BAD_REQUEST);
        }

        Permission permission = resolvePermissionOrNull(request.getPermissionCode());

        int displayOrder = request.getDisplayOrder() == null ? 100 : request.getDisplayOrder();
        Menu parentMenu = resolveParentMenuOrNull(request.getParentMenuId(), null);

        Menu menu = Menu.builder()
                .menuKey(normalizedMenuKey)
                .label(request.getLabel().trim())
                .path(normalizedPath)
                .displayOrder(displayOrder)
                .permission(permission)
                .parentMenu(parentMenu)
                .build();
        menu.setIsActive(Boolean.TRUE);

        Menu savedMenu = menuRepository.save(menu);
        return mapToMenuSummary(savedMenu);
    }

    @Override
    @Transactional
    public MenuSummaryResponse updateMenu(String authorizationHeader, UUID menuId, UpdateMenuRequest request) {
        requireManageUsersPermission(authorizationHeader);

        Menu menu = menuRepository.findById(menuId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, MessageCode.COMMON_RESOURCE_NOT_FOUND));

        String normalizedPath = normalizeMenuPathOrNull(request.getPath());
        String normalizedMenuKey = normalizeMenuKey(request.getMenuKey());
        if (!StringUtils.hasText(normalizedMenuKey)) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.COMMON_BAD_REQUEST);
        }

        if (menuRepository.existsByMenuKeyIgnoreCaseAndIdNot(normalizedMenuKey, menu.getId())) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.COMMON_BAD_REQUEST);
        }

        if (StringUtils.hasText(normalizedPath)
                && menuRepository.existsByPathIgnoreCaseAndIdNot(normalizedPath, menu.getId())) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.COMMON_BAD_REQUEST);
        }

        Permission permission = resolvePermissionOrNull(request.getPermissionCode());
        int displayOrder = request.getDisplayOrder() == null ? 100 : request.getDisplayOrder();
        Menu parentMenu = resolveParentMenuOrNull(request.getParentMenuId(), menu.getId());

        menu.setMenuKey(normalizedMenuKey);
        menu.setLabel(request.getLabel().trim());
        menu.setPath(normalizedPath);
        menu.setDisplayOrder(displayOrder);
        menu.setPermission(permission);
        menu.setParentMenu(parentMenu);

        Menu savedMenu = menuRepository.save(menu);
        return mapToMenuSummary(savedMenu);
    }

    @Override
    @Transactional
    public MenuSummaryResponse deleteMenu(String authorizationHeader, UUID menuId) {
        requireManageUsersPermission(authorizationHeader);

        Menu menu = menuRepository.findById(menuId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, MessageCode.COMMON_RESOURCE_NOT_FOUND));

        MenuSummaryResponse deletedMenu = mapToMenuSummary(menu);
        menuRepository.delete(menu);
        return deletedMenu;
    }

    @Override
    @Transactional(readOnly = true)
    public List<PermissionSummaryResponse> getPermissions(String authorizationHeader) {
        requireManageUsersPermission(authorizationHeader);

        return permissionRepository.findAllByOrderByCodeAsc().stream()
                .map(this::mapToPermissionSummary)
                .toList();
    }

    @Override
    @Transactional
    public RoleSummaryResponse updateRoleMenus(
            String authorizationHeader,
            String roleCode,
            UpdateRoleMenusRequest request
    ) {
        requireManageUsersPermission(authorizationHeader);

        String normalizedRoleCode = normalizeRoleCode(roleCode);
        Role role = roleRepository.findGraphByCodeIgnoreCase(normalizedRoleCode)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, MessageCode.COMMON_RESOURCE_NOT_FOUND));

        Set<String> normalizedMenuKeys = request.getMenuKeys().stream()
                .map(this::normalizeMenuKey)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        Set<Menu> menus = new LinkedHashSet<>();
        for (String menuKey : normalizedMenuKeys) {
            Menu menu = menuRepository.findByMenuKeyIgnoreCase(menuKey)
                    .orElseThrow(() -> new AppException(HttpStatus.BAD_REQUEST, MessageCode.COMMON_BAD_REQUEST));
            addMenuWithAncestors(menu, menus);
        }

        role.setMenus(menus);
        Role savedRole = roleRepository.save(role);

        return mapToRoleSummary(savedRole);
    }

    @Override
    @Transactional
    public ActivateUserResponse activateUser(UUID userId) {
        User user = userRepository.findGraphById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, MessageCode.AUTH_USER_NOT_FOUND));

        user.setIsActive(Boolean.TRUE);
        user.setStatus(UserStatusEnum.ACTIVE);
        user.setEmailVerified(true);
        userRepository.save(user);

        sendAccountActivatedEmail(user);

        return ActivateUserResponse.builder()
                .userId(user.getId())
                .isActive(user.getIsActive())
                .status(user.getStatus())
                .build();
    }

    @Override
    @Transactional
    public ActivateUserResponse deactivateUser(UUID userId) {
        User user = userRepository.findGraphById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, MessageCode.AUTH_USER_NOT_FOUND));

        LocalDateTime now = LocalDateTime.now();
        user.setIsActive(Boolean.FALSE);
        user.setStatus(UserStatusEnum.DISABLED);
        userRepository.save(user);

        revokeActiveAccessTokens(user.getId(), now);
        revokeActiveRefreshTokens(user.getId(), now);

        sendAccountDeactivatedEmail(user);

        return ActivateUserResponse.builder()
                .userId(user.getId())
                .isActive(user.getIsActive())
                .status(user.getStatus())
                .build();
    }

    @Override
    @Transactional
    public ActivateUserResponse lockUser(UUID userId) {
        User user = userRepository.findGraphById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, MessageCode.AUTH_USER_NOT_FOUND));

        LocalDateTime now = LocalDateTime.now();
        user.setStatus(UserStatusEnum.LOCKED);
        user.setIsActive(Boolean.FALSE);
        userRepository.save(user);

        revokeActiveAccessTokens(user.getId(), now);
        revokeActiveRefreshTokens(user.getId(), now);
        sendAccountLockedEmail(user);

        return ActivateUserResponse.builder()
                .userId(user.getId())
                .isActive(user.getIsActive())
                .status(user.getStatus())
                .build();
    }

    @Override
    @Transactional
    public UpdateUserResponse updateUser(String authorizationHeader, UUID userId, UpdateUserRequest request) {
        User authenticatedUser = resolveAuthenticatedUser(authorizationHeader);
        if (!hasPermission(authenticatedUser, "MANAGE_USERS")) {
            throw new AppException(HttpStatus.FORBIDDEN, MessageCode.AUTH_FORBIDDEN);
        }

        User user = userRepository.findGraphById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, MessageCode.AUTH_USER_NOT_FOUND));

        if (StringUtils.hasText(request.getEmail())) {
            String normalizedEmail = request.getEmail().trim().toLowerCase(Locale.ROOT);
            boolean emailExists = userRepository.existsByEmailIgnoreCase(normalizedEmail)
                    && !normalizedEmail.equalsIgnoreCase(user.getEmail());
            if (emailExists) {
                throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.AUTH_EMAIL_ALREADY_EXISTS);
            }
            user.setEmail(normalizedEmail);
        }

        if (request.getPhone() != null) {
            String normalizedPhone = StringUtils.hasText(request.getPhone()) ? request.getPhone().trim() : null;
            boolean phoneExists = StringUtils.hasText(normalizedPhone)
                    && userRepository.existsByPhone(normalizedPhone)
                    && !normalizedPhone.equals(user.getPhone());
            if (phoneExists) {
                throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.AUTH_PHONE_ALREADY_EXISTS);
            }
            user.setPhone(normalizedPhone);
        }

        if (request.getFirstName() != null) {
            user.setFirstName(StringUtils.hasText(request.getFirstName()) ? request.getFirstName().trim() : null);
        }
        if (request.getLastName() != null) {
            user.setLastName(StringUtils.hasText(request.getLastName()) ? request.getLastName().trim() : null);
        }
        if (request.getAvatar() != null) {
            user.setAvatar(StringUtils.hasText(request.getAvatar()) ? request.getAvatar().trim() : null);
        }
        if (request.getGender() != null) {
            user.setGender(request.getGender());
        }
        if (request.getStatus() != null) {
            user.setStatus(request.getStatus());
        }
        if (request.getEmailVerified() != null) {
            user.setEmailVerified(request.getEmailVerified());
        }
        if (request.getIsActive() != null) {
            user.setIsActive(request.getIsActive());
            if (Boolean.FALSE.equals(request.getIsActive()) && user.getStatus() != UserStatusEnum.DISABLED) {
                user.setStatus(UserStatusEnum.DISABLED);
            }
            if (Boolean.TRUE.equals(request.getIsActive()) && user.getStatus() == UserStatusEnum.DISABLED) {
                user.setStatus(UserStatusEnum.ACTIVE);
            }
        }

        if (request.getRoleCodes() != null) {
            Set<Role> roles = new HashSet<>();
            for (String roleCode : request.getRoleCodes()) {
                String normalizedRoleCode = normalizeRoleCode(roleCode);
                Role role = roleRepository.findByCodeIgnoreCase(normalizedRoleCode)
                        .orElseGet(() -> roleRepository.save(Role.builder()
                                .code(normalizedRoleCode)
                                .name(normalizedRoleCode)
                                .build()));
                roles.add(role);
            }
            user.setRoles(roles);
        }

        User savedUser = userRepository.save(user);
        LocalDateTime now = LocalDateTime.now();
        revokeActiveAccessTokens(savedUser.getId(), now);
        revokeActiveRefreshTokens(savedUser.getId(), now);

        User reloadedUser = userRepository.findGraphById(savedUser.getId())
                .orElse(savedUser);

        return UpdateUserResponse.builder()
                .userId(reloadedUser.getId())
                .profile(mapToUserProfile(reloadedUser))
                .build();
    }

    @Override
    @Transactional
    public UpdateUserResponse updateUserAvatar(String authorizationHeader, UUID userId, MultipartFile avatar) {
        User authenticatedUser = resolveAuthenticatedUser(authorizationHeader);
        boolean isOwner = authenticatedUser.getId().equals(userId);
        if (!isOwner && !hasPermission(authenticatedUser, "MANAGE_USERS")) {
            throw new AppException(HttpStatus.FORBIDDEN, MessageCode.AUTH_FORBIDDEN);
        }

        User user = userRepository.findGraphById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, MessageCode.AUTH_USER_NOT_FOUND));

        String avatarUrl = uploadService.uploadAvatar(avatar);
        user.setAvatar(avatarUrl);

        User savedUser = userRepository.save(user);
        User reloadedUser = userRepository.findGraphById(savedUser.getId())
                .orElse(savedUser);

        return UpdateUserResponse.builder()
                .userId(reloadedUser.getId())
                .profile(mapToUserProfile(reloadedUser))
                .build();
    }

    private void persistToken(User user, String rawToken, TokenTypeEnum tokenType, LocalDateTime expiresAt) {
        RefreshToken token = RefreshToken.builder()
                .user(user)
                .tokenType(tokenType)
                .tokenHash(hashToken(rawToken))
                .expiresAt(expiresAt)
                .revokedAt(null)
                .build();
        refreshTokenRepository.save(token);
    }

    private void revokeActiveAccessTokens(UUID userId, LocalDateTime revokedAt) {
        List<RefreshToken> accessTokens = refreshTokenRepository
                .findByUserIdAndTokenTypeAndRevokedAtIsNullAndExpiresAtAfter(userId, TokenTypeEnum.ACCESS, revokedAt);
        for (RefreshToken token : accessTokens) {
            token.setRevokedAt(revokedAt);
        }
        refreshTokenRepository.saveAll(accessTokens);
    }

    private void revokeActiveRefreshTokens(UUID userId, LocalDateTime revokedAt) {
        List<RefreshToken> refreshTokens = refreshTokenRepository
                .findByUserIdAndTokenTypeAndRevokedAtIsNullAndExpiresAtAfter(userId, TokenTypeEnum.REFRESH, revokedAt);
        for (RefreshToken token : refreshTokens) {
            token.setRevokedAt(revokedAt);
        }
        refreshTokenRepository.saveAll(refreshTokens);
    }

    private User findUserByUsernameOrEmail(String usernameOrEmail) {
        String value = usernameOrEmail == null ? null : usernameOrEmail.trim();
        return userRepository.findGraphByUsernameIgnoreCaseOrEmailIgnoreCase(value, value)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, MessageCode.AUTH_USER_NOT_FOUND));
    }

    private User resolveAuthenticatedUser(String authorizationHeader) {
        String accessToken = extractBearerToken(authorizationHeader);

        UUID userId;
        try {
            userId = jwtTokenProvider.extractUserId(accessToken);
        } catch (Exception ex) {
            throw new AppException(HttpStatus.UNAUTHORIZED, MessageCode.AUTH_INVALID_TOKEN);
        }

        if (!jwtTokenProvider.isTokenValid(accessToken, userId)) {
            throw new AppException(HttpStatus.UNAUTHORIZED, MessageCode.AUTH_INVALID_TOKEN);
        }

        LocalDateTime now = LocalDateTime.now();
        RefreshToken activeAccessToken = refreshTokenRepository
                .findByTokenHashAndTokenTypeAndRevokedAtIsNull(hashToken(accessToken), TokenTypeEnum.ACCESS)
                .orElseThrow(() -> new AppException(HttpStatus.UNAUTHORIZED, MessageCode.AUTH_INVALID_TOKEN));

        if (activeAccessToken.getExpiresAt() == null || activeAccessToken.getExpiresAt().isBefore(now)) {
            throw new AppException(HttpStatus.UNAUTHORIZED, MessageCode.AUTH_INVALID_TOKEN);
        }

        if (!userId.equals(activeAccessToken.getUser().getId())) {
            throw new AppException(HttpStatus.UNAUTHORIZED, MessageCode.AUTH_INVALID_TOKEN);
        }

        User user = userRepository.findGraphById(userId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, MessageCode.AUTH_USER_NOT_FOUND));

        if (user.getStatus() == UserStatusEnum.LOCKED || user.getStatus() == UserStatusEnum.DISABLED) {
            throw new AppException(HttpStatus.FORBIDDEN, MessageCode.AUTH_USER_LOCKED);
        }

        if (!Boolean.TRUE.equals(user.getIsActive())) {
            throw new AppException(HttpStatus.FORBIDDEN, MessageCode.AUTH_USER_INACTIVE);
        }

        return user;
    }

    private boolean hasRole(User user, String roleCode) {
        if (user.getRoles() == null || user.getRoles().isEmpty()) {
            return false;
        }
        return user.getRoles().stream()
                .map(Role::getCode)
                .anyMatch(code -> roleCode.equalsIgnoreCase(code));
    }

    private boolean hasPermission(User user, String permissionCode) {
        if (user.getRoles() == null || user.getRoles().isEmpty()) {
            return false;
        }
        return user.getRoles().stream()
                .flatMap(role -> role.getPermissions().stream())
                .map(permission -> permission.getCode())
                .filter(Objects::nonNull)
                .anyMatch(code -> permissionCode.equalsIgnoreCase(code));
    }

    private User requireManageUsersPermission(String authorizationHeader) {
        User authenticatedUser = resolveAuthenticatedUser(authorizationHeader);
        if (!hasPermission(authenticatedUser, "MANAGE_USERS")) {
            throw new AppException(HttpStatus.FORBIDDEN, MessageCode.AUTH_FORBIDDEN);
        }
        return authenticatedUser;
    }

    private User requireManagePartnersPermission(String authorizationHeader) {
        User authenticatedUser = resolveAuthenticatedUser(authorizationHeader);
        if (!hasPermission(authenticatedUser, "MANAGE_PARTNERS")) {
            throw new AppException(HttpStatus.FORBIDDEN, MessageCode.AUTH_FORBIDDEN);
        }
        return authenticatedUser;
    }

    private String normalizeRoleCode(String roleCode) {
        if (!StringUtils.hasText(roleCode)) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.COMMON_BAD_REQUEST);
        }
        return roleCode.trim().toUpperCase(Locale.ROOT);
    }

    private String normalizePermissionCode(String permissionCode) {
        if (!StringUtils.hasText(permissionCode)) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.COMMON_BAD_REQUEST);
        }
        return permissionCode.trim().toUpperCase(Locale.ROOT);
    }

    private String normalizeMenuKey(String menuKey) {
        if (!StringUtils.hasText(menuKey)) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.COMMON_BAD_REQUEST);
        }
        String normalized = menuKey.trim().toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9-_]+", "-")
                .replaceAll("-{2,}", "-")
                .replaceAll("^-|-$", "");
        if (!StringUtils.hasText(normalized)) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.COMMON_BAD_REQUEST);
        }
        return normalized;
    }

    private String normalizeMenuPathOrNull(String path) {
        if (!StringUtils.hasText(path)) {
            return null;
        }
        String normalizedPath = path.trim();
        if (!normalizedPath.startsWith("/")) {
            normalizedPath = "/" + normalizedPath;
        }
        return normalizedPath;
    }

    private String deriveMenuKeyFromPath(String normalizedPath) {
        if (!StringUtils.hasText(normalizedPath)) {
            return null;
        }
        String fromPath = normalizedPath
                .toLowerCase(Locale.ROOT)
                .replaceAll("^/+", "")
                .replaceAll("/+", "-")
                .replaceAll("[^a-z0-9-_]+", "-")
                .replaceAll("-{2,}", "-")
                .replaceAll("^-|-$", "");
        return StringUtils.hasText(fromPath) ? fromPath : null;
    }

    private void addMenuWithAncestors(Menu menu, Set<Menu> collector) {
        if (menu == null || collector.contains(menu)) {
            return;
        }

        if (menu.getParentMenu() != null) {
            addMenuWithAncestors(menu.getParentMenu(), collector);
        }

        collector.add(menu);
    }

    private Permission resolvePermissionOrNull(String permissionCode) {
        if (!StringUtils.hasText(permissionCode)) {
            return null;
        }
        String normalizedPermissionCode = normalizePermissionCode(permissionCode);
        return permissionRepository.findByCodeIgnoreCase(normalizedPermissionCode)
                .orElseThrow(() -> new AppException(HttpStatus.BAD_REQUEST, MessageCode.COMMON_BAD_REQUEST));
    }

    private Menu resolveParentMenuOrNull(UUID parentMenuId, UUID currentMenuId) {
        if (parentMenuId == null) {
            return null;
        }

        Menu parentMenu = menuRepository.findById(parentMenuId)
                .orElseThrow(() -> new AppException(HttpStatus.BAD_REQUEST, MessageCode.COMMON_BAD_REQUEST));

        if (currentMenuId != null && currentMenuId.equals(parentMenu.getId())) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.COMMON_BAD_REQUEST);
        }

        if (StringUtils.hasText(parentMenu.getPath())) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.COMMON_BAD_REQUEST);
        }

        if (currentMenuId != null) {
            Menu cursor = parentMenu;
            while (cursor != null) {
                if (currentMenuId.equals(cursor.getId())) {
                    throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.COMMON_BAD_REQUEST);
                }
                cursor = cursor.getParentMenu();
            }
        }

        return parentMenu;
    }

    private String extractBearerToken(String authorizationHeader) {
        if (!StringUtils.hasText(authorizationHeader)) {
            throw new AppException(HttpStatus.UNAUTHORIZED, MessageCode.AUTH_TOKEN_REQUIRED);
        }

        String headerValue = authorizationHeader.trim();
        String prefix = jwtTokenProvider.getTokenType() + " ";

        if (!headerValue.regionMatches(true, 0, prefix, 0, prefix.length())) {
            throw new AppException(HttpStatus.UNAUTHORIZED, MessageCode.AUTH_INVALID_TOKEN);
        }

        String token = headerValue.substring(prefix.length()).trim();
        if (!StringUtils.hasText(token)) {
            throw new AppException(HttpStatus.UNAUTHORIZED, MessageCode.AUTH_INVALID_TOKEN);
        }

        return token;
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte hashByte : hashBytes) {
                sb.append(String.format("%02x", hashByte));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algorithm is not available", e);
        }
    }

    private UserProfileResponse mapToUserProfile(User user) {
        List<String> permissions = user.getRoles().stream()
                .flatMap(role -> role.getPermissions().stream())
                .map(permission -> permission.getCode())
                .filter(Objects::nonNull)
                .distinct()
                .sorted()
                .toList();

        Set<Menu> uniqueMenus = new LinkedHashSet<>();
        user.getRoles().forEach(role -> role.getMenus().forEach(menu -> addMenuWithAncestors(menu, uniqueMenus)));

        List<MenuItemResponse> menus = uniqueMenus.stream()
                .sorted((first, second) -> {
                    int firstOrder = first.getDisplayOrder() == null ? Integer.MAX_VALUE : first.getDisplayOrder();
                    int secondOrder = second.getDisplayOrder() == null ? Integer.MAX_VALUE : second.getDisplayOrder();
                    if (firstOrder != secondOrder) {
                        return Integer.compare(firstOrder, secondOrder);
                    }
                    return String.valueOf(first.getMenuKey()).compareToIgnoreCase(String.valueOf(second.getMenuKey()));
                })
                .map(this::mapToMenuItem)
                .toList();

        return UserProfileResponse.builder()
                .userId(user.getId())
                .uuid(user.getUuid())
                .username(user.getUsername())
                .email(user.getEmail())
                .phone(user.getPhone())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .avatar(user.getAvatar())
                .status(user.getStatus())
                .emailVerified(user.getEmailVerified())
                .failedLoginCount(user.getFailedLoginCount())
                .lastLoginAt(user.getLastLoginAt())
                .gender(user.getGender())
                .isActive(user.getIsActive())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .roles(user.getRoles().stream().map(Role::getCode).sorted().toList())
                .permissions(permissions)
                .menus(menus)
                .build();
    }

    private AdminUserSummaryResponse mapToAdminUserSummary(User user) {
        List<String> roles = user.getRoles() == null
                ? List.of()
                : user.getRoles().stream()
                .map(Role::getCode)
                .filter(Objects::nonNull)
                .sorted()
                .toList();

        return AdminUserSummaryResponse.builder()
                .userId(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .phone(user.getPhone())
                .status(user.getStatus())
                .isActive(user.getIsActive())
                .emailVerified(user.getEmailVerified())
                .roles(roles)
                .createdAt(user.getCreatedAt())
                .build();
    }

    private RoleSummaryResponse mapToRoleSummary(Role role) {
        List<String> menuKeys = role.getMenus() == null
                ? List.of()
                : role.getMenus().stream()
                .map(Menu::getMenuKey)
                .filter(Objects::nonNull)
                .sorted()
                .toList();

        return RoleSummaryResponse.builder()
                .code(role.getCode())
                .name(role.getName())
                .isActive(role.getIsActive())
                .menuKeys(menuKeys)
                .build();
    }

    private PartnerUpgradeRequestResponse mapToPartnerUpgradeRequestResponse(PartnerUpgradeRequest request) {
        User user = request.getUser();
        return PartnerUpgradeRequestResponse.builder()
                .requestId(request.getId())
                .userId(user != null ? user.getId() : null)
                .username(user != null ? user.getUsername() : null)
                .email(user != null ? user.getEmail() : null)
                .shopName(request.getShopName())
                .status(request.getStatus())
                .requestNote(request.getRequestNote())
                .reviewNote(request.getReviewNote())
                .reviewedBy(request.getReviewedBy())
                .reviewedAt(request.getReviewedAt())
                .createdAt(request.getCreatedAt())
                .updatedAt(request.getUpdatedAt())
                .build();
    }

    private MenuSummaryResponse mapToMenuSummary(Menu menu) {
        Menu parentMenu = menu.getParentMenu();
        return MenuSummaryResponse.builder()
                .id(menu.getId())
                .key(menu.getMenuKey())
                .label(menu.getLabel())
                .path(menu.getPath())
                .displayOrder(menu.getDisplayOrder())
                .permission(menu.getPermission() != null ? menu.getPermission().getCode() : null)
                .parentMenuId(parentMenu != null ? parentMenu.getId() : null)
                .parentMenuKey(parentMenu != null ? parentMenu.getMenuKey() : null)
                .isContainer(!StringUtils.hasText(menu.getPath()))
                .build();
    }

    private MenuItemResponse mapToMenuItem(Menu menu) {
        Menu parentMenu = menu.getParentMenu();
        return MenuItemResponse.builder()
                .id(menu.getId())
                .key(menu.getMenuKey())
                .label(menu.getLabel())
                .path(menu.getPath())
                .displayOrder(menu.getDisplayOrder())
                .permission(menu.getPermission() != null ? menu.getPermission().getCode() : null)
                .parentMenuId(parentMenu != null ? parentMenu.getId() : null)
                .parentMenuKey(parentMenu != null ? parentMenu.getMenuKey() : null)
                .isContainer(!StringUtils.hasText(menu.getPath()))
                .build();
    }

    private PermissionSummaryResponse mapToPermissionSummary(Permission permission) {
        return PermissionSummaryResponse.builder()
                .code(permission.getCode())
                .name(permission.getName())
                .build();
    }

    private String trimToNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }

    private void validateOtpState(UserOtp userOtp) {
        if (Boolean.TRUE.equals(userOtp.getUsed())) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.AUTH_OTP_USED);
        }

        if (userOtp.getExpiresAt() == null || userOtp.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.AUTH_OTP_EXPIRED);
        }

        int failedAttempts = userOtp.getFailedAttempts() == null ? 0 : userOtp.getFailedAttempts();
        if (failedAttempts >= maxOtpFailedAttempts) {
            throw new AppException(HttpStatus.BAD_REQUEST, MessageCode.AUTH_OTP_LOCKED);
        }
    }

    private String generateNumericOtp(int digits) {
        int bound = (int) Math.pow(10, digits);
        int otp = SECURE_RANDOM.nextInt(bound);
        return String.format("%0" + digits + "d", otp);
    }

    private void sendRegisterSuccessEmail(User user) {
        MailTemplateProperties.Template template = mailTemplateProperties.getRegisterSuccess();
        sendTemplateEmail(user, template, "Register successful");
    }

    private void sendAccountActivatedEmail(User user) {
        MailTemplateProperties.Template template = mailTemplateProperties.getAccountActivated();
        sendTemplateEmail(user, template, "Account activated");
    }

    private void sendAccountDeactivatedEmail(User user) {
        MailTemplateProperties.Template template = mailTemplateProperties.getAccountDeactivated();
        sendTemplateEmail(user, template, "Account deactivated");
    }

    private void sendAccountLockedEmail(User user) {
        MailTemplateProperties.Template template = mailTemplateProperties.getAccountLocked();
        sendTemplateEmail(user, template, "Account locked");
    }

    private void sendChangePasswordOtpEmail(User user, String otp, int expiredMinutes) {
        MailTemplateProperties.Template template = mailTemplateProperties.getChangePasswordOtp();

        String displayName = StringUtils.hasText(user.getFirstName()) ? user.getFirstName() : user.getUsername();
        String subject = StringUtils.hasText(template.getSubject())
                ? template.getSubject()
                : "Your OTP code for password change";
        String bodyTemplate = StringUtils.hasText(template.getBody())
                ? template.getBody()
                : "<html><body><p>Hello {{username}},</p><p>Your OTP code is <b>{{otp}}</b></p><p>Expires in {{expiredMinutes}} minutes.</p></body></html>";

        String body = bodyTemplate
                .replace("{{username}}", displayName)
                .replace("{{email}}", user.getEmail())
                .replace("{{otp}}", otp)
                .replace("{{expiredMinutes}}", String.valueOf(expiredMinutes));

        emailService.sendHtmlEmail(user.getEmail(), subject, body);
    }

    private void sendForgotPasswordOtpEmail(User user, String otp, int expiredMinutes) {
        MailTemplateProperties.Template template = mailTemplateProperties.getForgotPasswordOtp();

        String displayName = StringUtils.hasText(user.getFirstName()) ? user.getFirstName() : user.getUsername();
        String subject = StringUtils.hasText(template.getSubject())
                ? template.getSubject()
                : "Your OTP code for password reset";
        String bodyTemplate = StringUtils.hasText(template.getBody())
                ? template.getBody()
                : "<html><body><p>Hello {{username}},</p><p>Your OTP code is <b>{{otp}}</b></p><p>Expires in {{expiredMinutes}} minutes.</p></body></html>";

        String body = bodyTemplate
                .replace("{{username}}", displayName)
                .replace("{{email}}", user.getEmail())
                .replace("{{otp}}", otp)
                .replace("{{expiredMinutes}}", String.valueOf(expiredMinutes));

        emailService.sendHtmlEmail(user.getEmail(), subject, body);
    }

    private void sendTemplateEmail(User user, MailTemplateProperties.Template template, String fallbackSubject) {
        String displayName = StringUtils.hasText(user.getFirstName()) ? user.getFirstName() : user.getUsername();
        String subject = StringUtils.hasText(template.getSubject()) ? template.getSubject() : fallbackSubject;
        String bodyTemplate = StringUtils.hasText(template.getBody())
                ? template.getBody()
                : "<html><body><p>Hello {{username}},</p><p>{{message}}</p></body></html>";

        String body = bodyTemplate
                .replace("{{username}}", displayName)
                .replace("{{email}}", user.getEmail())
                .replace("{{message}}", subject);

        emailService.sendHtmlEmail(user.getEmail(), subject, body);
    }
}
