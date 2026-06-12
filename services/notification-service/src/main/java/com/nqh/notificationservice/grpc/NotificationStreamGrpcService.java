package com.nqh.notificationservice.grpc;

import com.nqh.notificationservice.services.AdminSseService;
import com.nqh.realtime.v1.NotificationEvent;
import com.nqh.realtime.v1.NotificationStreamServiceGrpc;
import com.nqh.realtime.v1.SubscribeRequest;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class NotificationStreamGrpcService
        extends NotificationStreamServiceGrpc.NotificationStreamServiceImplBase {

    private final AdminSseService realtimeStreamService;

    @Override
    public void subscribe(
            SubscribeRequest request,
            StreamObserver<NotificationEvent> responseObserver
    ) {
        if (!StringUtils.hasText(request.getUserId())) {
            responseObserver.onError(
                    Status.INVALID_ARGUMENT
                            .withDescription("user_id is required.")
                            .asRuntimeException()
            );
            return;
        }

        realtimeStreamService.subscribeGrpc(
                request.getUserId().trim(),
                request.getAdmin(),
                responseObserver
        );
    }
}
