package com.nqh.apigateway.controllers;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.nqh.apigateway.services.NotificationGrpcStreamClient;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.security.oauth2.jwt.Jwt;
import reactor.core.publisher.Flux;
import reactor.test.StepVerifier;

class NotificationStreamControllerTest {

    private final NotificationGrpcStreamClient streamClient =
            org.mockito.Mockito.mock(NotificationGrpcStreamClient.class);
    private final NotificationStreamController controller =
            new NotificationStreamController(streamClient);

    @Test
    void forwardsJwtIdentityAndAdminRoleToGrpcClient() {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .subject("admin-1")
                .claim("roles", List.of("ADMIN"))
                .build();
        ServerSentEvent<String> connected = ServerSentEvent.<String>builder()
                .event("connected")
                .data("{\"userId\":\"admin-1\"}")
                .build();
        when(streamClient.subscribe("admin-1", true)).thenReturn(Flux.just(connected));

        StepVerifier.create(controller.streamNotifications(jwt))
                .expectNext(connected)
                .verifyComplete();

        verify(streamClient).subscribe("admin-1", true);
    }
}
