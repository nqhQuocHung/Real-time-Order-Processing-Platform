package com.nqh.authservice.configurations;

import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.oauth2.server.resource.web.BearerTokenAuthenticationEntryPoint;
import org.springframework.security.oauth2.server.resource.web.access.BearerTokenAccessDeniedHandler;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    private final String jwtSecretKey;

    public SecurityConfig(@Value("${jwt.secretKey}") String jwtSecretKey) {
        this.jwtSecretKey = jwtSecretKey;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .exceptionHandling(exception -> exception
                        .authenticationEntryPoint(new BearerTokenAuthenticationEntryPoint())
                        .accessDeniedHandler(new BearerTokenAccessDeniedHandler())
                )
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                "/api/v1/auth/register",
                                "/api/v1/auth/login",
                                "/api/v1/auth/refresh-token",
                                "/api/v1/auth/otp-change-password",
                                "/api/v1/auth/change-password",
                                "/api/v1/auth/otp-forgot-password",
                                "/api/v1/auth/forgot-password",
                                "/actuator/**",
                                "/swagger/**",
                                "/swagger-ui/**",
                                "/v3/api-docs/**"
                        ).permitAll()
                        .requestMatchers("/api/v1/auth/grant-permission").hasAuthority("PERM_MANAGE_USERS")
                        .requestMatchers("/api/v1/auth/roles/**").hasAuthority("PERM_MANAGE_USERS")
                        .requestMatchers("/api/v1/auth/menus/**").hasAuthority("PERM_MANAGE_USERS")
                        .requestMatchers("/api/v1/auth/permissions/**").hasAuthority("PERM_MANAGE_USERS")
                        .requestMatchers("/api/v1/auth/user/**").hasAuthority("PERM_MANAGE_USERS")
                        .requestMatchers("/api/v1/auth/users/**").hasAuthority("PERM_MANAGE_USERS")
                        .requestMatchers("/api/v1/auth/activate/**", "/api/v1/auth/deactivate/**")
                        .hasAuthority("PERM_MANAGE_USERS")
                        .requestMatchers("/api/v1/auth/lock/**").hasAuthority("PERM_MANAGE_USERS")
                        .anyRequest().authenticated()
                )
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> jwt
                        .jwtAuthenticationConverter(jwtAuthenticationConverter())
                ));
        return http.build();
    }

    @Bean
    public Converter<Jwt, ? extends AbstractAuthenticationToken> jwtAuthenticationConverter() {
        JwtGrantedAuthoritiesConverter roleConverter = new JwtGrantedAuthoritiesConverter();
        roleConverter.setAuthoritiesClaimName("roles");
        roleConverter.setAuthorityPrefix("ROLE_");

        JwtGrantedAuthoritiesConverter permissionConverter = new JwtGrantedAuthoritiesConverter();
        permissionConverter.setAuthoritiesClaimName("permissions");
        permissionConverter.setAuthorityPrefix("PERM_");

        JwtAuthenticationConverter authenticationConverter = new JwtAuthenticationConverter();
        authenticationConverter.setJwtGrantedAuthoritiesConverter(jwt -> {
            Set<GrantedAuthority> authorities = new HashSet<>();
            authorities.addAll(roleConverter.convert(jwt));
            authorities.addAll(permissionConverter.convert(jwt));
            return authorities;
        });
        return authenticationConverter;
    }

    @Bean
    public JwtDecoder jwtDecoder() {
        SecretKey key = new SecretKeySpec(jwtSecretKey.getBytes(StandardCharsets.UTF_8), "HmacSHA512");
        return NimbusJwtDecoder.withSecretKey(key)
                .macAlgorithm(MacAlgorithm.HS512)
                .build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
