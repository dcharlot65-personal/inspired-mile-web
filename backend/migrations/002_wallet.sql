-- Add wallet address to users table
ALTER TABLE users ADD COLUMN wallet_address VARCHAR(64);
ALTER TABLE users ADD COLUMN wallet_linked_at TIMESTAMPTZ;
