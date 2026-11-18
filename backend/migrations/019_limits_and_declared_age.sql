-- Security hardening, second pass (2026-11-16): bounds on the sign-in challenge table,
-- email-code caps per inbox and per network, a network-wide cap on wrong email-code
-- guesses, and the age an account was declared with. Nothing is dropped; every statement
-- can run again. Every column added here is NULL-able or has a default, so the previous
-- release's binary still runs against this schema (see the rollback step in CLAUDE.md).
--
-- "Network" in the comments below is auth/client_ip.rs `network_key`: one IPv4 address or
-- one IPv6 /48. From this release, `email_login_codes.ip`, `email_code_failures.net_key`
-- and `auth_challenges.net_key` hold that key, and `signup_attempts.ip` holds an IPv4 /24 or
-- an IPv6 /48 (it was a /64). Rows written before keep their old keys and age out of every
-- window within a day.

-- Which network began a ceremony. One network may have only so many live at once, and at
-- the table's ceiling only networks under a small share are served (auth/passkeys.rs
-- `store_challenge`). NULL on rows from before this migration, which expire in minutes.
ALTER TABLE auth_challenges ADD COLUMN IF NOT EXISTS net_key VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_auth_challenges_net ON auth_challenges(net_key, expires_at);

-- The inbox a code was sent to (auth/email_code.rs `inbox_key`: the address without its
-- +tag, and for Gmail without dots). What the per-inbox caps count, so that one mailbox
-- under several spellings is still one mailbox. Rows from before take their address.
ALTER TABLE email_login_codes ADD COLUMN IF NOT EXISTS inbox VARCHAR(255);
UPDATE email_login_codes SET inbox = email WHERE inbox IS NULL;
CREATE INDEX IF NOT EXISTS idx_email_login_codes_inbox ON email_login_codes(inbox, created_at DESC);

-- Wrong guesses by one network over all addresses (auth/email_code.rs
-- MAX_FAILED_BY_NETWORK_PER_DAY). A miss is forgiven, for that count only, once the same
-- network signs in with a code for the same address.
ALTER TABLE email_code_failures ADD COLUMN IF NOT EXISTS forgiven BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_email_code_failures_net
    ON email_code_failures(net_key, created_at DESC);

-- The site-wide count of begun sign-ups (SIGNUP_BEGINS_GLOBAL_PER_HOUR).
CREATE INDEX IF NOT EXISTS idx_signup_attempts_begun
    ON signup_attempts(created_at DESC) WHERE NOT completed;

-- The age tier the account was created with, or for an account older than the age gate,
-- the first one its owner gave. `age_tier` is what applies now; it can be made stricter by
-- the owner, and only an account declared 'adult' can be made 'adult' again
-- (auth/age.rs `decide_age_tier`). Existing accounts are taken as declared with the tier
-- they have now: one that is 'teen' today stays 'teen'.
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_tier_declared VARCHAR(10);
UPDATE users SET age_tier_declared = age_tier WHERE age_tier_declared IS NULL;
ALTER TABLE users ALTER COLUMN age_tier_declared SET DEFAULT 'unknown';
ALTER TABLE users ALTER COLUMN age_tier_declared SET NOT NULL;
