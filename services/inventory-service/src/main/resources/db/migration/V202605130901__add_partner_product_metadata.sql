ALTER TABLE inventory.inventory_stocks
    ADD COLUMN IF NOT EXISTS item_id UUID,
    ADD COLUMN IF NOT EXISTS shop_id UUID,
    ADD COLUMN IF NOT EXISTS name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS description VARCHAR(1000),
    ADD COLUMN IF NOT EXISTS category_id UUID,
    ADD COLUMN IF NOT EXISTS brand VARCHAR(120),
    ADD COLUMN IF NOT EXISTS product_status VARCHAR(40),
    ADD COLUMN IF NOT EXISTS image_url VARCHAR(1000);

UPDATE inventory.inventory_stocks
SET item_id = product_id
WHERE item_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_stocks_item_id
    ON inventory.inventory_stocks (item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_stocks_shop_id
    ON inventory.inventory_stocks (shop_id);
