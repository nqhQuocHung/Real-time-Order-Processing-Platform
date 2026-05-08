package com.nqh.authservice.services;

import com.nqh.authservice.dtos.ActivateUserResponse;
import com.nqh.authservice.dtos.AdminUserListResponse;
import com.nqh.authservice.dtos.AdminUserStatisticsResponse;
import com.nqh.authservice.dtos.CheckRoleResponse;
import com.nqh.authservice.dtos.ChangePasswordOtpRequest;
import com.nqh.authservice.dtos.ChangePasswordOtpResponse;
import com.nqh.authservice.dtos.ChangePasswordRequest;
import com.nqh.authservice.dtos.ChangePasswordResponse;
import com.nqh.authservice.dtos.CreateMenuRequest;
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
import com.nqh.authservice.dtos.PermissionSummaryResponse;
import com.nqh.authservice.dtos.RefreshTokenRequest;
import com.nqh.authservice.dtos.RefreshTokenResponse;
import com.nqh.authservice.dtos.RegisterRequest;
import com.nqh.authservice.dtos.RegisterResponse;
import com.nqh.authservice.dtos.RoleSummaryResponse;
import com.nqh.authservice.dtos.UpdateRoleMenusRequest;
import com.nqh.authservice.dtos.UpdateMenuRequest;
import com.nqh.authservice.dtos.UserProfileResponse;
import com.nqh.authservice.dtos.UpdateUserRequest;
import com.nqh.authservice.dtos.UpdateUserResponse;
import com.nqh.authservice.enums.UserStatusEnum;
import java.util.List;
import java.util.UUID;
import org.springframework.web.multipart.MultipartFile;

public interface AuthService {

    RegisterResponse register(RegisterRequest request);

    LoginResponse login(LoginRequest request);

    ChangePasswordOtpResponse sendChangePasswordOtp(ChangePasswordOtpRequest request);

    ChangePasswordResponse changePassword(ChangePasswordRequest request);

    ForgotPasswordOtpResponse sendForgotPasswordOtp(ForgotPasswordOtpRequest request);

    ForgotPasswordResponse forgotPassword(ForgotPasswordRequest request);

    RefreshTokenResponse refreshToken(RefreshTokenRequest request);

    UserProfileResponse me(String authorizationHeader);

    UserProfileResponse getUserById(UUID userId);

    AdminUserListResponse getUsers(
            String authorizationHeader,
            String keyword,
            String roleCode,
            UserStatusEnum status,
            Boolean isActive,
            int page,
            int size
    );

    AdminUserStatisticsResponse getUserStatistics(String authorizationHeader);

    CheckRoleResponse checkRole(String authorizationHeader, String roleCode);

    GrantPermissionResponse grantPermission(String authorizationHeader, GrantPermissionRequest request);

    List<RoleSummaryResponse> getRoles(String authorizationHeader);

    RoleSummaryResponse createRole(String authorizationHeader, CreateRoleRequest request);

    List<MenuSummaryResponse> getMenus(String authorizationHeader);

    MenuSummaryResponse createMenu(String authorizationHeader, CreateMenuRequest request);

    MenuSummaryResponse updateMenu(String authorizationHeader, UUID menuId, UpdateMenuRequest request);

    MenuSummaryResponse deleteMenu(String authorizationHeader, UUID menuId);

    List<PermissionSummaryResponse> getPermissions(String authorizationHeader);

    RoleSummaryResponse updateRoleMenus(String authorizationHeader, String roleCode, UpdateRoleMenusRequest request);

    ActivateUserResponse activateUser(UUID userId);

    ActivateUserResponse deactivateUser(UUID userId);

    ActivateUserResponse lockUser(UUID userId);

    UpdateUserResponse updateUser(String authorizationHeader, UUID userId, UpdateUserRequest request);

    UpdateUserResponse updateUserAvatar(String authorizationHeader, UUID userId, MultipartFile avatar);
}
