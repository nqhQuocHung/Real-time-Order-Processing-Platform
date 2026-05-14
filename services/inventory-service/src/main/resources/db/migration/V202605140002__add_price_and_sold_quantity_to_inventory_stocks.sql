ALTER TABLE inventory.inventory_stocks
    ADD COLUMN IF NOT EXISTS price NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS sold_quantity INTEGER NOT NULL DEFAULT 0;

UPDATE inventory.inventory_stocks
SET sold_quantity = 0
WHERE sold_quantity IS NULL OR sold_quantity < 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE c.conname = 'chk_inventory_stocks_sold_quantity'
          AND n.nspname = 'inventory'
    ) THEN
        ALTER TABLE inventory.inventory_stocks
            ADD CONSTRAINT chk_inventory_stocks_sold_quantity CHECK (sold_quantity >= 0);
    END IF;
END $$;
