package com.nqh.authservice.controllers;

import com.nqh.authservice.common.messages.MessageCode;
import com.nqh.authservice.common.response.ApiResponseFactory;
import com.nqh.authservice.common.response.BaseResponse;
import com.nqh.authservice.dtos.ActivateUserResponse;
import com.nqh.authservice.dtos.CheckRoleResponse;
import com.nqh.authservice.dtos.ChangePasswordOtpRequest;
import com.nqh.authservice.dtos.ChangePasswordOtpResponse;
import com.nqh.authservice.dtos.ChangePasswordRequest;
import com.nqh.authservice.dtos.ChangePasswordResponse;
import com.nqh.authservice.dtos.ForgotPasswordOtpRequest;
import com.nqh.authservice.dtos.ForgotPasswordOtpResponse;
import com.nqh.authservice.dtos.ForgotPasswordRequest;
import com.nqh.authservice.dtos.ForgotPasswordResponse;
import com.nqh.authservice.dtos.GrantPermissionRequest;
import com.nqh.authservice.dtos.GrantPermissionResponse;
import com.nqh.authservice.dtos.LoginRequest;
import com.nqh.authservice.dtos.LoginResponse;
import com.nqh.authservice.dtos.RefreshTokenRequest;
import com.nqh.authservice.dtos.RefreshTokenResponse;
import com.nqh.authservice.dtos.RegisterRequest;
import com.nqh.authservice.dtos.RegisterResponse;
import com.nqh.authservice.dtos.UpdateUserRequest;
import com.nqh.authservice.dtos.UpdateUserResponse;
import com.nqh.authservice.dtos.UserProfileResponse;
import com.nqh.authservice.services.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final ApiResponseFactory apiResponseFactory;

    @PostMapping(value = "/register", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<BaseResponse<RegisterResponse>> register(
            @Valid @ModelAttribute RegisterRequest request,
            HttpServletRequest httpServletRequest
    ) {
        RegisterResponse response = authService.register(request);
        return apiResponseFactory.success(HttpStatus.CREATED, MessageCode.COMMON_SUCCESS, response, httpServletRequest);
    }

    @PostMapping("/login")
    public ResponseEntity<BaseResponse<LoginResponse>> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpServletRequest
    ) {
        LoginResponse response = authService.login(request);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.COMMON_SUCCESS, response, httpServletRequest);
    }

    @PostMapping("/otp-change-password")
    public ResponseEntity<BaseResponse<ChangePasswordOtpResponse>> sendChangePasswordOtp(
            @Valid @RequestBody ChangePasswordOtpRequest request,
            HttpServletRequest httpServletRequest
    ) {
        ChangePasswordOtpResponse response = authService.sendChangePasswordOtp(request);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.COMMON_SUCCESS, response, httpServletRequest);
    }

    @PostMapping("/change-password")
    public ResponseEntity<BaseResponse<ChangePasswordResponse>> changePassword(
            @Valid @RequestBody ChangePasswordRequest request,
            HttpServletRequest httpServletRequest
    ) {
        ChangePasswordResponse response = authService.changePassword(request);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.COMMON_SUCCESS, response, httpServletRequest);
    }

    @PostMapping("/otp-forgot-password")
    public ResponseEntity<BaseResponse<ForgotPasswordOtpResponse>> sendForgotPasswordOtp(
            @Valid @RequestBody ForgotPasswordOtpRequest request,
            HttpServletRequest httpServletRequest
    ) {
        ForgotPasswordOtpResponse response = authService.sendForgotPasswordOtp(request);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.COMMON_SUCCESS, response, httpServletRequest);
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<BaseResponse<ForgotPasswordResponse>> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request,
            HttpServletRequest httpServletRequest
    ) {
        ForgotPasswordResponse response = authService.forgotPassword(request);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.COMMON_SUCCESS, response, httpServletRequest);
    }

    @PostMapping("/refresh-token")
    public ResponseEntity<BaseResponse<RefreshTokenResponse>> refreshToken(
            @Valid @RequestBody RefreshTokenRequest request,
            HttpServletRequest httpServletRequest
    ) {
        RefreshTokenResponse response = authService.refreshToken(request);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.COMMON_SUCCESS, response, httpServletRequest);
    }

    @GetMapping("/me")
    public ResponseEntity<BaseResponse<UserProfileResponse>> me(
            @RequestHeader(name = "Authorization", required = false) String authorizationHeader,
            HttpServletRequest httpServletRequest
    ) {
        UserProfileResponse response = authService.me(authorizationHeader);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.COMMON_SUCCESS, response, httpServletRequest);
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<BaseResponse<UserProfileResponse>> getUserById(
            @PathVariable UUID userId,
            HttpServletRequest httpServletRequest
    ) {
        UserProfileResponse response = authService.getUserById(userId);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.COMMON_SUCCESS, response, httpServletRequest);
    }

    @GetMapping("/check-role/{roleCode}")
    public ResponseEntity<BaseResponse<CheckRoleResponse>> checkRole(
            @PathVariable String roleCode,
            @RequestHeader(name = "Authorization", required = false) String authorizationHeader,
            HttpServletRequest httpServletRequest
    ) {
        CheckRoleResponse response = authService.checkRole(authorizationHeader, roleCode);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.COMMON_SUCCESS, response, httpServletRequest);
    }

    @PostMapping("/grant-permission")
    public ResponseEntity<BaseResponse<GrantPermissionResponse>> grantPermission(
            @RequestHeader(name = "Authorization", required = false) String authorizationHeader,
            @Valid @RequestBody GrantPermissionRequest request,
            HttpServletRequest httpServletRequest
    ) {
        GrantPermissionResponse response = authService.grantPermission(authorizationHeader, request);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.COMMON_SUCCESS, response, httpServletRequest);
    }

    @PatchMapping("/activate/{userId}")
    public ResponseEntity<BaseResponse<ActivateUserResponse>> activateUser(
            @PathVariable UUID userId,
            HttpServletRequest httpServletRequest
    ) {
        ActivateUserResponse response = authService.activateUser(userId);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.COMMON_SUCCESS, response, httpServletRequest);
    }

    @PatchMapping("/deactivate/{userId}")
    public ResponseEntity<BaseResponse<ActivateUserResponse>> deactivateUser(
            @PathVariable UUID userId,
            HttpServletRequest httpServletRequest
    ) {
        ActivateUserResponse response = authService.deactivateUser(userId);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.COMMON_SUCCESS, response, httpServletRequest);
    }

    @PatchMapping("/user/{userId}")
    public ResponseEntity<BaseResponse<UpdateUserResponse>> updateUser(
            @RequestHeader(name = "Authorization", required = false) String authorizationHeader,
            @PathVariable UUID userId,
            @Valid @RequestBody UpdateUserRequest request,
            HttpServletRequest httpServletRequest
    ) {
        UpdateUserResponse response = authService.updateUser(authorizationHeader, userId, request);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.COMMON_SUCCESS, response, httpServletRequest);
    }

    @PostMapping(value = "/user/{userId}/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<BaseResponse<UpdateUserResponse>> updateUserAvatar(
            @RequestHeader(name = "Authorization", required = false) String authorizationHeader,
            @PathVariable UUID userId,
            @RequestParam("avatar") MultipartFile avatar,
            HttpServletRequest httpServletRequest
    ) {
        UpdateUserResponse response = authService.updateUserAvatar(authorizationHeader, userId, avatar);
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.COMMON_SUCCESS, response, httpServletRequest);
    }
}
