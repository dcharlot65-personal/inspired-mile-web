-- Security hardening (2026-11-16 review): server-side sessions, a fresh-verification
-- ceremony, sign-up accounting that counts finished accounts, and email-code limits that
-- one party cannot use against another.

-- One row per signed-in browser. The cookie's JWT names its row (`sid`); a session is good
-- only while its row is here, unexpired and not revoked. Signing out revokes one row,
-- "sign out everywhere" revokes all of a user's rows.
CREATE TABLE IF NOT EXISTS auth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    -- When this browser last proved who is using it: a user-verified passkey assertion or
    -- an emailed code. Adding or removing a passkey and adding an email need this to be
    -- a few minutes old at most.
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_by VARCHAR(8) NOT NULL CHECK (verified_by IN ('passkey', 'email')),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires_at);

-- 'verify': a signed-in user proves again, with a passkey of the account, that it is them.
ALTER TABLE auth_challenges DROP CONSTRAINT IF EXISTS auth_challenges_kind_check;
ALTER TABLE auth_challenges ADD CONSTRAINT auth_challenges_kind_check
    CHECK (kind IN ('register', 'login', 'signup', 'verify'));

-- signup_attempts.ip now holds a network key (an IPv4 /24 or an IPv6 /64, see
-- auth/client_ip.rs), and a row is written both when a sign-up is begun (completed = FALSE)
-- and when it creates an account (completed = TRUE). The hard limits count the second kind.
ALTER TABLE signup_attempts ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_signup_attempts_completed
    ON signup_attempts(created_at DESC) WHERE completed;

-- Which browser asked for a code: an HMAC of a short-lived random cookie. A code is only
-- ever judged against guesses from the browser that requested it, so nobody else can use
-- up its attempts or withdraw it. NULL on rows from before this migration, which therefore
-- can no longer be redeemed (they live ten minutes).
ALTER TABLE email_login_codes ADD COLUMN IF NOT EXISTS requester CHAR(64);
CREATE INDEX IF NOT EXISTS idx_email_login_codes_requester
    ON email_login_codes(email, requester, created_at DESC);

-- Every wrong guess at a code, by address guessed at and by the guesser's network key.
-- What the per-network and per-address daily caps count.
CREATE TABLE IF NOT EXISTS email_code_failures (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    net_key VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_code_failures_email
    ON email_code_failures(email, created_at DESC);
