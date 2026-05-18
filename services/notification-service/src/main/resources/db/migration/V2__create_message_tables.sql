CREATE TABLE IF NOT EXISTS notification.message_conversations (
    id UUID PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE,
    user_id UUID NOT NULL,
    user_display_name VARCHAR(120),
    partner_id UUID NOT NULL,
    partner_display_name VARCHAR(120),
    product_id UUID,
    product_name VARCHAR(255),
    last_message_preview VARCHAR(500),
    last_message_sender_id UUID,
    last_message_sender_name VARCHAR(120),
    last_message_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uk_message_conversations_user_partner UNIQUE (user_id, partner_id)
);

CREATE INDEX IF NOT EXISTS idx_message_conversations_user
    ON notification.message_conversations (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_conversations_partner
    ON notification.message_conversations (partner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_conversations_last_message_at
    ON notification.message_conversations (last_message_at DESC);

CREATE TABLE IF NOT EXISTS notification.message_entries (
    id UUID PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE,
    conversation_id UUID NOT NULL,
    sender_id UUID NOT NULL,
    sender_role VARCHAR(20) NOT NULL,
    sender_name VARCHAR(120),
    recipient_id UUID NOT NULL,
    content VARCHAR(2000) NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_message_entries_conversation
        FOREIGN KEY (conversation_id) REFERENCES notification.message_conversations (id) ON DELETE CASCADE,
    CONSTRAINT chk_message_entries_sender_role
        CHECK (sender_role IN ('USER', 'PARTNER', 'ADMIN'))
);

CREATE INDEX IF NOT EXISTS idx_message_entries_conversation_created_at
    ON notification.message_entries (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_entries_recipient_unread
    ON notification.message_entries (recipient_id, is_read, created_at DESC);
