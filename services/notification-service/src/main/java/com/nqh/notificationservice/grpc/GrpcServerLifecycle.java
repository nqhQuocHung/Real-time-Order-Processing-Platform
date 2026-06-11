package com.nqh.notificationservice.grpc;

import io.grpc.Server;
import io.grpc.ServerInterceptors;
import io.grpc.netty.shaded.io.grpc.netty.NettyServerBuilder;
import java.io.IOException;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.SmartLifecycle;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class GrpcServerLifecycle implements SmartLifecycle {

    private final int port;
    private final NotificationStreamGrpcService notificationStreamService;
    private final InternalTokenServerInterceptor internalTokenInterceptor;
    private volatile boolean running;
    private Server server;

    public GrpcServerLifecycle(
            @Value("${app.notification.grpc.port:9095}") int port,
            NotificationStreamGrpcService notificationStreamService,
            InternalTokenServerInterceptor internalTokenInterceptor
    ) {
        this.port = port;
        this.notificationStreamService = notificationStreamService;
        this.internalTokenInterceptor = internalTokenInterceptor;
    }

    @Override
    public synchronized void start() {
        if (running) {
            return;
        }

        try {
            server = NettyServerBuilder.forPort(port)
                    .addService(ServerInterceptors.intercept(
                            notificationStreamService,
                            internalTokenInterceptor
                    ))
                    .build()
                    .start();
            running = true;
            log.info("Notification gRPC server started on port {} using HTTP/2.", port);
        } catch (IOException ex) {
            throw new IllegalStateException("Cannot start notification gRPC server.", ex);
        }
    }

    @Override
    public synchronized void stop() {
        if (server == null) {
            running = false;
            return;
        }

        server.shutdown();
        try {
            if (!server.awaitTermination(5, TimeUnit.SECONDS)) {
                server.shutdownNow();
            }
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            server.shutdownNow();
        } finally {
            running = false;
            server = null;
        }
    }

    @Override
    public void stop(Runnable callback) {
        stop();
        callback.run();
    }

    @Override
    public boolean isRunning() {
        return running;
    }

    @Override
    public boolean isAutoStartup() {
        return true;
    }

    @Override
    public int getPhase() {
        return Integer.MAX_VALUE;
    }
}
