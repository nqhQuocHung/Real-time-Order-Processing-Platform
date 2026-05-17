CREATE SCHEMA IF NOT EXISTS orders;

CREATE TABLE IF NOT EXISTS orders.customer_orders (
    id UUID PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE,
    customer_id UUID NOT NULL,
    order_code VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(30) NOT NULL,
    total_amount NUMERIC(19,2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_customer_orders_status CHECK (status IN ('CREATED', 'RESERVED', 'PAID', 'COMPLETED', 'FAILED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_customer_orders_customer_id ON orders.customer_orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_orders_created_at ON orders.customer_orders (created_at);
CREATE UNIQUE INDEX IF NOT EXISTS uk_customer_orders_idempotency_key ON orders.customer_orders (idempotency_key);

CREATE TABLE IF NOT EXISTS orders.order_items (
    id UUID PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE,
    order_id UUID NOT NULL,
    product_id UUID NOT NULL,
    product_name VARCHAR(255),
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(19,2) NOT NULL,
    line_total NUMERIC(19,2) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_order_items_order
        FOREIGN KEY (order_id) REFERENCES orders.customer_orders (id) ON DELETE CASCADE,
    CONSTRAINT chk_order_items_quantity CHECK (quantity > 0),
    CONSTRAINT chk_order_items_unit_price CHECK (unit_price > 0),
    CONSTRAINT chk_order_items_line_total CHECK (line_total > 0)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON orders.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON orders.order_items (product_id);
