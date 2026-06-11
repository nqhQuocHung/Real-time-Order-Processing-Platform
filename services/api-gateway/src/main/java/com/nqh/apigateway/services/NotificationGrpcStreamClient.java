package com.nqh.apigateway.services;

import com.nqh.realtime.v1.NotificationEvent;
import com.nqh.realtime.v1.NotificationStreamServiceGrpc;
import com.nqh.realtime.v1.SubscribeRequest;
import io.grpc.stub.ClientCallStreamObserver;
import io.grpc.stub.ClientResponseObserver;
import java.util.concurrent.atomic.AtomicReference;
import lombok.RequiredArgsConstructor;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.FluxSink;

@Service
@RequiredArgsConstructor
public class NotificationGrpcStreamClient {

    private final NotificationStreamServiceGrpc.NotificationStreamServiceStub notificationStreamStub;

    public Flux<ServerSentEvent<String>> subscribe(String userId, boolean isAdmin) {
        SubscribeRequest request = SubscribeRequest.newBuilder()
                .setUserId(userId)
                .setAdmin(isAdmin)
                .build();

        return Flux.create(sink -> openStream(request, sink), FluxSink.OverflowStrategy.BUFFER);
    }

    private void openStream(
            SubscribeRequest request,
            FluxSink<ServerSentEvent<String>> sink
    ) {
        AtomicReference<ClientCallStreamObserver<SubscribeRequest>> callRef = new AtomicReference<>();

        ClientResponseObserver<SubscribeRequest, NotificationEvent> observer =
                new ClientResponseObserver<>() {
                    @Override
                    public void beforeStart(
                            ClientCallStreamObserver<SubscribeRequest> requestStream
                    ) {
                        callRef.set(requestStream);
                    }

                    @Override
                    public void onNext(NotificationEvent event) {
                        sink.next(ServerSentEvent.<String>builder()
                                .id(event.getEventId())
                                .event(event.getEventName())
                                .data(event.getDataJson())
                                .build());
                    }

                    @Override
                    public void onError(Throwable throwable) {
                        if (!sink.isCancelled()) {
                            sink.error(throwable);
                        }
                    }

                    @Override
                    public void onCompleted() {
                        sink.complete();
                    }
                };

        notificationStreamStub.subscribe(request, observer);
        sink.onDispose(() -> {
            ClientCallStreamObserver<SubscribeRequest> call = callRef.get();
            if (call != null) {
                call.cancel("SSE client disconnected.", null);
            }
        });
    }
}
