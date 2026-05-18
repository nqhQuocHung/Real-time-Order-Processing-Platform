package com.nqh.notificationservice.dtos;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class OpenMessageConversationRequest {

    @NotNull
    private UUID partnerUserId;

    private String partnerDisplayName;

    private UUID productId;

    private String productName;
}
