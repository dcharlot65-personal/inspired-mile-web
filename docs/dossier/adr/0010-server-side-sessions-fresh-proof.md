# 0010. Sessions on the server, fresh proof, a mandatory secret

**Document:** one architecture decision record (MADR 4.0), reconstructed on 2026-11-19 from the sources it cites, so that a reader knows what was decided and why. **Audience:** engineers, contractors, coding agents and the technical lead. **As of:** 0d6df6ef plus the release branches `fix/judge-wording`, `fix/server-authority`, `fix/voice-g2p` and `fix/compliance`. **Document status:** Draft for the team, 2026-11-19 (the decision's own status is below). **Related:** `README.md` (index), `../12-technical-design.md`, ADR 0009.

- **Status:** Accepted
- **Date:** 2026-11-16
- **Who decided:** engineering work from the 2026-11-16 review of `backend/src`, recorded in commit fed41095
- **Source:** commit fed41095; `backend/src/auth/sessions.rs`; `backend/src/auth/jwt.rs:7-19`; `backend/src/config.rs:95-140,239-290`; `CLAUDE.md:246-265`; `sources/as-built-tech.md` §3.2

## Context and problem statement

Main signed a stateless token with a secret that fell back to a public development string when unset (`main:backend/src/config.rs:106-107`). A stateless token cannot be revoked: sign-out only deleted the cookie, and a stolen token worked until it expired. Adding a passkey needed nothing but the cookie. How should sessions work?

## Decision drivers

- A signed-out session must stop working at once.
- A stolen cookie alone must not let an attacker add their own passkey.
- The server must refuse to run with a weak or public secret.

## Considered options

1. Keep stateless tokens; shorten their life.
2. Server-side session rows named by the token, a fresh proof for sensitive changes, and a mandatory strong secret.

## Decision outcome

Option 2:

- **Sessions are rows** in `auth_sessions` (migration 018); the cookie's HS256 token carries a session id and is good only while its row is live. Sign-out revokes the row; "sign out everywhere" revokes all of an account's rows; removing a passkey revokes the account's other sessions. Sessions last 7 days.
- **Cookie:** `__Host-im_token` on https (`im_token` over http, where browsers refuse the prefix), HttpOnly, Secure, SameSite=Strict. Sign-out requires a same-site JSON request.
- **Fresh proof:** adding or removing a passkey and adding an email need a passkey assertion or emailed code from the last 5 minutes; otherwise 403 `reauth_required`, and the page proves and retries.
- **The signing secret is mandatory:** start-up exits (code 2) if it is absent, under 32 bytes, the template's placeholder or the old development constant. Email codes use a key derived from it.
- **The game's WebSocket re-checks its row** before acting on a message (an answer is good for 1 s) and every 15 s.

### Consequences

- Good: sign-out is real; a stolen cookie cannot add a passkey without the device.
- Bad: tokens issued by main carry no session id and stop parsing, so the deploy signs everyone out (tech §10.3); with 0 accounts on 2026-11-19 this costs nothing.
- Bad: changing the secret signs everyone out (`backend/.env.production.template`).
- Bad: every request reads a row.

### Confirmation

`backend/src/config.rs` has 20 unit tests of configuration refusals (tech §7.1); `tests/auth.spec.ts` covers sign-out, sign-out everywhere and fresh proof end to end.

## Pros and cons of the options

| Option | Pros | Cons |
|---|---|---|
| Stateless tokens | no lookup | no revocation; main's public fallback secret |
| Server-side rows + fresh proof | revocable; sensitive changes need the device | a lookup per request; deploy signs everyone out once |

## More information

`../12-technical-design.md` §7.1.
