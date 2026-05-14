DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE c.conname = 'uk_product_categories_shop_code'
          AND n.nspname = 'inventory'
    ) THEN
        ALTER TABLE inventory.product_categories
            DROP CONSTRAINT uk_product_categories_shop_code;
    END IF;
END $$;

ALTER TABLE inventory.product_categories
    ALTER COLUMN shop_id DROP NOT NULL;

WITH canonical_categories AS (
    SELECT lower(btrim(category_name)) AS normalized_name, MIN(id::text)::uuid AS canonical_id
    FROM inventory.product_categories
    WHERE is_active = TRUE
    GROUP BY lower(btrim(category_name))
),
duplicate_categories AS (
    SELECT c.id AS duplicate_id, cc.canonical_id
    FROM inventory.product_categories c
    JOIN canonical_categories cc
      ON lower(btrim(c.category_name)) = cc.normalized_name
    WHERE c.is_active = TRUE
      AND c.id <> cc.canonical_id
)
UPDATE inventory.inventory_stocks stocks
SET category_id = dup.canonical_id
FROM duplicate_categories dup
WHERE stocks.category_id = dup.duplicate_id;

UPDATE inventory.product_categories categories
SET is_active = FALSE,
    deleted_at = COALESCE(categories.deleted_at, CURRENT_TIMESTAMP),
    updated_at = CURRENT_TIMESTAMP
WHERE categories.id IN (
    SELECT dup.duplicate_id
    FROM (
        SELECT c.id AS duplicate_id, cc.canonical_id
        FROM inventory.product_categories c
        JOIN (
            SELECT lower(btrim(category_name)) AS normalized_name, MIN(id::text)::uuid AS canonical_id
            FROM inventory.product_categories
            WHERE is_active = TRUE
            GROUP BY lower(btrim(category_name))
        ) cc
          ON lower(btrim(c.category_name)) = cc.normalized_name
        WHERE c.is_active = TRUE
          AND c.id <> cc.canonical_id
    ) dup
);

UPDATE inventory.product_categories
SET shop_id = NULL
WHERE shop_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_product_categories_category_code
    ON inventory.product_categories (category_code);

CREATE INDEX IF NOT EXISTS idx_product_categories_active_name
    ON inventory.product_categories (lower(category_name))
    WHERE is_active = TRUE;

DROP INDEX IF EXISTS inventory.idx_product_categories_shop_id;
