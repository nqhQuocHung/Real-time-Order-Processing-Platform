package com.nqh.notificationservice.services.impl;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nqh.realtime.v1.NotificationEvent;
import io.grpc.stub.StreamObserver;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class AdminSseServiceImplTest {

    @Test
    void sendsConnectedAndTargetedEventsToGrpcSubscriber() {
        AdminSseServiceImpl service = new AdminSseServiceImpl(new ObjectMapper());
        RecordingObserver observer = new RecordingObserver();

        service.subscribeGrpc("user-1", false, observer);
        service.sendToUser("user-2", "order.lifecycle.paid", Map.of("orderCode", "ORD-2"));
        service.sendToUser("user-1", "order.lifecycle.paid", Map.of("orderCode", "ORD-1"));

        assertThat(observer.events).hasSize(2);
        assertThat(observer.events.get(0).getEventName()).isEqualTo("connected");
        assertThat(observer.events.get(0).getDataJson()).contains("\"userId\":\"user-1\"");
        assertThat(observer.events.get(1).getEventName()).isEqualTo("order.lifecycle.paid");
        assertThat(observer.events.get(1).getDataJson()).contains("\"orderCode\":\"ORD-1\"");
    }

    @Test
    void sendsAdminEventsOnlyToAdminGrpcSubscribers() {
        AdminSseServiceImpl service = new AdminSseServiceImpl(new ObjectMapper());
        RecordingObserver adminObserver = new RecordingObserver();
        RecordingObserver userObserver = new RecordingObserver();

        service.subscribeGrpc("admin-1", true, adminObserver);
        service.subscribeGrpc("user-1", false, userObserver);
        service.sendToAdmins("partner.request.created", Map.of("requestId", "request-1"));

        assertThat(adminObserver.events).hasSize(2);
        assertThat(adminObserver.events.get(1).getEventName())
                .isEqualTo("partner.request.created");
        assertThat(userObserver.events).hasSize(1);
    }

    private static final class RecordingObserver implements StreamObserver<NotificationEvent> {

        private final List<NotificationEvent> events = new ArrayList<>();

        @Override
        public void onNext(NotificationEvent value) {
            events.add(value);
        }

        @Override
        public void onError(Throwable throwable) {
        }

        @Override
        public void onCompleted() {
        }
    }
}
