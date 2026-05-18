CREATE TABLE IF NOT EXISTS inventory.product_reviews (
    id UUID PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE,
    product_id UUID NOT NULL,
    user_id UUID NOT NULL,
    rating SMALLINT NOT NULL,
    review_title VARCHAR(160),
    review_content VARCHAR(2000) NOT NULL,
    order_code VARCHAR(64),
    verified_purchase BOOLEAN NOT NULL DEFAULT FALSE,
    edited_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_product_reviews_rating CHECK (rating >= 1 AND rating <= 5)
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product_created_at
    ON inventory.product_reviews (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_reviews_user_created_at
    ON inventory.product_reviews (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uk_product_reviews_product_user_active
    ON inventory.product_reviews (product_id, user_id)
    WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS inventory.product_review_comments (
    id UUID PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE,
    review_id UUID NOT NULL,
    product_id UUID NOT NULL,
    user_id UUID NOT NULL,
    comment_content VARCHAR(1500) NOT NULL,
    edited_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_product_review_comments_review
        FOREIGN KEY (review_id) REFERENCES inventory.product_reviews (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_product_review_comments_review_created_at
    ON inventory.product_review_comments (review_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_product_review_comments_product_created_at
    ON inventory.product_review_comments (product_id, created_at DESC);
