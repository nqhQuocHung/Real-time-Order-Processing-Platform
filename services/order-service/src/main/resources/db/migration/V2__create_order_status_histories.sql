CREATE TABLE IF NOT EXISTS orders.order_status_histories (
    id UUID PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE,
    order_id UUID NOT NULL,
    from_status VARCHAR(30),
    to_status VARCHAR(30) NOT NULL,
    action VARCHAR(50) NOT NULL,
    changed_by VARCHAR(120),
    note VARCHAR(255),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_order_status_histories_order
        FOREIGN KEY (order_id) REFERENCES orders.customer_orders (id) ON DELETE CASCADE,
    CONSTRAINT chk_order_status_histories_from_status
        CHECK (from_status IS NULL OR from_status IN ('CREATED', 'RESERVED', 'PAID', 'COMPLETED', 'FAILED', 'CANCELLED')),
    CONSTRAINT chk_order_status_histories_to_status
        CHECK (to_status IN ('CREATED', 'RESERVED', 'PAID', 'COMPLETED', 'FAILED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_order_status_histories_order_id
    ON orders.order_status_histories (order_id);

CREATE INDEX IF NOT EXISTS idx_order_status_histories_created_at
    ON orders.order_status_histories (created_at);
