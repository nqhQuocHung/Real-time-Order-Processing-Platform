package com.nqh.apigateway.controllers;

import com.nqh.apigateway.dtos.MonitoringSnapshot;
import com.nqh.apigateway.services.MonitoringSnapshotService;
import com.nqh.apigateway.services.MonitoringStreamState;
import java.time.Duration;
import java.util.Collection;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/admin/monitoring")
public class AdminMonitoringController {

    private final MonitoringSnapshotService monitoringSnapshotService;
    private final MonitoringStreamState monitoringStreamState;

    @Value("${app.monitoring.stream-interval-ms:5000}")
    private long streamIntervalMs;

    @GetMapping("/summary")
    public Mono<MonitoringSnapshot> summary(@AuthenticationPrincipal Jwt jwt) {
        assertMonitoringAccess(jwt);
        return monitoringSnapshotService.collectSnapshot();
    }

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<MonitoringSnapshot>> stream(@AuthenticationPrincipal Jwt jwt) {
        assertMonitoringAccess(jwt);
        long safeInterval = Math.max(1000, streamIntervalMs);
        return Flux.interval(Duration.ZERO, Duration.ofMillis(safeInterval))
                .flatMap(tick -> monitoringSnapshotService.collectSnapshot())
                .map(snapshot -> ServerSentEvent.builder(snapshot)
                        .event("monitoring.snapshot")
                        .id(snapshot.capturedAt().toString())
                        .build())
                .doOnSubscribe(subscription -> monitoringStreamState.monitoringConnected())
                .doFinally(signalType -> monitoringStreamState.monitoringDisconnected());
    }

    private void assertMonitoringAccess(Jwt jwt) {
        if (jwt == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required.");
        }
        if (
                containsIgnoreCase(jwt.getClaimAsStringList("roles"), "ADMIN")
                        || containsIgnoreCase(jwt.getClaimAsStringList("permissions"), "VIEW_SYSTEM_MONITORING")
                        || containsIgnoreCase(jwt.getClaimAsStringList("permissions"), "MANAGE_SYSTEM_SETTINGS")
        ) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "System monitoring permission is required.");
    }

    private boolean containsIgnoreCase(Collection<String> values, String expected) {
        if (values == null || values.isEmpty()) {
            return false;
        }
        return values.stream().anyMatch(value -> expected.equalsIgnoreCase(value));
    }
}
