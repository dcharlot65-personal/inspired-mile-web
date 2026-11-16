-- Passwordless sign-in: passkeys (WebAuthn) and one-time email codes.
-- The Google and wallet columns from 007 stay in place; nothing is dropped here.

-- One row per registered passkey.
CREATE TABLE IF NOT EXISTS webauthn_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Raw credential ID, unique across all users.
    credential_id BYTEA NOT NULL UNIQUE,
    -- webauthn-rs `Passkey` (public key, counter, backup flags) as JSON.
    passkey JSONB NOT NULL,
    name VARCHAR(64) NOT NULL DEFAULT 'Passkey',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user ON webauthn_credentials(user_id);

-- Server-side state of a WebAuthn ceremony in progress. Single use, short-lived.
CREATE TABLE IF NOT EXISTS auth_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- 'register': a signed-in user adds a passkey. 'login': usernameless sign-in.
    -- 'signup': a visitor creates an account with a passkey; the account-to-be (new user id,
    -- generated username, age tier) rides in `state`, and no `users` row exists until finish.
    kind VARCHAR(16) NOT NULL CHECK (kind IN ('register', 'login', 'signup')),
    -- Set for 'register' only.
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    state JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_challenges_expires ON auth_challenges(expires_at);

-- Passkey sign-ups begun, by client address: what the per-IP sign-up limit counts.
-- (The challenge row cannot serve: it is deleted when the sign-up finishes.)
CREATE TABLE IF NOT EXISTS signup_attempts (
    id BIGSERIAL PRIMARY KEY,
    ip VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signup_attempts_ip ON signup_attempts(ip, created_at DESC);

-- One-time email codes. Only an HMAC of the code is stored.
-- Rows are also what the per-email and per-IP request limits count.
CREATE TABLE IF NOT EXISTS email_login_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Lower-cased address the code was issued to.
    email VARCHAR(255) NOT NULL,
    code_hash CHAR(64) NOT NULL,
    ip VARCHAR(64) NOT NULL,
    -- 'login': sign in, creating the account if the address is new.
    -- 'add': a signed-in account (user_id) proving it owns the address before it is stored.
    purpose VARCHAR(8) NOT NULL DEFAULT 'login' CHECK (purpose IN ('login', 'add')),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    -- 'adult' or 'teen', as stated by the age gate; applied when the code creates an account.
    age_tier VARCHAR(10) NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_email_login_codes_email ON email_login_codes(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_login_codes_ip ON email_login_codes(ip, created_at DESC);

-- Email sign-in looks accounts up case-insensitively (older rows keep the case Google gave).
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (lower(email));
