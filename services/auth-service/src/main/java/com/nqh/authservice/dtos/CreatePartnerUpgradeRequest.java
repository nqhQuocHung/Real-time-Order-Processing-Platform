package com.nqh.authservice.dtos;

import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreatePartnerUpgradeRequest {

    @Size(max = 500, message = "Request note must be at most 500 characters")
    private String requestNote;
}
