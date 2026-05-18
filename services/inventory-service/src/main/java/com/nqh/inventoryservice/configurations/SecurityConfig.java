package com.nqh.inventoryservice.configurations;

import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.oauth2.server.resource.web.BearerTokenAuthenticationEntryPoint;
import org.springframework.security.oauth2.server.resource.web.access.BearerTokenAccessDeniedHandler;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class SecurityConfig {

    private final String jwtSecretKey;

    public SecurityConfig(@Value("${jwt.secretKey}") String jwtSecretKey) {
        this.jwtSecretKey = jwtSecretKey;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(Customizer.withDefaults())
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .exceptionHandling(exception -> exception
                        .authenticationEntryPoint(new BearerTokenAuthenticationEntryPoint())
                        .accessDeniedHandler(new BearerTokenAccessDeniedHandler())
                )
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(
                                "/actuator/**",
                                "/swagger/**",
                                "/swagger-ui/**",
                                "/v3/api-docs/**",
                                "/internal/**"
                        ).permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/inventories/catalog")
                        .hasAnyAuthority(
                                "PERM_VIEW_PRODUCT_CATALOG",
                                "PERM_MANAGE_PARTNER_PRODUCTS",
                                "PERM_MANAGE_PARTNER_INVENTORY",
                                "PERM_MANAGE_PRODUCTS",
                                "PERM_MANAGE_ALL_ORDERS"
                        )
                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/v1/inventories/products/*/reviews",
                                "/api/v1/inventories/products/*/review-stats"
                        )
                        .hasAnyAuthority(
                                "PERM_VIEW_PRODUCT_CATALOG",
                                "PERM_MANAGE_SELF_ORDERS",
                                "PERM_MANAGE_PARTNER_PRODUCTS",
                                "PERM_MANAGE_PRODUCTS",
                                "PERM_MANAGE_ALL_ORDERS"
                        )
                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/v1/inventories/products/*/reviews",
                                "/api/v1/inventories/reviews/*/comments"
                        )
                        .hasAnyAuthority(
                                "PERM_MANAGE_SELF_ORDERS",
                                "PERM_MANAGE_PARTNER_PRODUCTS",
                                "PERM_MANAGE_PRODUCTS",
                                "PERM_MANAGE_ALL_ORDERS"
                        )
                        .requestMatchers(HttpMethod.PUT, "/api/v1/inventories/reviews/*")
                        .hasAnyAuthority(
                                "PERM_MANAGE_SELF_ORDERS",
                                "PERM_MANAGE_PARTNER_PRODUCTS",
                                "PERM_MANAGE_PRODUCTS",
                                "PERM_MANAGE_ALL_ORDERS"
                        )
                        .requestMatchers(HttpMethod.GET, "/api/v1/inventories/my-products")
                        .hasAnyAuthority("PERM_MANAGE_PARTNER_PRODUCTS", "PERM_MANAGE_PRODUCTS")
                        .requestMatchers(HttpMethod.GET, "/api/v1/inventories/admin/products")
                        .hasAnyAuthority("PERM_MANAGE_PRODUCTS")
                        .requestMatchers(HttpMethod.GET, "/api/v1/inventories/categories")
                        .hasAnyAuthority("PERM_MANAGE_PARTNER_PRODUCTS", "PERM_MANAGE_PRODUCTS")
                        .requestMatchers(HttpMethod.POST, "/api/v1/inventories/categories")
                        .hasAnyAuthority("PERM_MANAGE_PRODUCT_CATEGORIES")
                        .requestMatchers(HttpMethod.PUT, "/api/v1/inventories/categories/*")
                        .hasAnyAuthority("PERM_MANAGE_PRODUCT_CATEGORIES")
                        .requestMatchers(HttpMethod.DELETE, "/api/v1/inventories/categories/*")
                        .hasAnyAuthority("PERM_MANAGE_PRODUCT_CATEGORIES")
                        .requestMatchers(HttpMethod.POST, "/api/v1/inventories/products")
                        .hasAnyAuthority("PERM_MANAGE_PARTNER_PRODUCTS", "PERM_MANAGE_PRODUCTS")
                        .requestMatchers(HttpMethod.PUT, "/api/v1/inventories/products/*")
                        .hasAnyAuthority("PERM_MANAGE_PARTNER_PRODUCTS", "PERM_MANAGE_PRODUCTS")
                        .requestMatchers(HttpMethod.DELETE, "/api/v1/inventories/products/*")
                        .hasAnyAuthority("PERM_MANAGE_PARTNER_PRODUCTS", "PERM_MANAGE_PRODUCTS")
                        .requestMatchers(HttpMethod.POST, "/api/v1/inventories/products/upload-image")
                        .hasAnyAuthority("PERM_MANAGE_PARTNER_PRODUCTS", "PERM_MANAGE_PRODUCTS")
                        .requestMatchers(HttpMethod.GET, "/api/v1/inventories/*")
                        .hasAnyAuthority("PERM_MANAGE_PARTNER_INVENTORY", "PERM_MANAGE_PRODUCTS", "PERM_MANAGE_ALL_ORDERS")
                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/v1/inventories/check",
                                "/api/v1/inventories/reserve",
                                "/api/v1/inventories/release",
                                "/api/v1/inventories/confirm-deduct"
                        )
                        .hasAnyAuthority("PERM_MANAGE_ALL_ORDERS", "PERM_MANAGE_PARTNER_ORDERS", "PERM_MANAGE_PARTNER_INVENTORY")
                        .requestMatchers(HttpMethod.POST, "/api/v1/inventories/adjust")
                        .hasAnyAuthority("PERM_MANAGE_PRODUCTS", "PERM_MANAGE_PARTNER_INVENTORY")
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
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(
                "http://localhost:5173",
                "http://192.168.88.136:5173",
                "http://10.53.68.83:5173",
                "http://172.26.0.1:5173"
        ));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setExposedHeaders(List.of("Authorization", "Content-Type"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
