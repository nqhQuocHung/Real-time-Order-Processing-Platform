ALTER TABLE payment.payment_refunds
    ADD COLUMN IF NOT EXISTS refund_url TEXT;
