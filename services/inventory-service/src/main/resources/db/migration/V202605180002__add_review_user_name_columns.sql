ALTER TABLE inventory.product_reviews
    ADD COLUMN IF NOT EXISTS user_name VARCHAR(120);

ALTER TABLE inventory.product_review_comments
    ADD COLUMN IF NOT EXISTS user_name VARCHAR(120);
