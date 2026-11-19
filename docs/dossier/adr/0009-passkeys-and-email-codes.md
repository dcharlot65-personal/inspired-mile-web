# 0009. Passkeys first, emailed codes second; no passwords, no Google

**Document:** one architecture decision record (MADR 4.0), reconstructed on 2026-11-19 from the sources it cites, so that a reader knows what was decided and why. **Audience:** engineers, contractors, coding agents and the technical lead. **As of:** 0d6df6ef plus the release branches `fix/judge-wording`, `fix/server-authority`, `fix/voice-g2p` and `fix/compliance`. **Document status:** Draft for the team, 2026-11-19 (the decision's own status is below). **Related:** `README.md` (index), `../12-technical-design.md`, ADR 0010, ADR 0011.

- **Status:** Accepted
- **Date:** 2026-11-16
- **Who decided:** the owner (direction of 2026-11-16, `CLAUDE.md:641`: "Passwordless sign-in (passkeys + Resend email) replacing Google OAuth")
- **Source:** commits 6d0ae1d5, 8f3bfa78 and d1bf410b (2026-11-16); `CLAUDE.md:240-245,314-318`; `backend/src/auth/`; `src/lib/passwordless.ts`; `sources/as-built-tech.md` §3.1

## Context and problem statement

The February build signed players in with a password, then with Google OAuth and a Solana wallet (commit c8a68911, 2026-02-14). Google sign-in hands the studio a name, an email address and a photo, and children may be among the players. Passwords must be stored and leak. How should players sign in?

## Decision drivers

- Collect as little personal data as possible; ideally none.
- No third party in the sign-in path.
- Work for players without an email address.
- Recovery when a device is lost.

## Considered options

1. Keep Google OAuth (and wallets).
2. Passwords.
3. Passkeys (WebAuthn discoverable credentials, no username) as the primary method, with a 6-digit emailed code to create an account, sign in where no passkey exists, and recover.

## Decision outcome

Option 3, with webauthn-rs 0.6. A passkey-only account sends the studio no personal data: a public key, a device label, a random id and a generated username (`bard-<12 hex>`). Ceremony state lives in Postgres, single use, 5 minutes. Email codes are stored as an HMAC bound to the address, live 10 minutes, die after 5 wrong guesses, and never reveal whether an address has an account. Sign-up with a passkey alone was added the same day (d1bf410b).

### Consequences

- Good: no password store; no Google; passkeys meet WCAG 2.2's accessible-authentication criterion (`../research/sota-production-2026-11.md` §7.11).
- Good: the email text for "add a recovery email" differs from a sign-in code's, so a stranger cannot pass one off as the other (`backend/src/auth/mailer.rs:25-57`).
- Bad: **email is off in production** (no mail key), so a player who loses every passkey cannot recover. Accounts that exist only by email (old Google sign-ins) cannot sign in while it is off; production had 0 accounts on 2026-11-19, so nobody is locked out today.
- Bad: the relying-party ID can never change without orphaning every passkey (`CLAUDE.md:266-267`).
- Bad: the email step needs a third party (Resend) when it is turned on.

### Confirmation

`tests/auth.spec.ts` (101 tests, 3,033 lines) runs sign-in end to end against a throwaway Postgres and two real APIs, one with email and one without, with a virtual authenticator holding three passkeys (tech §7.1). `scripts/prod-passkey-check.mjs` makes one real passkey sign-up against the deployed site (it creates an account to delete).

## Pros and cons of the options

| Option | Pros | Cons |
|---|---|---|
| Google OAuth | familiar | personal data from a third party; children; outage dependency |
| Passwords | universal | storage, leaks, resets, phishing |
| Passkeys + email codes | no personal data needed; phishing-resistant | recovery needs email; RP ID fixed forever |

## More information

Sessions and fresh proof: ADR 0010. Limits on codes and sign-ups: ADR 0011.
