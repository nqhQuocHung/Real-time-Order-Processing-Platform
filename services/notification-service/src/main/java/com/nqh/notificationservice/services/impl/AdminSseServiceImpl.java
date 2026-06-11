package com.nqh.notificationservice.services.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nqh.notificationservice.services.AdminSseService;
import com.nqh.realtime.v1.NotificationEvent;
import io.grpc.stub.ServerCallStreamObserver;
import io.grpc.stub.StreamObserver;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Service
public class AdminSseServiceImpl implements AdminSseService {

    private final List<SseEmitter> adminEmitters = new CopyOnWriteArrayList<>();
    private final Map<String, List<SseEmitter>> userEmittersByUserId = new ConcurrentHashMap<>();
    private final List<GrpcSubscriber> adminGrpcSubscribers = new CopyOnWriteArrayList<>();
    private final Map<String, List<GrpcSubscriber>> grpcSubscribersByUserId = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper;

    public AdminSseServiceImpl(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public SseEmitter subscribe(String userId, boolean isAdmin) {
        SseEmitter emitter = new SseEmitter(0L);

        userEmittersByUserId.computeIfAbsent(userId, ignored -> new CopyOnWriteArrayList<>()).add(emitter);
        if (isAdmin) {
            adminEmitters.add(emitter);
        }

        emitter.onCompletion(() -> removeEmitter(userId, isAdmin, emitter));
        emitter.onTimeout(() -> removeEmitter(userId, isAdmin, emitter));
        emitter.onError(ex -> removeEmitter(userId, isAdmin, emitter));

        try {
            emitter.send(SseEmitter.event()
                    .name("connected")
                    .data(Map.of("userId", userId, "isAdmin", isAdmin), MediaType.APPLICATION_JSON));
        } catch (IOException ex) {
            removeEmitter(userId, isAdmin, emitter);
        }

        return emitter;
    }

    @Override
    public void subscribeGrpc(
            String userId,
            boolean isAdmin,
            StreamObserver<NotificationEvent> responseObserver
    ) {
        GrpcSubscriber subscriber = new GrpcSubscriber(userId, isAdmin, responseObserver);
        grpcSubscribersByUserId
                .computeIfAbsent(userId, ignored -> new CopyOnWriteArrayList<>())
                .add(subscriber);
        if (isAdmin) {
            adminGrpcSubscribers.add(subscriber);
        }

        if (responseObserver instanceof ServerCallStreamObserver<NotificationEvent> serverObserver) {
            serverObserver.setOnCancelHandler(() -> removeGrpcSubscriber(subscriber));
        }

        if (!subscriber.send(buildGrpcEvent(
                "connected",
                Map.of("userId", userId, "isAdmin", isAdmin)
        ))) {
            removeGrpcSubscriber(subscriber);
        }
    }

    @Override
    public void sendToAdmins(String eventName, Object data) {
        for (SseEmitter emitter : adminEmitters) {
            sendEvent(emitter, null, true, eventName, data);
        }
        sendGrpcEvent(adminGrpcSubscribers, eventName, data);
    }

    @Override
    public void sendToUser(String userId, String eventName, Object data) {
        List<SseEmitter> emitters = userEmittersByUserId.get(userId);
        if (emitters != null) {
            for (SseEmitter emitter : emitters) {
                sendEvent(emitter, userId, false, eventName, data);
            }
        }

        List<GrpcSubscriber> grpcSubscribers = grpcSubscribersByUserId.get(userId);
        sendGrpcEvent(grpcSubscribers, eventName, data);
    }

    @Override
    public void sendToAllUsers(String eventName, Object data) {
        userEmittersByUserId.forEach((userId, emitters) -> {
            if (emitters == null || emitters.isEmpty()) {
                return;
            }
            for (SseEmitter emitter : emitters) {
                sendEvent(emitter, userId, false, eventName, data);
            }
        });

        NotificationEvent event = buildGrpcEvent(eventName, data);
        grpcSubscribersByUserId.values().forEach(subscribers -> {
            if (subscribers == null || subscribers.isEmpty()) {
                return;
            }
            for (GrpcSubscriber subscriber : subscribers) {
                sendGrpcEvent(subscriber, event);
            }
        });
    }

    private void sendEvent(
            SseEmitter emitter,
            String userId,
            boolean isAdmin,
            String eventName,
            Object data
    ) {
        try {
            emitter.send(SseEmitter.event()
                    .name(eventName)
                    .data(data, MediaType.APPLICATION_JSON));
        } catch (IOException ex) {
            removeEmitter(userId, isAdmin, emitter);
        }
    }

    private void removeEmitter(String userId, boolean isAdmin, SseEmitter emitter) {
        if (isAdmin) {
            adminEmitters.remove(emitter);
        }

        if (userId == null) {
            return;
        }

        List<SseEmitter> emitters = userEmittersByUserId.get(userId);
        if (emitters == null) {
            return;
        }

        emitters.remove(emitter);
        if (emitters.isEmpty()) {
            userEmittersByUserId.remove(userId);
        }
    }

    private void sendGrpcEvent(List<GrpcSubscriber> subscribers, String eventName, Object data) {
        if (subscribers == null || subscribers.isEmpty()) {
            return;
        }

        NotificationEvent event = buildGrpcEvent(eventName, data);
        for (GrpcSubscriber subscriber : subscribers) {
            sendGrpcEvent(subscriber, event);
        }
    }

    private void sendGrpcEvent(GrpcSubscriber subscriber, NotificationEvent event) {
        if (!subscriber.send(event)) {
            removeGrpcSubscriber(subscriber);
        }
    }

    private NotificationEvent buildGrpcEvent(String eventName, Object data) {
        try {
            return NotificationEvent.newBuilder()
                    .setEventId(UUID.randomUUID().toString())
                    .setEventName(eventName)
                    .setDataJson(objectMapper.writeValueAsString(data))
                    .setOccurredAtEpochMillis(System.currentTimeMillis())
                    .build();
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Cannot serialize realtime event payload.", ex);
        }
    }

    private void removeGrpcSubscriber(GrpcSubscriber subscriber) {
        subscriber.close();
        if (subscriber.isAdmin()) {
            adminGrpcSubscribers.remove(subscriber);
        }

        List<GrpcSubscriber> subscribers = grpcSubscribersByUserId.get(subscriber.userId());
        if (subscribers == null) {
            return;
        }

        subscribers.remove(subscriber);
        if (subscribers.isEmpty()) {
            grpcSubscribersByUserId.remove(subscriber.userId());
        }
    }

    private static final class GrpcSubscriber {

        private final String userId;
        private final boolean admin;
        private final StreamObserver<NotificationEvent> responseObserver;
        private final AtomicBoolean closed = new AtomicBoolean();

        private GrpcSubscriber(
                String userId,
                boolean admin,
                StreamObserver<NotificationEvent> responseObserver
        ) {
            this.userId = userId;
            this.admin = admin;
            this.responseObserver = responseObserver;
        }

        private synchronized boolean send(NotificationEvent event) {
            if (closed.get()) {
                return false;
            }
            try {
                responseObserver.onNext(event);
                return true;
            } catch (RuntimeException ex) {
                closed.set(true);
                return false;
            }
        }

        private void close() {
            closed.set(true);
        }

        private String userId() {
            return userId;
        }

        private boolean isAdmin() {
            return admin;
        }
    }
}
