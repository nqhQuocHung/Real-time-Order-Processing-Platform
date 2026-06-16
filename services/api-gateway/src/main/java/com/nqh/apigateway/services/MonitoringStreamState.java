package com.nqh.apigateway.services;

import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.stereotype.Component;

@Component
public class MonitoringStreamState {

    private final AtomicInteger activeNotificationSseConnections = new AtomicInteger();
    private final AtomicInteger activeMonitoringSseConnections = new AtomicInteger();

    public void notificationConnected() {
        activeNotificationSseConnections.incrementAndGet();
    }

    public void notificationDisconnected() {
        activeNotificationSseConnections.updateAndGet(value -> Math.max(0, value - 1));
    }

    public void monitoringConnected() {
        activeMonitoringSseConnections.incrementAndGet();
    }

    public void monitoringDisconnected() {
        activeMonitoringSseConnections.updateAndGet(value -> Math.max(0, value - 1));
    }

    public int activeNotificationSseConnections() {
        return activeNotificationSseConnections.get();
    }

    public int activeMonitoringSseConnections() {
        return activeMonitoringSseConnections.get();
    }
}
