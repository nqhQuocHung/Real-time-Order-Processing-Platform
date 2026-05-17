ALTER TABLE inventory.inventory_stocks
    ADD COLUMN IF NOT EXISTS shop_name VARCHAR(120);

