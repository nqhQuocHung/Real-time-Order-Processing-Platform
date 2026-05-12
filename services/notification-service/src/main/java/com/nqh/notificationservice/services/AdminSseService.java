package com.nqh.notificationservice.services;

import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

public interface AdminSseService {

    SseEmitter subscribe(String userId, boolean isAdmin);

    void sendToAdmins(String eventName, Object data);

    void sendToUser(String userId, String eventName, Object data);
}
