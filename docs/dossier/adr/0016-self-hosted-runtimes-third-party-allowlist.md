# 0016. Self-host every runtime; allow-list every other origin

**Document:** one architecture decision record (MADR 4.0), reconstructed on 2026-11-19 from the sources it cites, so that a reader knows what was decided and why. **Audience:** engineers, contractors, coding agents and the technical lead. **As of:** 0d6df6ef plus the release branches `fix/judge-wording`, `fix/server-authority`, `fix/voice-g2p` and `fix/compliance`. **Document status:** Draft for the team, 2026-11-19 (the decision's own status is below). **Related:** `README.md` (index), `../12-technical-design.md`, `../16-analytics-and-tracking-plan.md`, ADR 0018.

- **Status:** Accepted
- **Date:** 2026-11-16 (commits 74f8684c, a4d76c8a and 3b7f47cc)
- **Who decided:** engineering work, recorded in the commits above and `CLAUDE.md:610-637`
- **Source:** commit 74f8684c ("Ship the model runtime from this site instead of jsDelivr"); commit a4d76c8a ("Bundle model-viewer; stop the VR gallery fetching from Babylon's servers"); commit 3b7f47cc ("Test every page's requests to other origins against one allowlist"); `scripts/self-hosted-runtime.mjs:1-16`; `tests/third-party-allowlist.ts`; `sources/as-built-tech.md` §1.4

## Context and problem statement

Transformers.js fetched onnxruntime-web's WebAssembly and loader from cdn.jsdelivr.net the first time a model started; kokoro-js did the same; `/viewer` loaded model-viewer from a Google CDN; Babylon's WebXR set-up fetched hand and controller models from Babylon's servers. That was third-party code on the page that holds the verse and the microphone, disclosed nowhere (commit 74f8684c). How should the page's dependencies be served, and how is the privacy policy's list of companies kept true?

## Decision drivers

- No third-party code on a page that holds player text and audio.
- The privacy policy must name every company the browser talks to.
- A library upgrade must not silently reintroduce a CDN.

## Considered options

1. Let libraries use their CDN defaults; list the CDNs in the policy.
2. Serve every runtime file from the site; turn off every remote default; test every page's requests against one allowlist that the policy mirrors.

## Decision outcome

Option 2. `scripts/self-hosted-runtime.mjs` (an Astro integration) serves onnxruntime-web, kokoro-js's runtime and model-viewer's Draco and KTX2 decoders from `node_modules` in development and copies them into the build (about 90 MB) under a path carrying the library version. Pages load the library only through `loadTransformers()` and `loadModelViewer()`. Babylon's remote hand and controller models are turned off. If a file is missing the build stops, and a page with no paths refuses to load a model rather than fall back to the CDN. `tests/third-party.spec.ts` loads every page in every age-gate state and fails on any request to an origin the allowlist does not list with a reason. Allowed: Plausible after the age gate; the Hugging Face hub and its storage hosts for model files.

### Consequences

- Good: the policy's "Other Companies Involved" is enforced by a test (`CLAUDE.md:610-615`).
- Good: "each of these was seen to fail with the corresponding fix reverted" (commit 3b7f47cc).
- Bad: about 90 MB of vendor files in every build; two copies of the model runtime, one a nightly pre-release (tech §11.4).
- Bad: model weights still come from Hugging Face, which learns the player's IP address and the model asked for.
- Not covered: there is no Content-Security-Policy, so the allowlist is enforced by tests, not by the browser.

### Confirmation

`tests/third-party.spec.ts` (9 tests) on every run of the browser suite; the build stops when a self-hosted file moves.

## Pros and cons of the options

| Option | Pros | Cons |
|---|---|---|
| CDN defaults | smaller builds; shared caches | third-party code beside the verse; policy drift |
| Self-hosted + allowlist test | one origin for code; policy enforced | 90 MB of vendor files; upgrades need care |

## More information

Proposed: a CSP as a second wall (`../12-technical-design.md` §7.4); serving model weights from the site, with their licence and notice files beside them (`../research/sota-production-2026-11.md` §5.10), would remove Hugging Face from the policy, at the cost of hosting 1 to 3 GB files.
