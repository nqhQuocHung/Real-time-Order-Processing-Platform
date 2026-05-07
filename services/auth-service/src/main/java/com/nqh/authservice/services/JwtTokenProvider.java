package com.nqh.authservice.services;

import com.nqh.authservice.pojos.Role;
import com.nqh.authservice.pojos.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class JwtTokenProvider {

    private final SecretKey secretKey;
    private final long expirationMillis;
    private final long refreshExpirationMillis;
    private final String tokenType;

    public JwtTokenProvider(
            @Value("${jwt.secretKey}") String secret,
            @Value("${jwt.expiration}") long expirationMillis,
            @Value("${jwt.refresh-expiration}") long refreshExpirationMillis,
            @Value("${jwt.type:Bearer}") String tokenType
    ) {
        this.secretKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMillis = expirationMillis;
        this.refreshExpirationMillis = refreshExpirationMillis;
        this.tokenType = tokenType;
    }

    public String generateAccessToken(User user) {
        return buildToken(user, expirationMillis);
    }

    public String generateRefreshToken(User user) {
        return buildToken(user, refreshExpirationMillis);
    }

    public UUID extractUserId(String token) {
        String subject = parseClaims(token).getSubject();
        return UUID.fromString(subject);
    }

    public boolean isTokenValid(String token, UUID userId) {
        try {
            Claims claims = parseClaims(token);
            String subject = claims.getSubject();
            Date expiration = claims.getExpiration();
            return userId.toString().equals(subject)
                    && expiration != null
                    && expiration.after(new Date());
        } catch (Exception ex) {
            return false;
        }
    }

    public long getRefreshExpirationMillis() {
        return refreshExpirationMillis;
    }

    private String buildToken(User user, long ttlMillis) {
        Instant now = Instant.now();
        Instant expiration = now.plusMillis(ttlMillis);
        List<String> roles = user.getRoles().stream()
                .map(Role::getCode)
                .filter(Objects::nonNull)
                .distinct()
                .sorted()
                .toList();
        List<String> permissions = user.getRoles().stream()
                .flatMap(role -> role.getPermissions().stream())
                .map(permission -> permission.getCode())
                .filter(Objects::nonNull)
                .distinct()
                .sorted()
                .toList();

        return Jwts.builder()
                .subject(user.getId().toString())
                .claim("username", user.getUsername())
                .claim("email", user.getEmail())
                .claim("roles", roles)
                .claim("permissions", permissions)
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiration))
                .signWith(secretKey)
                .compact();
    }

    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public long getExpirationMillis() {
        return expirationMillis;
    }

    public String getTokenType() {
        return tokenType;
    }
}
