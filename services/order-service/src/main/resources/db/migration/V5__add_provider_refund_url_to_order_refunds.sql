ALTER TABLE orders.order_refunds
    ADD COLUMN IF NOT EXISTS provider_refund_url TEXT;
