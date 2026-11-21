# Marking what a model wrote

How Sonnet Man marks the text and speech its AI produces, so that a machine can tell it is AI output
(owner decision D-01, 2026-11-19), and how it labels a model's verse for the player (D-12). Written
2026-11-19 with the code that does it. Not legal advice: whether the studio is a "provider" in the
law's sense is for counsel (D-01 asks them in parallel).

## What the law asks

Regulation (EU) 2024/1689 (the AI Act), Article 50(2), as published in the Official Journal (OJ L,
2024/1689, 12.7.2024):

> 2. Providers of AI systems, including general-purpose AI systems, generating synthetic audio, image,
> video or text content, shall ensure that the outputs of the AI system are marked in a
> machine-readable format and detectable as artificially generated or manipulated. Providers shall
> ensure their technical solutions are effective, interoperable, robust and reliable as far as this is
> technically feasible, taking into account the specificities and limitations of various types of
> content, the costs of implementation and the generally acknowledged state of the art, as may be
> reflected in relevant technical standards. This obligation shall not apply to the extent the AI
> systems perform an assistive function for standard editing or do not substantially alter the input
> data provided by the deployer or the semantics thereof, or where authorised by law to detect,
> prevent, investigate or prosecute criminal offences.

Recital 133 names the kinds of solution meant: "watermarks, metadata identifications, cryptographic
methods for proving provenance and authenticity of content, logging methods, fingerprints or other
techniques". Read on 2026-11-19 from the Publications Office's copy of the act
(`publications.europa.eu/resource/celex/32024R1689`, served as cellar
`dc8116a1-3fe6-11ef-865a-01aa75ed71a1.0006.03`, sha256 of the XHTML
`8f0b656302f9864cc87e040c371f209a9d65ae1a6cecc25ca5eb737e872d721a`); EUR-Lex's own page answered a
script check that a command-line client cannot pass. Whether a later amendment changed paragraph 2's words was
not checked when this was written; the compliance branch's last check (2026-11-20) read Regulation (EU)
2026/1744 (OJ L, 24.7.2026) on EUR-Lex: in Article 50 it replaces only paragraph 7, and it adds Article 111(4),
which gives a system placed on the market before 2 August 2026 until **2 December 2026** to comply with
paragraph 2. The Commission's code of practice is compared below.

**With the notice before the duel.** Article 50(1) is met separately, by the notice the battle page and the
Theatre show before a duel (`src/lib/ai-notice.ts`, from `fix/compliance`): it says whether a model writes or
judges that duel. Both read the same lists (`MODELS[tier].writesIn` and `judgesIn`), so a verse is labelled
only in a duel whose notice says a model writes (`tests/ai-marking.spec.ts`, "the notice and the label agree").
Where a model writes, a round in which its verse loses to the written opponent's (`opponent.ts`) shows the
written verse, unlabelled: the notice names who may write, the label who wrote the verse in front of the player.

## The method: a metadata identification on the element

Every element of a page that holds text a model wrote carries two attributes
(`src/lib/ai-marking.ts`):

```html
<blockquote id="opponent-verse"
  data-ai-generated="name=Gemma 4 E2B; model=onnx-community/gemma-4-E2B-it-ONNX; revision=main; dtype=q4f16"
  data-ai-source="trainedAlgorithmicMedia">…</blockquote>
```

- `data-ai-generated`: `name` is the model as the game names it, `model` its repository on the
  Hugging Face hub (where the browser downloads it), `revision` the version of that repository the game
  asks for, `dtype` the precision of the weights. Fields are separated by `; `; `readAiGenerated()`
  reads one back.
- `data-ai-source`: IPTC's Digital Source Type term for content made by a trained model, the same
  vocabulary C2PA and photo metadata use.
- Text no model wrote has no `data-ai-generated` at all. The written opponent's verse carries
  `data-source="written"`.

Any page's AI text is found with `document.querySelectorAll('[data-ai-generated]')`. The mark is set
from the session's record of which model wrote the verse (`DuelSession.opponentModel`), not guessed
from the text.

