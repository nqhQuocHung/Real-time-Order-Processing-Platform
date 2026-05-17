CREATE SCHEMA IF NOT EXISTS inventory;

CREATE TABLE IF NOT EXISTS inventory.inventory_stocks (
    id UUID PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE,
    product_id UUID NOT NULL UNIQUE,
    sku VARCHAR(64),
    product_name VARCHAR(255),
    available_quantity INTEGER NOT NULL,
    reserved_quantity INTEGER NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_inventory_stocks_available_quantity CHECK (available_quantity >= 0),
    CONSTRAINT chk_inventory_stocks_reserved_quantity CHECK (reserved_quantity >= 0)
);

CREATE INDEX IF NOT EXISTS idx_inventory_stocks_product_id ON inventory.inventory_stocks (product_id);

CREATE TABLE IF NOT EXISTS inventory.inventory_reservations (
    id UUID PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE,
    order_code VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(30) NOT NULL,
    actor VARCHAR(120),
    note VARCHAR(255),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_inventory_reservations_status CHECK (status IN ('RESERVED', 'RELEASED', 'COMMITTED'))
);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_order_code ON inventory.inventory_reservations (order_code);

CREATE TABLE IF NOT EXISTS inventory.inventory_reservation_items (
    id UUID PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE,
    reservation_id UUID NOT NULL,
    product_id UUID NOT NULL,
    quantity INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_inventory_reservation_items_reservation
        FOREIGN KEY (reservation_id) REFERENCES inventory.inventory_reservations (id) ON DELETE CASCADE,
    CONSTRAINT chk_inventory_reservation_items_quantity CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_inventory_reservation_items_reservation_id
    ON inventory.inventory_reservation_items (reservation_id);
CREATE INDEX IF NOT EXISTS idx_inventory_reservation_items_product_id
    ON inventory.inventory_reservation_items (product_id);
