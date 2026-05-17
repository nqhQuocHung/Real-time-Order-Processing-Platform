CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.roles (
    id UUID PRIMARY KEY,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_roles_code ON auth.roles (code);

CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar VARCHAR(500),
    status VARCHAR(30) NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    failed_login_count INTEGER NOT NULL DEFAULT 0,
    last_login_at TIMESTAMP,
    gender VARCHAR(20) NOT NULL,
    CONSTRAINT chk_users_status CHECK (status IN ('ACTIVE', 'LOCKED', 'DISABLED', 'PENDING_VERIFICATION')),
    CONSTRAINT chk_users_gender CHECK (gender IN ('UNKNOWN', 'MALE', 'FEMALE', 'OTHER'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_users_username_lower ON auth.users (LOWER(username));
CREATE UNIQUE INDEX IF NOT EXISTS uk_users_email_lower ON auth.users (LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS uk_users_phone ON auth.users (phone) WHERE phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS auth.user_roles (
    user_id UUID NOT NULL,
    role_id UUID NOT NULL,
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_user_roles_user
        FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
    CONSTRAINT fk_user_roles_role
        FOREIGN KEY (role_id) REFERENCES auth.roles (id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
    id UUID PRIMARY KEY,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    token_type VARCHAR(20) NOT NULL,
    user_id UUID NOT NULL,
    CONSTRAINT chk_refresh_tokens_type CHECK (token_type IN ('ACCESS', 'REFRESH')),
    CONSTRAINT fk_refresh_tokens_user
        FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_refresh_tokens_token_hash ON auth.refresh_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON auth.refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON auth.refresh_tokens (expires_at);

CREATE TABLE IF NOT EXISTS auth.user_otps (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    purpose VARCHAR(30) NOT NULL,
    otp_code_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    resend_count INTEGER NOT NULL DEFAULT 0,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT chk_user_otps_purpose CHECK (purpose IN ('REGISTER', 'LOGIN', 'FORGOT_PASSWORD', 'CHANGE_PASSWORD', 'VERIFY_EMAIL')),
    CONSTRAINT fk_user_otps_user
        FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_otps_user_id ON auth.user_otps (user_id);
CREATE INDEX IF NOT EXISTS idx_user_otps_expires_at ON auth.user_otps (expires_at);
