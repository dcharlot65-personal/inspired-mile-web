# 0011. Limits per network at three widths; no ceiling refuses everyone

**Document:** one architecture decision record (MADR 4.0), reconstructed on 2026-11-19 from the sources it cites, so that a reader knows what was decided and why. **Audience:** engineers, contractors, coding agents and the technical lead. **As of:** 0d6df6ef plus the release branches `fix/judge-wording`, `fix/server-authority`, `fix/voice-g2p` and `fix/compliance`. **Document status:** Draft for the team, 2026-11-19 (the decision's own status is below). **Related:** `README.md` (index), `../12-technical-design.md`, `../17-operations-runbook-and-launch-checklist.md`, ADR 0010.

- **Status:** Accepted
- **Date:** 2026-11-16 (first and second review)
- **Who decided:** engineering work from the 2026-11-16 reviews, recorded in commit fed41095 and `CLAUDE.md:292-309`
- **Source:** commit fed41095; `backend/src/auth/client_ip.rs:16-57`; `backend/src/auth/passkeys.rs:11-111`; `backend/src/auth/email_code.rs:1-92`; `CLAUDE.md:292-309`; `sources/as-built-tech.md` §3.3–3.4

## Context and problem statement

Limits on sign-ups, codes and rooms protect the server and other players. Keyed on a single address they fail twice: one home IPv6 line holds 65,536 /64 networks, so an attacker can look like thousands of clients; and a site-wide ceiling that refuses everyone lets one party shut sign-in for all. The second review found that a full challenge table refused every visitor, so one IPv6 /48 split into 200 /64s could stop all passkey sign-in in nine seconds. How should limits be keyed and capped?

## Decision drivers

- One party must not be able to use a limit against another.
- One home line must not count as thousands of clients.
- A ceiling must never refuse everyone.
- Parallel requests must not slip past a check.

## Considered options

1. Limits per client address only, with plain site-wide ceilings.
2. Limits per network at widths chosen by what each limit protects, site-wide ceilings that refuse only networks that already had a share, all checked under advisory locks.

## Decision outcome

Option 2:

- **Request rate:** per IPv4 address or IPv6 /64 (600 a minute).
- **Anything one party could turn on another or use to fill a table** (email codes and guesses, sign-in ceremonies, game rooms): per IPv4 address or IPv6 /48.
- **The sign-up budget:** per IPv4 /24 or IPv6 /48 (40 accounts an hour).
- **At a site-wide ceiling** only a network that has already had a small share is refused (2 accounts, 10 begun sign-ups or 10 live ceremonies); everyone else is served, and the API logs a banner.
- **An inbox** gets at most 10 codes an hour, at most 3 from one network, so no network, and no three together, can stop another from getting a code.
- **Every limit is checked under the inbox's and the network's advisory locks** in the transaction that inserts.
- **The client's address** comes from forwarding headers only when the peer is a configured trusted proxy (and, if set, carries a shared proxy secret); otherwise from the socket.

### Consequences

- Good: a flood is contained to its own network; the site keeps serving others.
- Bad: if the real proxy is not trusted, every visitor shares one allowance; the API logs which peers it trusts at start-up, and this must be checked on every deploy (`CLAUDE.md:274-279`).
- Bad: many players behind one school network share the /24 sign-up budget (40 an hour); a class of 30 signing up together fits, two classes in the same hour may not.

### Confirmation

`backend/src/auth/email_code.rs` (18 unit tests) and `client_ip.rs` (15) (tech §7.1); a test-only delay between each check and its write lets the end-to-end tests show that a check made without its lock lets parallel requests through, and the API refuses to start with that delay on an https origin (`CLAUDE.md:310-313`).

## Pros and cons of the options

| Option | Pros | Cons |
|---|---|---|
| Per address, plain ceilings | simple | IPv6 evasion; one party can shut everyone out |
| Per network, fair ceilings, locks | contained floods; no global lock-out | proxy trust must be right; schools share budgets |

## More information

Values: `../12-technical-design.md` §7.2 and `sources/as-built-tech.md` §3.3.