**The version is the repository's `main`, not a pinned commit.** `src/lib/brain.ts` names no revision,
so Transformers.js downloads each repository's `main`, and the mark says `revision=main`: the version
as asked for. On 2026-11-19 (Hugging Face API, `/api/models/<repo>/revision/main`) `main` was:

| Model | Commit on `main` | Committed |
|---|---|---|
| Gemma 4 E2B | `6f21c99d7e18237f8d2ce92aadfdbfeba877f63a` | 2026-10-13 |
| LFM3 1.7B | `ab9fec4c681a25bec3b48b0b97a62fc2660a2985` | 2026-10-27 |
| LFM2.5 350M | `d11593fd9eb408e322667926656598896c2d5ff9` | 2026-03-31 |

All three are older than the measurements that decide where each model writes (the cells in
`docs/language/model-eval/cells/` are dated 2026-11-18), so `main` is the weights that were measured.
Pinning these commits in `brain.ts` would make the mark exact, but it changes every download address,
and a browser keeps a model under its address: every returning visitor would download the model again
(up to 3.1 GB), and the battle page loads a remembered model by itself. The Code of Practice makes the
version optional (Measure 1.3, "may also include the underlying AI model identifier and version
number"). Pin them the next time a model changes, when every visitor downloads it anyway, and check
`main` against this table before each deploy until then.

## Where

| AI output | Where it appears | Machine-readable | For the player |
|---|---|---|---|
| The opponent's verse, written by a model | battle page (`#opponent-verse`) | the mark on the verse | the label "AI" at the start of the verse, in the interface's language (`ai.label`), laid out in the duel language's direction so it stays beside the verse when the interface reads the other way; the label and the verse are one polite live region (`#opponent-said`), so a screen reader reads both when the verse arrives, and only then |
| The same, in the Theatre | a 3D stage drawn on a canvas, which holds no text a machine can read | the mark on a text copy of the verse beside the stage (`#theatre-opponent-verse`, which screen readers also read) | "AI · {model}" above the verse on the stage |
| Trivia questions and quote challenges a model wrote | the playground | the mark on the question and on each answer; on a challenge's quotation and on the play and speaker it names, on every screen that shows them (the challenge, the right answer, the wrong one) | the "AI Generated" badge (`pg.trivia.aiBadge`) on each of those screens |
| English speech (Kokoro-82M) | played in the page, never saved or offered as a file | none possible: no file leaves the page | the setting reads "AI voice" (`voice.*`) |

The label's word is Wikidata's for artificial intelligence (Q11660) in each language, its label or an
alias (`docs/language/sources/wikidata-Q11660.json`; `src/i18n/ai-label.test.ts`).

As built, no page that offers trivia loads a model (only the battle page and the Theatre do), so the
playground's model-written questions cannot appear today; they are marked for when they can.

## Against the Commission's Code of Practice

The Commission published the final *Code of Practice on Transparency of AI-Generated Content* on
2026-06-10 (`digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content`; the PDF,
38 pages, read on 2026-11-19, sha256 `7bd22c5a3c56eaefda27a5bf7a6118198ef2a9c9255241bd97abf7cdedf9bc28`).
It is voluntary: a way to show that Article 50(2) is met, not the law itself, and the studio has not
signed it. Its Section 1 (providers), measure by measure, for what this game makes:

| The Code | What it asks | Here |
|---|---|---|
| Measure 1.1 | at least one machine-readable marking technique; two layers (signed metadata and a watermark) for "audio, images, video, and containerised text" | The text is shown in an HTML page, which the Code's glossary counts as containerised text ("text inside PDFs, Word documents, or HTML files"), so metadata is the layer it has: the mark on the element |
| Sub-measure 1.1.1 | metadata saying the content is AI-generated, "digitally signed and time-stamped", "except in circumstances where the deployment context does not permit the secure handling or provisioning of the key, for example in a local deployment scenario" | Recorded, not signed: the model runs in the visitor's browser, and a signing key sent there could not be kept secret, which is the local deployment the exception names |
| Sub-measure 1.1.2 | an imperceptible watermark, "with the exception of very short text", defined as "text shorter than 200 tokens" | None, and none is due: every output is very short text by construction. A verse is asked for at most `28 + 22 × lines` new tokens (`opponent.ts`; five lines at most, an Indonesian acrostic, so 138), and a trivia question or challenge at most 200 (`content-gen.ts`), of which the page shows a part |
| Sub-measure 1.1.3 | fingerprinting or logging (optional) | Not done: solo duels never leave the device (the privacy policy), and logging them would break that promise |
| Measure 1.2 | keep existing marks; forbid removing them in the system's documentation | This document is that documentation: whoever embeds, copies or redistributes the game's AI text keeps its mark, and must not remove or alter it. The game never reads AI input it would have to keep a mark on |
| Measure 1.3 | richer provenance (optional): system name, provider's name, a timestamp; "may also include the underlying AI model identifier and version number" | The model's name, repository, version and precision; not the provider's name or a timestamp. The page that shows the text names the game and its maker |
| Measure 1.4 | an option to add a perceptible label (optional) | Always on: the "AI" label (D-12) |
| Commitment 2 | a detection solution, free of charge: for example "a public, ideally standardised, specification allowing any third party to implement a detection mechanism" | The mark's format above is that specification, and `readAiGenerated()` reads it; `document.querySelectorAll('[data-ai-generated]')` finds every mark on a page. It is public only once this document (or its substance) is published: see below |

Section 2 of the Code (deployers, Article 50(4)) labels deep fakes and AI text "published with the
purpose of informing the public on matters of public interest". A game's verses and trivia are not
that, so it is not followed here beyond the label the owner chose anyway.

**Open:** the specification is in this repository, which is private. Commitment 2 asks for it to be
available to anyone who meets the content. Publishing it (for instance on `/credits`, which
`fix/compliance` owns) is left to that page's owner.

## What is not marked, and why

- **The player's own verses**, typed or spoken. Whisper turns speech into the player's words on the
  device: an assistive function that does not alter what the player said (the paragraph's own
  exception), and the text box shows it for the player to correct.
- **The judge's verdict.** A model's reading of two verses becomes points; it writes no content.
- **The written opponent's verses**: text shipped with the game, not generated in the session.
  The non-English banks were drafted with a model and checked by tools; `/credits` says so.
- **Card paintings and other assets made with AI before release**: static files, disclosed on
  `/credits` (`docs/ASSETS.md`). Whether paragraph 2 reaches them is a question for counsel.

## Shared or exported text

None exists today: `src/lib/social-share.ts` shares scores only and no page calls it, and no page
offers a verse or audio as a file. Any feature that shares or exports a model's verse must carry its
origin in the shared text itself ("Written by AI: Gemma 4 E2B, onnx-community/gemma-4-E2B-it-ONNX,
revision main, q4f16"), and in a file's metadata where the format has a place for it.

## Limits

An attribute is metadata of the page: text copied out of it leaves the mark behind. No watermark is
put into the words themselves; for verses of two to four lines from small models running in a browser,
no text watermark of known reliability was found, which is what "as far as technically feasible"
leaves open, and the Code of Practice asks none below 200 tokens (above). Review this when its threshold
falls below the length of a verse (it expects it to), or a standard names a method for short text.

## Tests

`src/lib/ai-marking.test.ts` (the mark, the session's record of the model, and the playground's markup:
every element that shows what a model may have written carries the mark, since no browser can reach those
screens while the playground loads no model), `tests/ai-marking.spec.ts` (the battle page and the Theatre,
with a stand-in model: the label in five interface languages, the mark, neither on the written opponent's
verse, the live region and that typing does not touch it, the label at the start of an English verse under an
Arabic or Japanese interface, and the voice setting on one line at phone width), `src/i18n/ai-label.test.ts`
(the word in sixteen languages).
