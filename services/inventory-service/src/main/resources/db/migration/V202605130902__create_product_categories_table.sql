CREATE TABLE IF NOT EXISTS inventory.product_categories (
    id UUID PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE,
    shop_id UUID NOT NULL,
    category_code VARCHAR(120) NOT NULL,
    category_name VARCHAR(255) NOT NULL,
    description VARCHAR(1000),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uk_product_categories_shop_code UNIQUE (shop_id, category_code)
);

CREATE INDEX IF NOT EXISTS idx_product_categories_shop_id
    ON inventory.product_categories (shop_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_category_code
    ON inventory.product_categories (category_code);

CREATE INDEX IF NOT EXISTS idx_inventory_stocks_category_id
    ON inventory.inventory_stocks (category_id);
