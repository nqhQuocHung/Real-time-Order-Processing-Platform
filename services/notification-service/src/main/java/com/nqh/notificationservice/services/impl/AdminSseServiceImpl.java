package com.nqh.notificationservice.services.impl;

import com.nqh.notificationservice.services.AdminSseService;
import java.io.IOException;
import java.util.Map;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Service
public class AdminSseServiceImpl implements AdminSseService {

    private final List<SseEmitter> adminEmitters = new CopyOnWriteArrayList<>();
    private final Map<String, List<SseEmitter>> userEmittersByUserId = new ConcurrentHashMap<>();

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
    public void sendToAdmins(String eventName, Object data) {
        for (SseEmitter emitter : adminEmitters) {
            sendEvent(emitter, null, true, eventName, data);
        }
    }

    @Override
    public void sendToUser(String userId, String eventName, Object data) {
        List<SseEmitter> emitters = userEmittersByUserId.get(userId);
        if (emitters == null || emitters.isEmpty()) {
            return;
        }
        for (SseEmitter emitter : emitters) {
            sendEvent(emitter, userId, false, eventName, data);
        }
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
}
