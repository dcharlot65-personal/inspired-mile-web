# 0022. A static Astro site with local-first storage

**Document:** one architecture decision record (MADR 4.0), reconstructed on 2026-11-19 from the sources it cites, so that a reader knows what was decided and why. **Audience:** engineers, contractors, coding agents and the technical lead. **As of:** 0d6df6ef plus the release branches `fix/judge-wording`, `fix/server-authority`, `fix/voice-g2p` and `fix/compliance`. **Document status:** Draft for the team, 2026-11-19 (the decision's own status is below). **Related:** `README.md` (index), `../12-technical-design.md`, ADR 0021.

- **Status:** Accepted (inherited from the first build; kept by the 2026-11-16 rebuild)
- **Date:** 2026-02-13 (Astro, initial commit 8adecfe0); 2026-02-14 (local-first storage backend, commit 58d168f7). Upgraded to Astro 7 and Tailwind 4 on 2026-11-16 (commit ddc4e1dd).
- **Who decided:** not recorded; the choice predates every record in the repository
- **Source:** `astro.config.mjs:13-32`; `src/lib/storage-backend.ts:1-8`; `src/lib/api-client.ts:6-17`; commits 8adecfe0, 58d168f7, ddc4e1dd; `sources/as-built-tech.md` §1.1

## Context and problem statement

The game must start instantly, with no account, on any device, and the duel engine runs in the browser anyway. A server-rendered site would add a running process to every page view. Where is the page made, and where does a player's state live?

## Decision drivers

- Play with no account and no server round-trip.
- Cheap, cacheable hosting.
- An account should keep what the player did before signing up.

## Considered options

1. A server-rendered application.
2. A single-page application with a client router.
3. Static pages (Astro, no server output), each page's logic in TypeScript; game state in `localStorage` for anonymous play; the API used once the player signs in, with the browser's state copied into the account.

## Decision outcome

Option 3. Astro builds 18 static pages; all API calls go to `/api/v1` on the page's own origin with credentials; in development Astro proxies `/api` to the local API. Signing in switches the storage backend to the API, and `/migrate/sync` copies cards, stats, achievements and variants into the account.

### Consequences

- Good: no server process for pages; the site works without the API; first play needs no account.
- Good: the frontend build needs no secrets (`CLAUDE.md:217`).
- Bad: there is no client router, so a model loaded on one page is not carried to another; this is why model-written trivia never runs on the playground in practice (design §6.9).
- Bad: anonymous state is lost when the browser's data is cleared, and on iOS a Home Screen app and the Safari tab do not share storage (`src/lib/pwa.ts`).
- Bad: as built, `/migrate/sync` trusts what the browser sends; **in this release** cards come only from the server (ADR 0021).
- Bad: React 19 is integrated but unused (no page mounts a component).

### Confirmation

`astro.config.mjs` sets no `output` or adapter; `tests/prod-smoke.spec.ts` visits every page of the deployed site.

## Pros and cons of the options

| Option | Pros | Cons |
|---|---|---|
| Server-rendered | personalised pages | a process per view; no offline |
| Single-page app | state carried across views (a loaded model too) | heavier first load; one bundle |
| Static + local first | instant, cacheable, offline-capable | no shared state across pages; trust problems on sync |

## More information

`../12-technical-design.md` §4.
