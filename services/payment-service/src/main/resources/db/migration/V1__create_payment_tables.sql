CREATE SCHEMA IF NOT EXISTS payment;

CREATE TABLE IF NOT EXISTS payment.payment_transactions (
    id UUID PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE,
    order_code VARCHAR(64) NOT NULL UNIQUE,
    amount NUMERIC(19,2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    method VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL,
    provider_transaction_id VARCHAR(120),
    payment_url VARCHAR(1000),
    actor VARCHAR(120),
    note VARCHAR(255),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_payment_method CHECK (method IN ('VNPAY', 'MOMO', 'ZALOPAY', 'COD', 'BANK_TRANSFER')),
    CONSTRAINT chk_payment_status CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_code
    ON payment.payment_transactions (order_code);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status
    ON payment.payment_transactions (status);
