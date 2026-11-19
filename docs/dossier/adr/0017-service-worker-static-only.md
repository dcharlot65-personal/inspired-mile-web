# 0017. The service worker keeps only static files fetched without credentials

**Document:** one architecture decision record (MADR 4.0), reconstructed on 2026-11-19 from the sources it cites, so that a reader knows what was decided and why. **Audience:** engineers, contractors, coding agents and the technical lead. **As of:** 0d6df6ef plus the release branches `fix/judge-wording`, `fix/server-authority`, `fix/voice-g2p` and `fix/compliance`. **Document status:** Draft for the team, 2026-11-19 (the decision's own status is below). **Related:** `README.md` (index), `../12-technical-design.md`, `../15-qa-and-test-plan.md`.

- **Status:** Accepted
- **Date:** 2026-11-16
- **Who decided:** engineering work, recorded in commit 382b13c2
- **Source:** commit 382b13c2; `public/sw.js:1-62,153-189`; `src/lib/pwa.ts`; `sources/as-built-tech.md` §1.5

## Context and problem statement

The game is installable and should load fast and work offline in part. Service worker v2 stored every successful API GET, `/api/v1/auth/me` (email address and username) among them, and nothing removed them on sign-out; it stored a second copy of the model weights; and on activation it deleted every other cache, which would have thrown away downloaded models (`public/sw.js:10-18`). What may the service worker keep?

## Decision drivers

- Nothing personal survives sign-out on a shared device.
- Never duplicate or delete the model caches (1 to 3 GB).
- Pages must still work offline where they can.

## Considered options

1. Fix v2's sign-out clean-up and keep caching API answers.
2. v3: keep only responses the worker fetched itself, without credentials, from static paths; leave `/api`, requests with an `Authorization` header and other origins to the browser; delete only caches the worker owns.

## Decision outcome

Option 2:

- build files under `/_astro/` cache-first;
- `/images`, `/fonts`, `/audio` and icons stale-while-revalidate;
- page navigations network-first, with the kept copy or `offline.html` when offline;
- never anything under `/api`, never another origin, nothing over 12 MB;
- precache: `offline.html`, one font, three icons;
- on sign-out, delete everything not on the static list; on activation, delete the v2 cache only.

The model weights are cached by Transformers.js in its own same-origin cache, which the worker never touches; the page asks `navigator.storage.persist()` after a model loads.

### Consequences

- Good: no account data in any cache; models are neither duplicated nor deleted.
- Bad: offline solo play is untested (no test takes the browser offline and plays a duel; tech §1.5).
- Bad: the worker is registered by its literal name `/sw.js`, so a deploy that content-hashes file names would break it (tech §10.3; `../17-operations-runbook-and-launch-checklist.md`).

### Confirmation

`tests/sw-cache.spec.ts` and `tests/pwa.spec.ts` (18 tests), and 48 unit tests of PWA and service-worker rules (tech §7.1).

## Pros and cons of the options

| Option | Pros | Cons |
|---|---|---|
| Fix v2 | API answers available offline | personal data in caches; easy to get wrong again |
| v3 static-only | nothing personal cached; models safe | the signed-in parts need the network |

## More information

`../12-technical-design.md` §4.6.
