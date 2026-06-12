package com.nqh.notificationservice.grpc;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nqh.notificationservice.services.impl.AdminSseServiceImpl;
import com.nqh.realtime.v1.NotificationEvent;
import com.nqh.realtime.v1.NotificationStreamServiceGrpc;
import com.nqh.realtime.v1.SubscribeRequest;
import io.grpc.ClientInterceptors;
import io.grpc.ManagedChannel;
import io.grpc.Metadata;
import io.grpc.Server;
import io.grpc.ServerInterceptors;
import io.grpc.Status;
import io.grpc.netty.shaded.io.grpc.netty.NettyChannelBuilder;
import io.grpc.netty.shaded.io.grpc.netty.NettyServerBuilder;
import io.grpc.stub.MetadataUtils;
import io.grpc.stub.StreamObserver;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class NotificationGrpcTransportTest {

    private static final String INTERNAL_TOKEN = "test-internal-token";
    private static final Metadata.Key<String> INTERNAL_TOKEN_KEY =
            Metadata.Key.of("x-internal-token", Metadata.ASCII_STRING_MARSHALLER);

    private final AdminSseServiceImpl realtimeStreamService =
            new AdminSseServiceImpl(new ObjectMapper());
    private Server server;
    private ManagedChannel channel;

    @BeforeEach
    void startGrpcServer() throws Exception {
        NotificationStreamGrpcService grpcService =
                new NotificationStreamGrpcService(realtimeStreamService);
        server = NettyServerBuilder.forPort(0)
                .addService(ServerInterceptors.intercept(
                        grpcService,
                        new InternalTokenServerInterceptor(INTERNAL_TOKEN)
                ))
                .build()
                .start();
        channel = NettyChannelBuilder.forAddress("localhost", server.getPort())
                .usePlaintext()
                .build();
    }

    @AfterEach
    void stopGrpcServer() throws Exception {
        channel.shutdownNow().awaitTermination(5, TimeUnit.SECONDS);
        server.shutdownNow().awaitTermination(5, TimeUnit.SECONDS);
    }

    @Test
    void streamsTargetedEventOverAuthenticatedGrpcHttp2Channel() throws Exception {
        Metadata headers = new Metadata();
        headers.put(INTERNAL_TOKEN_KEY, INTERNAL_TOKEN);
        NotificationStreamServiceGrpc.NotificationStreamServiceStub stub =
                NotificationStreamServiceGrpc.newStub(ClientInterceptors.intercept(
                        channel,
                        MetadataUtils.newAttachHeadersInterceptor(headers)
                ));
        RecordingObserver observer = new RecordingObserver();

        stub.subscribe(
                SubscribeRequest.newBuilder()
                        .setUserId("user-1")
                        .build(),
                observer
        );

        assertThat(observer.connected.await(5, TimeUnit.SECONDS)).isTrue();
        realtimeStreamService.sendToUser(
                "user-1",
                "order.lifecycle.paid",
                Map.of("orderCode", "ORD-HTTP2")
        );

        assertThat(observer.targetedEvent.await(5, TimeUnit.SECONDS)).isTrue();
        assertThat(observer.events)
                .extracting(NotificationEvent::getEventName)
                .containsExactly("connected", "order.lifecycle.paid");
        assertThat(observer.events.get(1).getDataJson()).contains("ORD-HTTP2");
    }

    @Test
    void rejectsGrpcStreamWithoutInternalToken() throws Exception {
        RecordingObserver observer = new RecordingObserver();

        NotificationStreamServiceGrpc.newStub(channel).subscribe(
                SubscribeRequest.newBuilder()
                        .setUserId("user-1")
                        .build(),
                observer
        );

        assertThat(observer.failed.await(5, TimeUnit.SECONDS)).isTrue();
        assertThat(Status.fromThrowable(observer.error).getCode())
                .isEqualTo(Status.Code.UNAUTHENTICATED);
    }

    private static final class RecordingObserver implements StreamObserver<NotificationEvent> {

        private final List<NotificationEvent> events = new CopyOnWriteArrayList<>();
        private final CountDownLatch connected = new CountDownLatch(1);
        private final CountDownLatch targetedEvent = new CountDownLatch(1);
        private final CountDownLatch failed = new CountDownLatch(1);
        private volatile Throwable error;

        @Override
        public void onNext(NotificationEvent event) {
            events.add(event);
            if ("connected".equals(event.getEventName())) {
                connected.countDown();
            } else {
                targetedEvent.countDown();
            }
        }

        @Override
        public void onError(Throwable throwable) {
            error = throwable;
            failed.countDown();
        }

        @Override
        public void onCompleted() {
        }
    }
}
