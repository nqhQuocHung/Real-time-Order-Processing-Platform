CREATE SCHEMA IF NOT EXISTS notification;

CREATE TABLE IF NOT EXISTS notification.notification_logs (
    id UUID PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE,
    notification_code VARCHAR(80) NOT NULL UNIQUE,
    order_code VARCHAR(64) NOT NULL,
    event_type VARCHAR(120) NOT NULL,
    channel VARCHAR(20) NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    content VARCHAR(2000) NOT NULL,
    status VARCHAR(20) NOT NULL,
    provider VARCHAR(120),
    provider_message_id VARCHAR(120),
    actor VARCHAR(120),
    note VARCHAR(255),
    error_message VARCHAR(500),
    sent_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_notification_channel CHECK (channel IN ('EMAIL', 'SMS', 'PUSH')),
    CONSTRAINT chk_notification_status CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_notification_code
    ON notification.notification_logs (notification_code);
CREATE INDEX IF NOT EXISTS idx_notification_logs_order_code
    ON notification.notification_logs (order_code);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status
    ON notification.notification_logs (status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at
    ON notification.notification_logs (created_at);
