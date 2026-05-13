package com.nqh.authservice.dtos;

import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreatePartnerUpgradeRequest {

    @NotBlank(message = "Shop name is required")
    @Size(max = 120, message = "Shop name must be at most 120 characters")
    private String shopName;

    @Size(max = 500, message = "Request note must be at most 500 characters")
    private String requestNote;
}
