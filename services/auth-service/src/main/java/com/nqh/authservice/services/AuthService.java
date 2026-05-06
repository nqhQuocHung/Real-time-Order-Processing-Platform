package com.nqh.authservice.services;

import com.nqh.authservice.dtos.ActivateUserResponse;
import com.nqh.authservice.dtos.ChangePasswordOtpRequest;
import com.nqh.authservice.dtos.ChangePasswordOtpResponse;
import com.nqh.authservice.dtos.ChangePasswordRequest;
import com.nqh.authservice.dtos.ChangePasswordResponse;
import com.nqh.authservice.dtos.LoginRequest;
import com.nqh.authservice.dtos.LoginResponse;
import com.nqh.authservice.dtos.RefreshTokenRequest;
import com.nqh.authservice.dtos.RefreshTokenResponse;
import com.nqh.authservice.dtos.RegisterRequest;
import com.nqh.authservice.dtos.RegisterResponse;
import com.nqh.authservice.dtos.UserProfileResponse;
import java.util.UUID;

public interface AuthService {

    RegisterResponse register(RegisterRequest request);

    LoginResponse login(LoginRequest request);

    ChangePasswordOtpResponse sendChangePasswordOtp(ChangePasswordOtpRequest request);

    ChangePasswordResponse changePassword(ChangePasswordRequest request);

    RefreshTokenResponse refreshToken(RefreshTokenRequest request);

    UserProfileResponse me(String authorizationHeader);

    UserProfileResponse getUserById(UUID userId);

    ActivateUserResponse activateUser(UUID userId);

    ActivateUserResponse deactivateUser(UUID userId);
}
