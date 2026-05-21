package com.nqh.notificationservice.controllers;

import com.nqh.notificationservice.common.messages.MessageCode;
import com.nqh.notificationservice.common.response.ApiResponseFactory;
import com.nqh.notificationservice.common.response.BaseResponse;
import com.nqh.notificationservice.dtos.MarkMessageConversationReadResponse;
import com.nqh.notificationservice.dtos.MessageConversationListResponse;
import com.nqh.notificationservice.dtos.MessageConversationResponse;
import com.nqh.notificationservice.dtos.MessageEntryListResponse;
import com.nqh.notificationservice.dtos.MessageEntryResponse;
import com.nqh.notificationservice.dtos.OpenMessageConversationRequest;
import com.nqh.notificationservice.dtos.SendMessageRequest;
import com.nqh.notificationservice.enums.MessageParticipantRoleEnum;
import com.nqh.notificationservice.services.MessagingService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.Collection;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/messages")
@RequiredArgsConstructor
@Validated
public class MessageController {

    private final MessagingService messagingService;
    private final ApiResponseFactory apiResponseFactory;

    @PostMapping("/conversations/open")
    public ResponseEntity<BaseResponse<MessageConversationResponse>> openConversation(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(name = "X-User-Role", required = false) String forwardedUserRole,
            @RequestBody @Valid OpenMessageConversationRequest request,
            HttpServletRequest httpServletRequest
    ) {
        UUID currentUserId = UUID.fromString(jwt.getSubject());
        MessageParticipantRoleEnum currentRole = resolveRole(forwardedUserRole, jwt);
        String currentUserName = jwt.getClaimAsString("username");

        MessageConversationResponse response = messagingService.openConversation(
                currentUserId,
                currentUserName,
                currentRole,
                request
        );
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.MSG_CONVERSATION_OPEN_SUCCESS, response, httpServletRequest);
    }

    @GetMapping("/conversations")
    public ResponseEntity<BaseResponse<MessageConversationListResponse>> getConversations(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(name = "X-User-Role", required = false) String forwardedUserRole,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            HttpServletRequest httpServletRequest
    ) {
        UUID currentUserId = UUID.fromString(jwt.getSubject());
        MessageParticipantRoleEnum currentRole = resolveRole(forwardedUserRole, jwt);

        MessageConversationListResponse response = messagingService.getConversations(
                currentUserId,
                currentRole,
                page,
                size
        );
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.MSG_CONVERSATION_LIST_SUCCESS, response, httpServletRequest);
    }

    @GetMapping("/conversations/{conversationId}/messages")
    public ResponseEntity<BaseResponse<MessageEntryListResponse>> getConversationMessages(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(name = "X-User-Role", required = false) String forwardedUserRole,
            @PathVariable UUID conversationId,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "30") @Min(1) @Max(100) int size,
            @RequestParam(defaultValue = "true") boolean markAsRead,
            HttpServletRequest httpServletRequest
    ) {
        UUID currentUserId = UUID.fromString(jwt.getSubject());
        MessageParticipantRoleEnum currentRole = resolveRole(forwardedUserRole, jwt);

        MessageEntryListResponse response = messagingService.getConversationMessages(
                currentUserId,
                currentRole,
                conversationId,
                page,
                size,
                markAsRead
        );
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.MSG_MESSAGE_LIST_SUCCESS, response, httpServletRequest);
    }

    @PostMapping("/conversations/{conversationId}/messages")
    public ResponseEntity<BaseResponse<MessageEntryResponse>> sendMessage(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(name = "X-User-Role", required = false) String forwardedUserRole,
            @PathVariable UUID conversationId,
            @RequestBody @Valid SendMessageRequest request,
            HttpServletRequest httpServletRequest
    ) {
        UUID currentUserId = UUID.fromString(jwt.getSubject());
        MessageParticipantRoleEnum currentRole = resolveRole(forwardedUserRole, jwt);
        String currentUserName = jwt.getClaimAsString("username");

        MessageEntryResponse response = messagingService.sendMessage(
                currentUserId,
                currentUserName,
                currentRole,
                conversationId,
                request
        );
        return apiResponseFactory.success(HttpStatus.CREATED, MessageCode.MSG_MESSAGE_SEND_SUCCESS, response, httpServletRequest);
    }

    @PatchMapping("/conversations/{conversationId}/read")
    public ResponseEntity<BaseResponse<MarkMessageConversationReadResponse>> markConversationAsRead(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(name = "X-User-Role", required = false) String forwardedUserRole,
            @PathVariable UUID conversationId,
            HttpServletRequest httpServletRequest
    ) {
        UUID currentUserId = UUID.fromString(jwt.getSubject());
        MessageParticipantRoleEnum currentRole = resolveRole(forwardedUserRole, jwt);

        MarkMessageConversationReadResponse response = messagingService.markConversationAsRead(
                currentUserId,
                currentRole,
                conversationId
        );
        return apiResponseFactory.success(HttpStatus.OK, MessageCode.MSG_MARK_READ_SUCCESS, response, httpServletRequest);
    }

    private MessageParticipantRoleEnum resolveRole(String forwardedUserRole, Jwt jwt) {
        MessageParticipantRoleEnum roleFromHeader = resolveRoleFromHeader(forwardedUserRole, jwt);
        if (roleFromHeader != null) {
            return roleFromHeader;
        }

        if (jwt == null) {
            return MessageParticipantRoleEnum.USER;
        }
        if (containsIgnoreCase(jwt.getClaimAsStringList("roles"), "ADMIN")) {
            return MessageParticipantRoleEnum.ADMIN;
        }
        if (containsIgnoreCase(jwt.getClaimAsStringList("roles"), "SHOPEE_PARTNER")) {
            return MessageParticipantRoleEnum.PARTNER;
        }
        return MessageParticipantRoleEnum.USER;
    }

    private MessageParticipantRoleEnum resolveRoleFromHeader(String forwardedUserRole, Jwt jwt) {
        if (jwt == null) {
            return null;
        }

        String normalizedRole = normalize(forwardedUserRole);
        if (normalizedRole == null) {
            return null;
        }

        if (("ADMIN".equalsIgnoreCase(normalizedRole) || "ROLE_ADMIN".equalsIgnoreCase(normalizedRole))
                && containsIgnoreCase(jwt.getClaimAsStringList("roles"), "ADMIN")) {
            return MessageParticipantRoleEnum.ADMIN;
        }

        if (("SHOPEE_PARTNER".equalsIgnoreCase(normalizedRole) || "PARTNER".equalsIgnoreCase(normalizedRole))
                && containsIgnoreCase(jwt.getClaimAsStringList("roles"), "SHOPEE_PARTNER")) {
            return MessageParticipantRoleEnum.PARTNER;
        }

        if (("USER".equalsIgnoreCase(normalizedRole) || "CUSTOMER".equalsIgnoreCase(normalizedRole))
                && containsIgnoreCase(jwt.getClaimAsStringList("roles"), "USER")) {
            return MessageParticipantRoleEnum.USER;
        }

        return null;
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private boolean containsIgnoreCase(Collection<String> values, String expected) {
        if (values == null || values.isEmpty()) {
            return false;
        }
        return values.stream().anyMatch(value -> expected.equalsIgnoreCase(value));
    }
}
