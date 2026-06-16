package com.nqh.apigateway.controllers;

import com.nqh.apigateway.services.NotificationGrpcStreamClient;
import com.nqh.apigateway.services.MonitoringStreamState;
import java.util.Collection;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

@RestController
@RequiredArgsConstructor
public class NotificationStreamController {

    private final NotificationGrpcStreamClient notificationGrpcStreamClient;
    private final MonitoringStreamState monitoringStreamState;

    @GetMapping(
            value = "/api/v1/notifications/stream",
            produces = MediaType.TEXT_EVENT_STREAM_VALUE
    )
    public Flux<ServerSentEvent<String>> streamNotifications(
            @AuthenticationPrincipal Jwt jwt
    ) {
        if (jwt == null || jwt.getSubject() == null || jwt.getSubject().isBlank()) {
            return Flux.error(new IllegalStateException(
                    "Cannot resolve userId for notification stream."
            ));
        }

        return notificationGrpcStreamClient.subscribe(
                        jwt.getSubject().trim(),
                        isAdminUser(jwt)
                )
                .doOnSubscribe(subscription -> monitoringStreamState.notificationConnected())
                .doFinally(signalType -> monitoringStreamState.notificationDisconnected());
    }

    private boolean isAdminUser(Jwt jwt) {
        return containsIgnoreCase(jwt.getClaimAsStringList("roles"), "ADMIN")
                || containsIgnoreCase(
                        jwt.getClaimAsStringList("permissions"),
                        "MANAGE_PARTNERS"
                );
    }

    private boolean containsIgnoreCase(Collection<String> values, String expected) {
        if (values == null || values.isEmpty()) {
            return false;
        }
        return values.stream().anyMatch(value -> expected.equalsIgnoreCase(value));
    }
}
