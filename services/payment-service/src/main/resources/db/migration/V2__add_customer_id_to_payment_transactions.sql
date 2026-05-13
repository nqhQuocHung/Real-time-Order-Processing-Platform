ALTER TABLE payment.payment_transactions
    ADD COLUMN IF NOT EXISTS customer_id UUID;

CREATE INDEX IF NOT EXISTS idx_payment_transactions_customer_id
    ON payment.payment_transactions (customer_id);
