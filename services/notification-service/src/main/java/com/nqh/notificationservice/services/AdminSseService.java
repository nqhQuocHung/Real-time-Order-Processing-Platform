package com.nqh.notificationservice.services;

import com.nqh.realtime.v1.NotificationEvent;
import io.grpc.stub.StreamObserver;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

public interface AdminSseService {

    SseEmitter subscribe(String userId, boolean isAdmin);

    void subscribeGrpc(String userId, boolean isAdmin, StreamObserver<NotificationEvent> responseObserver);

    void sendToAdmins(String eventName, Object data);

    void sendToUser(String userId, String eventName, Object data);

    void sendToAllUsers(String eventName, Object data);
}
