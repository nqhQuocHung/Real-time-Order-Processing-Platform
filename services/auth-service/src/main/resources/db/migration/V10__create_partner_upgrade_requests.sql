CREATE TABLE IF NOT EXISTS auth.partner_upgrade_requests (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL,
    request_note VARCHAR(500),
    review_note VARCHAR(500),
    reviewed_by VARCHAR(120),
    reviewed_at TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    uuid UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    CONSTRAINT fk_partner_upgrade_requests_user
        FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_partner_upgrade_requests_user_created
    ON auth.partner_upgrade_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_partner_upgrade_requests_status_created
    ON auth.partner_upgrade_requests (status, created_at DESC);
