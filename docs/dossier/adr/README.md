# Architecture decision records

**Purpose:** the main technical decisions behind Sonnet Man, one file each, so that nobody has to rediscover why the game is built the way it is.

**Audience:** David Charlot (technical lead), future engineers, contractors and coding agents.

**As of:** commit 0d6df6ef (`integrate/wave3`, 2026-11-18), plus the release branches `fix/judge-wording`, `fix/server-authority`, `fix/voice-g2p` and `fix/compliance` (2026-11-19).

**Status:** Draft for the team, 2026-11-19.

**Related documents:** `../12-technical-design.md`, `../13-ai-design-and-system-cards.md`, `../14-localisation-kit.md`, `../15-qa-and-test-plan.md`, `../17-operations-runbook-and-launch-checklist.md`, the repository's `CLAUDE.md`.

---

## How these were made

These records were **reconstructed** on 2026-11-19 from `CLAUDE.md`, commit messages and the fact bases in `../sources/`. None was written at the time of the decision. Each gives its date (the commit or the owner direction that made it) and its source, so a reader can check it.

They follow **MADR 4.0** (Markdown Architecture Decision Records, 2024-09-17, https://adr.github.io/madr/), as recommended for this dossier (`../research/sota-production-2026-11.md` §7.3): context, decision drivers, options, outcome, consequences, how the decision is confirmed, and the pros and cons of each option.

Rules for the future:

- **Never edit a decision; supersede it.** Write a new record, set the old one's status to "Superseded by NNNN", and link both ways. No record here is superseded yet; 0006 reverses an earlier choice made in a commit (`d56f5c8a`), not in an ADR, and shows how to cite what it replaces.
- **"Who decided"** names the owner only where the source records an owner direction or choice. Elsewhere the decision was made in engineering work (by the owner with coding agents) and recorded in a commit; the record says so.
- **Status words:** *Accepted* (built), *Accepted, in this release* (decided 2026-11-19, being built on the named branch, not live), *Proposed* (not decided), *Superseded*.

## Index

| No. | Decision | Date | Status |
|---|---|---|---|
| [0001](0001-in-browser-ai-no-cloud-inference.md) | Run all AI in the player's browser; no cloud inference | 2026-11-16 | Accepted |
| [0002](0002-every-duel-plays-without-a-model.md) | Every duel plays without a model: written opponent and rule judge | 2026-11-16 | Accepted |
| [0003](0003-three-models-measured-gates.md) | Three models, offered by device and used only where measured | 2026-11-16 | Accepted |
| [0004](0004-judge-reads-scores-in-both-orders.md) | The model judge returns scores, never text, read in both orders | 2026-11-16 | Accepted |
| [0005](0005-grade-path-injection-defences.md) | Defend the grade path against injection by structure | 2026-11-16 | Accepted |
| [0006](0006-compare-wording-back-to-main.md) | The compare path's wording goes back to main's | 2026-11-19 | Accepted, in this release |
| [0007](0007-whisper-on-wasm-not-web-speech.md) | Speech on the device: Whisper on WebAssembly, not Web Speech | 2026-11-16 | Accepted |
| [0008](0008-english-voice-g2p-from-cmudict.md) | The English voice's pronunciation from the CMU dictionary, not eSpeak NG | 2026-11-19 | Accepted, in this release |
| [0009](0009-passkeys-and-email-codes.md) | Passkeys first, emailed codes second; no passwords, no Google | 2026-11-16 | Accepted |
| [0010](0010-server-side-sessions-fresh-proof.md) | Sessions on the server, fresh proof, a mandatory secret | 2026-11-16 | Accepted |
| [0011](0011-limits-per-network.md) | Limits per network at three widths; no ceiling refuses everyone | 2026-11-16 | Accepted |
| [0012](0012-rust-api-rules-judge-golden-vectors.md) | Rust API scores online rounds by rule, held to the TypeScript by golden vectors | 2026-11-16 | Accepted |
| [0013](0013-online-english-only.md) | Online duels in English only | 2026-11-17 | Accepted |
| [0014](0014-rooms-in-memory-verses-never-stored.md) | Online rooms in memory; verses never stored | 2026-11-16 | Accepted |
| [0015](0015-generated-language-data-pinned-sources.md) | Language data generated from pinned, authoritative sources | 2026-11-16 | Accepted |
| [0016](0016-self-hosted-runtimes-third-party-allowlist.md) | Self-host every runtime; allow-list every other origin | 2026-11-16 | Accepted |
| [0017](0017-service-worker-static-only.md) | The service worker keeps only static files fetched without credentials | 2026-11-16 | Accepted |
| [0018](0018-analytics-after-age-gate.md) | Analytics only after the age gate | 2026-11-16 | Accepted |
| [0019](0019-build-host-no-github-actions.md) | Build and test on the build host; no GitHub Actions | 2026-11-16 | Accepted |
| [0020](0020-additive-migrations-binary-rollback.md) | Migrations only add; roll back the binary, never the schema | 2026-11-17 | Accepted |
| [0021](0021-server-authoritative-economy.md) | A server-authoritative economy | 2026-11-19 | Accepted, in this release |
| [0022](0022-static-astro-local-first.md) | A static Astro site with local-first storage | 2026-02-13 | Accepted (inherited) |

## Decisions still to make (proposed, not recorded as ADRs yet)

- Replace or keep the three models that predate the owner's 2026-04-01 rule (LFM2.5 350M, Whisper base, Kokoro-82M): `../13-ai-design-and-system-cards.md` §8.
- Article 50(2) machine-readable marking of AI verse and speech: `../13-ai-design-and-system-cards.md` §7.
- Self-hosted analytics in place of hosted Plausible: `../16-analytics-and-tracking-plan.md` §5.
- Pin model weights to a revision: `../12-technical-design.md` §4.3.
- A Content-Security-Policy and the proxy secret: `../12-technical-design.md` §7.3–7.4.
