ALTER TABLE orders.customer_orders
    ADD COLUMN IF NOT EXISTS payment_url VARCHAR(1000);

ALTER TABLE orders.customer_orders
    ADD COLUMN IF NOT EXISTS payment_deadline_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_customer_orders_status_payment_deadline
    ON orders.customer_orders (status, payment_deadline_at);
