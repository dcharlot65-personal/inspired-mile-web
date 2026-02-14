-- OAuth + Wallet sign-in support
-- Make password_hash nullable (Google/wallet users have no password)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Make email nullable (wallet-only users may not have email)
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- Google identity columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512);

-- Auth provider tracking: 'password', 'google', 'wallet'
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) NOT NULL DEFAULT 'password';

-- Wallet nonces table (short-lived challenge tokens for wallet sign-in)
CREATE TABLE IF NOT EXISTS wallet_nonces (
    wallet_address VARCHAR(64) PRIMARY KEY,
    nonce VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
