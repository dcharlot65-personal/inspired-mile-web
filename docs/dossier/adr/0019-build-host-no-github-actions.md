# 0019. Build and test on the build host; no GitHub Actions

**Document:** one architecture decision record (MADR 4.0), reconstructed on 2026-11-19 from the sources it cites, so that a reader knows what was decided and why. **Audience:** engineers, contractors, coding agents and the technical lead. **As of:** 0d6df6ef plus the release branches `fix/judge-wording`, `fix/server-authority`, `fix/voice-g2p` and `fix/compliance`. **Document status:** Draft for the team, 2026-11-19 (the decision's own status is below). **Related:** `README.md` (index), `../15-qa-and-test-plan.md`, `../17-operations-runbook-and-launch-checklist.md`.

- **Status:** Accepted
- **Date:** 2026-11-16 (the GitHub Actions deploy workflow removed, commit ddc4e1dd); the account-wide rule dated 2026-10-14 in the owner's global instructions
- **Who decided:** the owner (account-wide rule: no GitHub Actions; no heavy work on the development laptop), recorded in `CLAUDE.md:205-215,600`
- **Source:** commit ddc4e1dd ("removed the GitHub Actions deploy workflow (it targeted a retired host)"); `CLAUDE.md:205-238,600`; `sources/as-built-tech.md` §7

## Context and problem statement

The game's full test run starts a throwaway Postgres, two copies of the API, the dev server and a headless browser; the model tests download up to 3 GB and need a GPU. The owner's account-wide rules forbid GitHub Actions and keep heavy work off the development laptop. Where do builds and tests run?

## Decision drivers

- Never build or test on the development laptop.
- No paid CI; the fleet has its own machines.
- Runs must not interfere with each other on a shared host.

## Considered options

1. GitHub Actions (the February deploy workflow).
2. Builds and tests on a shared build host through a remote-build wrapper that snapshots the checkout, runs the command there with its own target directory, and returns the exit status.

## Decision outcome

Option 2. The documented gates (`CLAUDE.md:207-215`): `npm ci && npx vitest run && npm run build && npx playwright test`; `cd backend && cargo test --release && cargo build --release`; the real-model suite when the model path changes; the production smoke suite after a deploy. The release binary is built on Apple Silicon because production is arm64 macOS.

### Consequences

- Good: no CI bill; GPU tests possible on the host's own graphics chip.
- Good: since 2026-11-16 no server is reused: each run takes its own ports, so two concurrent runs can no longer test each other's code and pass (`CLAUDE.md:228-233`).
- Bad: the gates are run by hand; nothing forces them before a deploy.
- Bad: the host is shared; one run per checkout at a time; never `pkill -f 'astro dev'`, which stops every checkout's dev server (`CLAUDE.md:235-238`).
- Bad: all model measurements come from one machine.

### Confirmation

No `.github/workflows/` directory exists at 0d6df6ef (deleted in ddc4e1dd).

## Pros and cons of the options

| Option | Pros | Cons |
|---|---|---|
| GitHub Actions | automatic on push | no GPU for the model tests; against the owner's rule |
| Shared build host | free; GPU; the owner's fleet | manual; shared; one machine's results |

## More information

Proposed: one gate script that runs every gate in order and writes a dated result file the deploy checklist can cite (`../15-qa-and-test-plan.md` §4). Host names and the wrapper's path are in `../17-operations-runbook-and-launch-checklist.md`.
