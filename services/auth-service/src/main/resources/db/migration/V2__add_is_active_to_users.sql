ALTER TABLE auth.users
    ADD COLUMN IF NOT EXISTS is_active SMALLINT;

UPDATE auth.users
SET is_active = CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END
WHERE is_active IS NULL;

ALTER TABLE auth.users
    ALTER COLUMN is_active SET DEFAULT 0;

ALTER TABLE auth.users
    ALTER COLUMN is_active SET NOT NULL;

ALTER TABLE auth.users
    DROP CONSTRAINT IF EXISTS chk_users_is_active;

ALTER TABLE auth.users
    ADD CONSTRAINT chk_users_is_active CHECK (is_active IN (0, 1));
