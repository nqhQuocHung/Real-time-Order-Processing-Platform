package com.nqh.apigateway.configuration;

import com.nqh.realtime.v1.NotificationStreamServiceGrpc;
import io.grpc.Channel;
import io.grpc.ClientInterceptors;
import io.grpc.ManagedChannel;
import io.grpc.Metadata;
import io.grpc.netty.NettyChannelBuilder;
import io.grpc.stub.MetadataUtils;
import java.util.concurrent.TimeUnit;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class NotificationGrpcClientConfig {

    private static final Metadata.Key<String> INTERNAL_TOKEN_KEY =
            Metadata.Key.of("x-internal-token", Metadata.ASCII_STRING_MARSHALLER);

    @Bean(destroyMethod = "shutdownNow")
    ManagedChannel notificationGrpcChannel(
            @Value("${app.notification.grpc.host:localhost}") String host,
            @Value("${app.notification.grpc.port:9095}") int port
    ) {
        return NettyChannelBuilder.forAddress(host, port)
                .usePlaintext()
                .keepAliveTime(30, TimeUnit.SECONDS)
                .keepAliveWithoutCalls(true)
                .build();
    }

    @Bean
    NotificationStreamServiceGrpc.NotificationStreamServiceStub notificationStreamStub(
            ManagedChannel notificationGrpcChannel,
            @Value("${app.notification.grpc.internal-token}") String internalToken
    ) {
        Metadata headers = new Metadata();
        headers.put(INTERNAL_TOKEN_KEY, internalToken);
        Channel authenticatedChannel = ClientInterceptors.intercept(
                notificationGrpcChannel,
                MetadataUtils.newAttachHeadersInterceptor(headers)
        );
        return NotificationStreamServiceGrpc.newStub(authenticatedChannel);
    }
}
