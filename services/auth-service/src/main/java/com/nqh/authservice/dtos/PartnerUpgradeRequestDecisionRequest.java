package com.nqh.authservice.dtos;

import com.nqh.authservice.enums.PartnerRequestDecisionActionEnum;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PartnerUpgradeRequestDecisionRequest {

    @NotNull
    private PartnerRequestDecisionActionEnum action;

    @Size(max = 500, message = "Review note must be at most 500 characters")
    private String reviewNote;
}
