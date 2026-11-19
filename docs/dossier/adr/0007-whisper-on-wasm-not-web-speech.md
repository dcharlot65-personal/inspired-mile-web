# 0007. Speech on the device: Whisper on WebAssembly, not Web Speech

**Document:** one architecture decision record (MADR 4.0), reconstructed on 2026-11-19 from the sources it cites, so that a reader knows what was decided and why. **Audience:** engineers, contractors, coding agents and the technical lead. **As of:** 0d6df6ef plus the release branches `fix/judge-wording`, `fix/server-authority`, `fix/voice-g2p` and `fix/compliance`. **Document status:** Draft for the team, 2026-11-19 (the decision's own status is below). **Related:** `README.md` (index), `../13-ai-design-and-system-cards.md`, ADR 0001, ADR 0008.

- **Status:** Accepted
- **Date:** 2026-11-16
- **Who decided:** engineering work under the owner's in-browser direction, recorded in commit e41c73f5 ("The browser's Web Speech recognition sends audio to a server, so it is gone")
- **Source:** commit e41c73f5; `CLAUDE.md:21-22`; `src/lib/ear.ts:1-20,35-41,83-96,128`; `src/lib/thespian-voice.ts:62-84,144-158`; `sources/as-built-tech.md` §4.3

## Context and problem statement

A player may speak a verse instead of typing it. The browser's built-in speech recognition (the Web Speech API) is free and fast, but in its default mode Chrome sends the audio to a server. Players may be teenagers; the privacy policy promises that what a player says in a solo duel is never sent anywhere. How should speech become text?

## Decision drivers

- Audio never leaves the device.
- Work on every browser with WebAssembly, with or without WebGPU.
- Cover the duel's language where possible.

## Considered options

1. Web Speech API, default mode.
2. Whisper base (multilingual, q8, about 80 MB) through Transformers.js on WebAssembly.
3. A larger Whisper on WebGPU.

## Decision outcome

Option 2. The microphone button records up to 45 s, resamples to 16 kHz mono in the browser and transcribes with Whisper base, passing the duel's language. Spoken output follows the same rule: Kokoro for English, and in other languages only voices the browser reports as local (`localService`), since network voices send the text away.

### Consequences

- Good: no speech service is contacted (tested: `tests/model/ear.spec.ts`).
- Good: runs without WebGPU, so a phone can transcribe even though it gets no language model.
- Bad: quality is uneven outside major languages, and Whisper can output text that was not spoken (its card, `docs/research/in-browser-ai-2026-11.md` line 229). No measurement exists outside English; the one test is English and is skipped without a recorded file.
- Bad: Whisper base predates the owner's 2026-04-01 model rule.
- Bad: an 80 MB download before the first spoken verse.

### Confirmation

`tests/model/ear.spec.ts` plays a recorded verse through a fake microphone and checks the transcript and that no speech service is contacted; `tests/third-party.spec.ts` loads Whisper for real and checks where its files come from.

## Pros and cons of the options

| Option | Pros | Cons |
|---|---|---|
| Web Speech, default | no download, fast | audio sent to a server; breaks the promise |
| Whisper base on WASM | private; any modern browser | uneven languages; pre-cutoff model; 80 MB |
| Larger Whisper on WebGPU | better accuracy | too heavy for phones |

## More information

Since this decision, Chrome 139+ desktop offers on-device Web Speech (`processLocally = true`), Firefox planned it for 161, and Android and ChromeOS do not have it; newer on-device models (Moonshine streaming per language, MIT, 2026-08-24; Granite Speech 5.0, Apache 2.0, 2026-10) are candidates (`../research/sota-production-2026-11.md` §3.1). A future ADR may allow Web Speech **only** with `processLocally = true` after an availability check. See `../13-ai-design-and-system-cards.md` §8.
