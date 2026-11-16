-- Security hardening, second pass (2026-11-16): bounds on the sign-in challenge table, a
-- network-wide cap on wrong email-code guesses, and the age an account was declared with.
-- Nothing is dropped; every statement can run again.

-- Which network (auth/client_ip.rs `limit_key`: an IPv4 address or an IPv6 /64) began a
-- ceremony. One network may have only so many live at once (auth/passkeys.rs
-- `store_challenge`). NULL on rows from before this migration, which expire in minutes.
ALTER TABLE auth_challenges ADD COLUMN IF NOT EXISTS net_key VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_auth_challenges_net ON auth_challenges(net_key, expires_at);

-- Wrong guesses by one network over all addresses (auth/email_code.rs
-- MAX_FAILED_BY_NETWORK_PER_DAY).
CREATE INDEX IF NOT EXISTS idx_email_code_failures_net
    ON email_code_failures(net_key, created_at DESC);

-- The site-wide count of begun sign-ups (SIGNUP_BEGINS_GLOBAL_PER_HOUR).
CREATE INDEX IF NOT EXISTS idx_signup_attempts_begun
    ON signup_attempts(created_at DESC) WHERE NOT completed;

-- The age tier the account was created with, or for an account older than the age gate,
-- the first one its owner gave. `age_tier` is what applies now; it can be made stricter by
-- the owner, and only an account declared 'adult' can be made 'adult' again
-- (credits/handlers.rs `decide_age_tier`). Existing accounts are taken as declared with
-- the tier they have now: one that is 'teen' today stays 'teen'.
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_tier_declared VARCHAR(10);
UPDATE users SET age_tier_declared = age_tier WHERE age_tier_declared IS NULL;
ALTER TABLE users ALTER COLUMN age_tier_declared SET DEFAULT 'unknown';
ALTER TABLE users ALTER COLUMN age_tier_declared SET NOT NULL;
