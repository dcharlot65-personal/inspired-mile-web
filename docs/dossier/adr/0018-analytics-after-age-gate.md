# 0018. Analytics only after the age gate

**Document:** one architecture decision record (MADR 4.0), reconstructed on 2026-11-19 from the sources it cites, so that a reader knows what was decided and why. **Audience:** engineers, contractors, coding agents and the technical lead. **As of:** 0d6df6ef plus the release branches `fix/judge-wording`, `fix/server-authority`, `fix/voice-g2p` and `fix/compliance`. **Document status:** Draft for the team, 2026-11-19 (the decision's own status is below). **Related:** `README.md` (index), `../16-analytics-and-tracking-plan.md`, ADR 0016.

- **Status:** Accepted. A revisit is proposed (see "More information").
- **Date:** 2026-11-16
- **Who decided:** engineering work, recorded in commit fd0f39a8
- **Source:** commit fd0f39a8 ("Load analytics only after the age gate is passed"); `src/layouts/BaseLayout.astro:71-90`; `src/pages/privacy.astro:89-100,164`; `src/lib/analytics.ts:11-42`; `sources/as-built-tech.md` §9

## Context and problem statement

The Plausible script tag was in the head of every page, so it ran for a visitor who had not answered the age gate and for one the gate had turned away as under 13 (commit fd0f39a8). The privacy policy promises no analytics for under-13 visitors. When may analytics run?

## Decision drivers

- No analytics for a visitor under 13, or one who has not answered.
- Page views only; never verse or voice.
- The third-party allowlist test must be able to check it (ADR 0016).

## Considered options

1. Keep the script on every page.
2. Inject the script only when the stored gate answer is `adult` or `teen-consented`; start it when a visitor passes the gate.
3. No analytics.

## Decision outcome

Option 2. `window.__loadAnalytics` in `BaseLayout.astro` adds the Plausible script (`data-domain="inspiredmile.com"`) only for a stored `adult` or `teen-consented` answer. In practice only page views are sent: `src/lib/analytics.ts` defines eight event helpers and nothing calls them.

### Consequences

- Good: the policy's promise for under-13 visitors holds and is tested (`tests/third-party.spec.ts` checks that analytics starts only when the gate is passed).
- Bad: the studio has no product data: no funnel, no duel balance, no retention (`../16-analytics-and-tracking-plan.md`).
- Bad: the page address sent includes the query string; the site's pages are counted under the parent domain.
- Open: hosted Plausible is a paid third-party service, which sits badly with the owner's "free and self-hosted only" rule; whether the account exists is Not known (tech §13).

### Confirmation

`tests/third-party.spec.ts` loads every page with the gate cleared, unanswered and blocked.

## Pros and cons of the options

| Option | Pros | Cons |
|---|---|---|
| Script on every page | full counts | breaks the under-13 promise |
| After the gate | promise kept and tested | counts only those who pass |
| None | nothing to disclose | no evidence for decisions |

## More information

**Proposed:** replace hosted Plausible with a self-hosted, cookieless tool or a first-party Rust endpoint, keeping this gate; event taxonomy and consent rules in `../16-analytics-and-tracking-plan.md`. A new ADR would supersede this one.
