package com.nqh.authservice.dtos;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ForgotPasswordOtpRequest {

    @NotBlank
    private String usernameOrEmail;
}
