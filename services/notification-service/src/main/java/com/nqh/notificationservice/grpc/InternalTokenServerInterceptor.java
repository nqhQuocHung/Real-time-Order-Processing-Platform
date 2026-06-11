package com.nqh.notificationservice.grpc;

import io.grpc.Context;
import io.grpc.Contexts;
import io.grpc.Metadata;
import io.grpc.ServerCall;
import io.grpc.ServerCallHandler;
import io.grpc.ServerInterceptor;
import io.grpc.Status;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class InternalTokenServerInterceptor implements ServerInterceptor {

    private static final Metadata.Key<String> INTERNAL_TOKEN_KEY =
            Metadata.Key.of("x-internal-token", Metadata.ASCII_STRING_MARSHALLER);

    private final byte[] expectedToken;

    public InternalTokenServerInterceptor(
            @Value("${app.notification.grpc.internal-token}") String internalToken
    ) {
        this.expectedToken = internalToken.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    public <ReqT, RespT> ServerCall.Listener<ReqT> interceptCall(
            ServerCall<ReqT, RespT> call,
            Metadata headers,
            ServerCallHandler<ReqT, RespT> next
    ) {
        String providedToken = headers.get(INTERNAL_TOKEN_KEY);
        if (!isValid(providedToken)) {
            call.close(Status.UNAUTHENTICATED.withDescription("Invalid internal RPC token."), new Metadata());
            return new ServerCall.Listener<>() {
            };
        }
        return Contexts.interceptCall(Context.current(), call, headers, next);
    }

    private boolean isValid(String providedToken) {
        if (providedToken == null) {
            return false;
        }
        return MessageDigest.isEqual(
                expectedToken,
                providedToken.getBytes(StandardCharsets.UTF_8)
        );
    }
}
