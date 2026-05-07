package com.nqh.apigateway.configuration;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.web.server.SecurityWebFilterChain;

@Configuration
@EnableWebFluxSecurity
public class SecurityConfig {

    @Bean
    SecurityWebFilterChain springSecurityFilterChain(ServerHttpSecurity http) {
        return http
                .csrf(ServerHttpSecurity.CsrfSpec::disable)
                .authorizeExchange(ex -> ex
                        .pathMatchers("/actuator/health", "/actuator/info").permitAll()

                        .pathMatchers(
                                "/api/v1/auth/login",
                                "/api/v1/auth/register",
                                "/api/v1/auth/refresh-token",
                                "/api/v1/auth/otp-change-password",
                                "/api/v1/auth/change-password",
                                "/api/v1/auth/otp-forgot-password",
                                "/api/v1/auth/forgot-password"
                        ).permitAll()

                        .pathMatchers(
                                "/swagger-ui/**",
                                "/v3/api-docs/**",
                                "/webjars/**"
                        ).permitAll()

                        .pathMatchers(
                                "/actuator/auth/health",
                                "/actuator/orders/health",
                                "/actuator/inventory/health",
                                "/actuator/payments/health",
                                "/actuator/notifications/health"
                        ).permitAll()

                        .anyExchange().authenticated()
                )
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))
                .build();
    }
}
