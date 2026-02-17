-- Age tier tracking + credit transaction log for minor spending limits

ALTER TABLE users ADD COLUMN IF NOT EXISTS age_tier VARCHAR(10) NOT NULL DEFAULT 'unknown';
-- Values: 'adult', 'teen', 'unknown'

CREATE TABLE IF NOT EXISTS credit_transactions (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    amount INT NOT NULL,
    direction VARCHAR(5) NOT NULL CHECK (direction IN ('earn', 'spend')),
    source VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_tx_user_date ON credit_transactions(user_id, created_at);
