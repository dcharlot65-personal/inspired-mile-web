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
script check that a command-line client cannot pass. Not checked here: whether a later amendment changed
paragraph 2's words, and the Commission's code of practice on marking AI-generated content.

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

**The version is not pinned.** `src/lib/brain.ts` names no revision, so Transformers.js downloads each
repository's `main`, and the mark says `revision=main`: it names the version as asked for, not the
exact commit. Pinning a commit in `brain.ts` (and the mark with it) would make it exact.

## Where

| AI output | Where it appears | Machine-readable | For the player |
|---|---|---|---|
| The opponent's verse, written by a model | battle page (`#opponent-verse`) | the mark on the verse | the label "AI" beside it, in the interface's language (`ai.label`) |
| The same, in the Theatre | a 3D stage drawn on a canvas, which holds no text a machine can read | the mark on a text copy of the verse beside the stage (`#theatre-opponent-verse`, which screen readers also read) | "AI · {model}" above the verse on the stage |
| Trivia questions and quote challenges a model wrote | the playground | the mark on the question, its answers and the quotation | the "AI Generated" badge (`pg.trivia.aiBadge`) |
| English speech (Kokoro-82M) | played in the page, never saved or offered as a file | none possible: no file leaves the page | the setting reads "AI voice" (`voice.*`) |

The label's word is Wikidata's for artificial intelligence (Q11660) in each language, its label or an
alias (`docs/language/sources/wikidata-Q11660.json`; `src/i18n/ai-label.test.ts`).

As built, no page that offers trivia loads a model (only the battle page and the Theatre do), so the
playground's model-written questions cannot appear today; they are marked for when they can.

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
leaves open. Review this when the code of practice or a standard names a method for short text.

## Tests

`src/lib/ai-marking.test.ts` (the mark, and the session's record of the model), `tests/ai-marking.spec.ts`
(the battle page and the Theatre, with a stand-in model: the label in five interface languages, the mark,
and neither on the written opponent's verse), `src/i18n/ai-label.test.ts` (the word in sixteen languages).
