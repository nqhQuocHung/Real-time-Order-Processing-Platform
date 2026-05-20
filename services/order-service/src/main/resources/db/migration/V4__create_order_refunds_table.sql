CREATE TABLE IF NOT EXISTS orders.order_refunds (
    id UUID PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE,
    order_id UUID NOT NULL UNIQUE,
    customer_id UUID NOT NULL,
    refund_amount NUMERIC(19,2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    refund_account_name VARCHAR(120) NOT NULL,
    refund_account_number VARCHAR(60) NOT NULL,
    refund_bank_code VARCHAR(40) NOT NULL,
    refund_reason VARCHAR(500) NOT NULL,
    status VARCHAR(30) NOT NULL,
    seller_decision_note VARCHAR(255),
    seller_decision_by VARCHAR(120),
    provider_refund_id VARCHAR(120),
    provider_note VARCHAR(255),
    processed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_order_refunds_order
        FOREIGN KEY (order_id) REFERENCES orders.customer_orders (id) ON DELETE CASCADE,
    CONSTRAINT chk_order_refunds_status
        CHECK (status IN ('REQUESTED', 'APPROVED', 'REJECTED', 'REFUNDED', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_order_refunds_order_id
    ON orders.order_refunds (order_id);

CREATE INDEX IF NOT EXISTS idx_order_refunds_customer_id
    ON orders.order_refunds (customer_id);

CREATE INDEX IF NOT EXISTS idx_order_refunds_status
    ON orders.order_refunds (status);
