-- Standardize payment transaction status domain by removing deprecated CANCELLED.
-- Existing rows with CANCELLED are mapped to FAILED before tightening constraint.
UPDATE payment.payment_transactions
SET status = 'FAILED'
WHERE status = 'CANCELLED';

ALTER TABLE payment.payment_transactions
DROP CONSTRAINT IF EXISTS chk_payment_status;

ALTER TABLE payment.payment_transactions
ADD CONSTRAINT chk_payment_status
CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED'));
