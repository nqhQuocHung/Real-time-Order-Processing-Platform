CREATE TABLE IF NOT EXISTS payment.payment_refunds (
    id UUID PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE,
    payment_transaction_id UUID NOT NULL,
    order_code VARCHAR(64) NOT NULL UNIQUE,
    customer_id UUID NOT NULL,
    amount NUMERIC(19,2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    refund_account_name VARCHAR(120) NOT NULL,
    refund_account_number VARCHAR(60) NOT NULL,
    refund_bank_code VARCHAR(40) NOT NULL,
    refund_reason VARCHAR(500) NOT NULL,
    status VARCHAR(30) NOT NULL,
    provider_refund_id VARCHAR(120),
    actor VARCHAR(120),
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    note VARCHAR(255),
    processed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_payment_refunds_payment_transaction
        FOREIGN KEY (payment_transaction_id) REFERENCES payment.payment_transactions (id) ON DELETE CASCADE,
    CONSTRAINT chk_payment_refunds_status
        CHECK (status IN ('REQUESTED', 'REFUNDED', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_payment_refunds_payment_transaction_id
    ON payment.payment_refunds (payment_transaction_id);

CREATE INDEX IF NOT EXISTS idx_payment_refunds_order_code
    ON payment.payment_refunds (order_code);

CREATE INDEX IF NOT EXISTS idx_payment_refunds_status
    ON payment.payment_refunds (status);
