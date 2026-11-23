# 0020. Migrations only add; roll back the binary, never the schema

**Document:** one architecture decision record (MADR 4.0), reconstructed on 2026-11-19 from the sources it cites, so that a reader knows what was decided and why. **Audience:** engineers, contractors, coding agents and the technical lead. **As of:** 0d6df6ef plus the release branches `fix/judge-wording`, `fix/server-authority`, `fix/voice-g2p` and `fix/compliance`. **Document status:** Draft for the team, 2026-11-19 (the decision's own status is below). **Related:** `README.md` (index), `../12-technical-design.md`, `../17-operations-runbook-and-launch-checklist.md`.

- **Status:** Accepted
- **Date:** 2026-11-17 (check script, commit 9711085c); the additive rule is stated in migration 019's header
- **Who decided:** engineering work, recorded in commit 9711085c and `CLAUDE.md:577-585`
- **Source:** commit 9711085c ("deploy: scripts/check-migrations.sh says before a swap whether the new API would refuse to start"); `scripts/check-migrations.sh:1-13`; `backend/migrations/019_limits_and_declared_age.sql:1-5`; `backend/src/db.rs:17-26`; `sources/as-built-tech.md` §10.2

## Context and problem statement

The API runs its pending migrations from `./migrations` at start-up (sqlx). sqlx refuses to start when the database holds a migration its folder lacks (`VersionMissing`), when an applied file has changed (`VersionMismatch`), or when one failed half-way (`Dirty`). A deploy that hits one of these leaves the site without an API. How are schema changes deployed and undone?

## Decision drivers

- A rollback must always be possible and fast.
- A deploy must say before the swap whether the new binary will start.

## Considered options

1. Down-migrations: undo the schema when rolling back.
2. Migrations that only add (tables, nullable columns, indexes), are re-runnable, and keep the previous binary working; a rollback puts the old binary back and leaves `./migrations` as it is; a check script run before the swap.

## Decision outcome

Option 2. `scripts/check-migrations.sh <new migrations folder> -d <database>` compares `_sqlx_migrations` with the files the way sqlx does (SHA-384 of each) and exits 1 when the new API would refuse to start. Never delete an applied migration file.

### Consequences

- Good: rolling back is a binary swap.
- Bad: dead columns and tables accumulate (the NFT, wallet and battle-room schema at 0d6df6ef).
- Bad: a destructive change (dropping a column, tightening a type) needs a two-step plan across releases.
- Bad: the check needs `psql` on production and the new folder copied there first.

### Confirmation

The script's exit code in the deploy steps (`../17-operations-runbook-and-launch-checklist.md`). Migrations 018 and 019 state they are additive and re-runnable.

## Pros and cons of the options

| Option | Pros | Cons |
|---|---|---|
| Down-migrations | clean schema | rollbacks that can lose data; more to test |
| Additive + pre-swap check | safe, fast rollback | schema debt |

## More information

`../12-technical-design.md` §6.3.
