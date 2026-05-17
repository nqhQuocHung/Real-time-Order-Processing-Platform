ALTER TABLE auth.partner_upgrade_requests
    ADD COLUMN IF NOT EXISTS shop_name VARCHAR(120);

