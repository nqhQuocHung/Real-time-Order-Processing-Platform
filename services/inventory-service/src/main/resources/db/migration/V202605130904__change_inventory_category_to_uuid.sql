DROP INDEX IF EXISTS inventory.idx_inventory_stocks_category_id;

ALTER TABLE inventory.inventory_stocks
    ALTER COLUMN category_id TYPE UUID
    USING (
        CASE
            WHEN category_id IS NULL THEN NULL
            WHEN btrim(category_id::text) = '' THEN NULL
            WHEN lower(category_id::text) IN ('chip', 'keyboard') THEN (
                SELECT pc.id
                FROM inventory.product_categories pc
                WHERE pc.shop_id = inventory.inventory_stocks.shop_id
                    AND lower(pc.category_code) = lower(category_id::text)
                LIMIT 1
            )
            WHEN category_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN category_id::text::uuid
            ELSE NULL
        END
    );

CREATE INDEX IF NOT EXISTS idx_inventory_stocks_category_id
    ON inventory.inventory_stocks (category_id);
