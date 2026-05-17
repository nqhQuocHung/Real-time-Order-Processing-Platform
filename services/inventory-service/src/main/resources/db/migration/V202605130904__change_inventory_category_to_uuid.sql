DROP INDEX IF EXISTS inventory.idx_inventory_stocks_category_id;

-- Normalize empty strings to NULL before converting column type.
UPDATE inventory.inventory_stocks
SET category_id = NULL
WHERE category_id IS NOT NULL
  AND btrim(category_id::text) = '';

-- Map legacy text category codes (for example CHIP / KEYBOARD) to category UUID.
UPDATE inventory.inventory_stocks AS stocks
SET category_id = categories.id::text
FROM inventory.product_categories AS categories
WHERE stocks.category_id IS NOT NULL
  AND stocks.shop_id = categories.shop_id
  AND lower(stocks.category_id::text) = lower(categories.category_code);

-- Keep only UUID-like values so ALTER TYPE cast will always succeed.
UPDATE inventory.inventory_stocks
SET category_id = NULL
WHERE category_id IS NOT NULL
  AND category_id::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

ALTER TABLE inventory.inventory_stocks
    ALTER COLUMN category_id TYPE UUID
    USING (category_id::uuid);

CREATE INDEX IF NOT EXISTS idx_inventory_stocks_category_id
    ON inventory.inventory_stocks (category_id);
