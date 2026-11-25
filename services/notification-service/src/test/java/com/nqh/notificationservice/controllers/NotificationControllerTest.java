package com.nqh.notificationservice.controllers;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.nqh.notificationservice.common.response.ApiResponseFactory;
import com.nqh.notificationservice.services.AdminSseService;
import com.nqh.notificationservice.services.NotificationService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@ExtendWith(MockitoExtension.class)
class NotificationControllerTest {

    @Mock
    private NotificationService notificationService;

    @Mock
    private ApiResponseFactory apiResponseFactory;

    @Mock
    private AdminSseService adminSseService;

    @Test
    void streamUsesJwtRoleForNonAdminUser() {
        NotificationController controller = new NotificationController(
                notificationService,
                apiResponseFactory,
                adminSseService
        );
        Jwt jwt = jwtWithRole("USER");
        SseEmitter emitter = new SseEmitter();
        when(adminSseService.subscribe("user-1", false)).thenReturn(emitter);

        SseEmitter result = controller.streamNotifications(jwt);

        assertSame(emitter, result);
        verify(adminSseService).subscribe("user-1", false);
    }

    @Test
    void streamUsesJwtRoleForAdminUser() {
        NotificationController controller = new NotificationController(
                notificationService,
                apiResponseFactory,
                adminSseService
        );
        Jwt jwt = jwtWithRole("ADMIN");
        SseEmitter emitter = new SseEmitter();
        when(adminSseService.subscribe("user-1", true)).thenReturn(emitter);

        SseEmitter result = controller.streamNotifications(jwt);

        assertSame(emitter, result);
        verify(adminSseService).subscribe("user-1", true);
    }

    private Jwt jwtWithRole(String role) {
        return Jwt.withTokenValue("test-token")
                .header("alg", "HS512")
                .subject("user-1")
                .claim("roles", List.of(role))
                .build();
    }
}
