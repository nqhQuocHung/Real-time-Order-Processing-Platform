-- Convert users.is_active from SMALLINT (0/1) to BOOLEAN.
ALTER TABLE auth.users DROP CONSTRAINT IF EXISTS chk_users_is_active;
ALTER TABLE auth.users ALTER COLUMN is_active DROP DEFAULT;
ALTER TABLE auth.users
    ALTER COLUMN is_active TYPE BOOLEAN
    USING CASE WHEN is_active = 1 THEN TRUE ELSE FALSE END;
ALTER TABLE auth.users ALTER COLUMN is_active SET DEFAULT FALSE;
ALTER TABLE auth.users ALTER COLUMN is_active SET NOT NULL;

-- Add BasePojo fields for users.
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS uuid UUID;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
UPDATE auth.users
SET uuid = COALESCE(uuid, id),
    created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
    updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP);
ALTER TABLE auth.users ALTER COLUMN uuid SET NOT NULL;
ALTER TABLE auth.users ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE auth.users ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE auth.users ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE auth.users ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX IF NOT EXISTS uk_users_uuid ON auth.users (uuid);

-- Add BasePojo fields for roles.
ALTER TABLE auth.roles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE auth.roles ADD COLUMN IF NOT EXISTS uuid UUID;
ALTER TABLE auth.roles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;
ALTER TABLE auth.roles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
ALTER TABLE auth.roles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
UPDATE auth.roles
SET uuid = COALESCE(uuid, id),
    created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
    updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP);
ALTER TABLE auth.roles ALTER COLUMN uuid SET NOT NULL;
ALTER TABLE auth.roles ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE auth.roles ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE auth.roles ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE auth.roles ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX IF NOT EXISTS uk_roles_uuid ON auth.roles (uuid);

-- Add BasePojo fields for refresh_tokens.
ALTER TABLE auth.refresh_tokens ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE auth.refresh_tokens ADD COLUMN IF NOT EXISTS uuid UUID;
ALTER TABLE auth.refresh_tokens ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;
ALTER TABLE auth.refresh_tokens ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
ALTER TABLE auth.refresh_tokens ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
UPDATE auth.refresh_tokens
SET uuid = COALESCE(uuid, id),
    created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
    updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP);
ALTER TABLE auth.refresh_tokens ALTER COLUMN uuid SET NOT NULL;
ALTER TABLE auth.refresh_tokens ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE auth.refresh_tokens ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE auth.refresh_tokens ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE auth.refresh_tokens ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX IF NOT EXISTS uk_refresh_tokens_uuid ON auth.refresh_tokens (uuid);

-- Add BasePojo fields for user_otps.
ALTER TABLE auth.user_otps ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE auth.user_otps ADD COLUMN IF NOT EXISTS uuid UUID;
ALTER TABLE auth.user_otps ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;
ALTER TABLE auth.user_otps ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
ALTER TABLE auth.user_otps ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
UPDATE auth.user_otps
SET uuid = COALESCE(uuid, id),
    created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
    updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP);
ALTER TABLE auth.user_otps ALTER COLUMN uuid SET NOT NULL;
ALTER TABLE auth.user_otps ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE auth.user_otps ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE auth.user_otps ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE auth.user_otps ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX IF NOT EXISTS uk_user_otps_uuid ON auth.user_otps (uuid);
