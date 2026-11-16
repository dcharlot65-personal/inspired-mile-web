# In-browser AI for Sonnet Man: state of the art, November 2026

Research date: 2026-11-16. Web research only; nothing was run or measured by me.

**How to read this.** Every model name, size and number below comes from a page opened during this session, and the URL is given next to it. Three markers are used:

- **[V]** read on a primary source (model card, vendor docs, release notes, registry API) in this session.
- **[S]** read only on a secondary source (blog, news, search summary). Treat as a lead.
- **[U]** not verified in this session. Either from my prior knowledge or not found. Do not build on it without checking.

Engineering advice (sections 6 and parts of 7) is my judgement, not a sourced fact, and is labelled as such.

---

## 0. Short answer

- **Liquid AI shipped LFM3 on 2026-10-27.** `LFM3-1.7B` (1.73B parameters, 16 languages, 256K context) has an ONNX build that runs in Transformers.js 4.3.2 on WebGPU at `q4f16`. It is the best fit for the default "brain". [V]
- **Gemma 4 E2B is the only Gemma 4 size that is realistic in a browser tab.** It has builds for all three runtimes: ONNX (Transformers.js), MLC (WebLLM 0.2.86+) and `.litertlm` (LiteRT-LM JS). It is Apache 2.0 and is the widest-language option ("35+ languages out of the box, pre-trained on 140+"), but the download is 2.3 to 3.1 GB. [V]
- **Primary runtime: Transformers.js 4.3.2.** It is the only runtime that runs both Liquid and Gemma 4 models, plus Whisper. **Fallback: WebLLM 0.2.88**, already in the app, which has Gemma 4 E2B and the most mature JSON-schema constraint (XGrammar). [V]
- **"All languages" is not achievable in-browser today.** The honest claim is roughly: 16 languages well on the default model, a few dozen on Gemma 4 E2B (the list is not published), spoken output in 31, and speech input nominally in 99 with very uneven quality.
- **The current speech-to-text path breaks the "no cloud" rule.** The Web Speech API sends audio to a server by default. [V]
- **iPhones are the hard limit.** A Safari tab is killed at about 2 GB (1.5 GB in some states), and WebGPU buffers count against it. A 1.7B model does not fit reliably. [V, from bug reports]

---

## 1. LLMs

### 1.1 Liquid AI

**LFM3 family, announced 2026-10-27** (https://www.liquid.ai/blog/lfm3) [V]. Six models, all branched from `LFM3-1.7B-Base`:

| Model | Type | Notes |
|---|---|---|
| LFM3-1.7B | text | 1.73B params, 256K context, 16 languages |
| LFM3-VL-2B | vision | 1.9B |
| LFM3-Audio-2B | audio in/out | 18 languages, 32K context |
| LFM3-Omni-2B | vision + audio | 2.2B |
| d1-2B, d1-Omni-2B | "decision" models | answer typed questions with calibrated probabilities |

**LFM3-1.7B** (https://huggingface.co/LiquidAI/LFM3-1.7B) [V]:

- Languages (16): English, Arabic, Chinese, French, German, Italian, Japanese, Korean, Portuguese, Spanish, Vietnamese, Thai, Indonesian, Hindi, Russian, Polish.
- Licence: LFM Open License v1.0.
- Reasoning is on by default (the prompt ends with `<think>`). `enable_thinking=False` turns it off, "but the page says this can be inconsistent".
- Recommended sampling: temperature 0.1, top_k 50, repetition_penalty 1.1.
- Vendor benchmarks: IFEval 96.66, BFCL V4 71.39. "Structured outputs" is a listed intended use. The card says about 1 GB of memory at 4-bit.
- Not recommended by the vendor for complex multi-step reasoning.

**Browser builds of LFM3-1.7B** [V]:

- `onnx-community/LFM3-1.7B-ONNX` (https://huggingface.co/onnx-community/LFM3-1.7B-ONNX): Transformers.js sample, requires `@huggingface/transformers@^4.3.2`, `dtype: "q4f16"`, `device: "webgpu"`, with `tokenizer_encode_kwargs: { enable_thinking: false }`.
- `LiquidAI/LFM3-1.7B-ONNX` (https://huggingface.co/LiquidAI/LFM3-1.7B-ONNX): sizes q4f16 1.38 GB, q4 1.63 GB, q8f16 2.03 GB, fp16 3.59 GB. The card says to use `q4f16` on WebGPU, to import `onnxruntime-web/webgpu`, and to **prefill in chunks of at most 256 tokens**.
- A bug report gives the `model_q4f16.onnx_data` file of the onnx-community build as 1,087,789,056 bytes (https://github.com/huggingface/transformers.js/issues/1827).
- No MLC (WebLLM) build: there is no LFM entry in WebLLM's model list (https://raw.githubusercontent.com/mlc-ai/web-llm/main/src/config.ts).
- No in-browser tokens/s figure is published for LFM3. [U]

**LFM2.5 family (older; launched before 2026-04-01, with later additions)** [V for cards, U for dates]:

| Repo | WebGPU size | Languages tag |
|---|---|---|
| `LiquidAI/LFM2.5-350M-ONNX` | q4 about 276 MB | 10 (not listed) |
| `LiquidAI/LFM2.5-1.2B-Instruct-ONNX` | q4 about 1.2 GB (bug report: q4f16 data file 760,279,040 bytes) | 10 (not listed) |
| `LiquidAI/LFM2.5-2.6B-ONNX` | q4 about 1.9 GB, q4f16 about 1.5 GB | 16 (not listed) |
| `LiquidAI/LFM2.5-230M-ONNX`, `LFM2.5-8B-A1B-ONNX`, `LFM2.5-VL-3B-ONNX`, `LFM2.5-1.2B-JP-ONNX` | exist; not opened in detail | |

All cards say Q8 is not supported on WebGPU. Liquid's ONNX guide (https://docs.liquid.ai/deployment/on-device/onnx.md) confirms the prior finding: "ONNX models run in browsers through Transformers.js with WebGPU acceleration". It names only Chrome and Edge and still tells readers to enable a WebGPU flag.

**Licence terms that matter** (https://www.liquid.ai/lfm-license) [V]: Apache-2.0-based. Commercial use is free below USD 10 million annual revenue, counted across affiliated entities. Non-commercial and research use is not limited. No acceptable-use policy and nothing about children. Redistribution must carry the licence and notices. For a free educational game this is fine; the affiliate revenue clause is the one thing to keep in mind if the game is later tied to a larger company.

### 1.2 Gemma 4

Model card: https://ai.google.dev/gemma/docs/core/model_card_4 [V]

| Variant | Parameters | Context | Input | Browser-realistic? |
|---|---|---|---|---|
| E2B | 2.3B effective (5.1B with embeddings) | 128K | text, image, audio | Yes |
| E4B | 4.5B effective (8B with embeddings) | 128K | text, image, audio | Desktop only, heavy |
| 12B Unified | 11.95B | 256K | text, image, audio | No |
| 26B A4B (MoE) | 25.2B total, 3.8B active | 256K | text, image | No |
| 31B | 30.7B | 256K | text, image | No |

- Licence: Apache 2.0 [V]. The Hugging Face card has no separate prohibited-use policy and asks developers to "implement appropriate content safety safeguards" (https://huggingface.co/google/gemma-4-E2B-it).
- Languages: "Out-of-the-box support for 35+ languages, pre-trained on 140+ languages." **The 35 are not named on either card.** [V]
- Release date: not on the card. Secondary coverage puts the launch in April 2026 and the 12B on 2026-06-03 [S]. Transformers.js added Gemma 4 support in 4.0.1/4.1.0 on 23 April [V].
- Sampling: temperature 1.0, top_p 0.95, top_k 64. Thinking is off unless `<|think|>` is in the system prompt. Native system role. "Native support for structured tool use"; no explicit structured-output claim. [V]
- Quality signal for a judge: E2B scores MMLU Pro 60.0%, E4B 69.4%; multilingual MMMLU 67.4% and 76.6%. [V]
- Child-safety note: the card reports CSAM filtering of training data and "minimal policy violations" in evaluation. [V]

**Browser builds of Gemma 4 E2B** [V]:

| Runtime | Model ID | Size | Speed |
|---|---|---|---|
| Transformers.js | `onnx-community/gemma-4-E2B-it-ONNX`, class `Gemma4ForConditionalGeneration`, `dtype: "q4f16"` | decoder 1.52 GB + embeddings 1.59 GB = about 3.1 GB for text; audio encoder 171 MB and vision encoder 99 MB extra | none published |
| WebLLM 0.2.86+ | `gemma-4-E2B-it-q4f16_1-MLC` (also `q4f32_1`) | `vram_required_MB` 3387; download size not checked | none published |
| LiteRT-LM JS | `litert-community/gemma-4-E2B-it-litert-lm`, file `gemma-4-E2B-it-gpu.litertlm` | 2,341 MB, about 1.8 GB GPU memory | **73 tokens/s decode, 4,853 prefill, 1.09 s to first token on a MacBook Pro M4 Max, WebGPU** |

Sources: https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX/tree/main/onnx , https://github.com/mlc-ai/web-llm/releases , https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm

- `onnx-community/gemma-4-E2B-it-qat-mobile-ONNX` also exists (2-bit decoder layers, `q2f16` files). Its card has only a Python sample; browser use is unverified. [V/U]
- E4B: `onnx-community/gemma-4-E4B-it-ONNX` and `litert-community/gemma-4-E4B-it-litert-lm` exist [V]. WebLLM lists only E2B [V].
- One independent data point: the "Llamas on the Web" paper reports "the large gemma4 model reaches about ... 30 tok/s decode" on an RTX 5080 class machine; which Gemma 4 size is not clear from what I read. [V, partial]

### 1.3 Other small multilingual models

| Model | Status | Why it matters |
|---|---|---|
| Qwen3.5-2B (https://huggingface.co/Qwen/Qwen3.5-2B) | Apache 2.0, "201 languages and dialects", 262K context. In WebLLM as `Qwen3.5-2B-q4f16_1-MLC` (2,245 MB VRAM); 0.8B, 4B and 9B also listed. [V] | Widest claimed language list of any small model. **Older than the cutoff**: the citation says February 2026. The card warns the 2B "is more prone to entering thinking loops". |
| Tiny Aya (Cohere Labs) | "70+ languages", about 3B. [S] | Licence, browser build and date not verified. [U] |
| DeepSeek-V4, Zaya, HRM-Text | Architectures added in Transformers.js 4.3.0. [V] | I did not open their cards; sizes and languages unknown. [U] |
| Edge's Aion-1.0-Instruct | Prerelease built-in model in Edge Canary/Dev. [V] | Not usable in production. |

I found no other small multilingual model released after 2026-04-01 with a verified browser build.

---

## 2. Runtimes

Versions are from the npm registry API on 2026-11-16 [V].

| Runtime | Version (published) | Status |
|---|---|---|
| `@huggingface/transformers` | 4.3.2 (2026-10-27); `next` 4.4.0-next.0 | v4 has a C++ WebGPU runtime. 4.1 added Gemma 4. 4.2 added tool calling. 4.3.0 added experimental structured output and "Enable WebGPU for Safari 26 and above". 4.3.2 added LFM3 and LFM3-VL. |
| `@huggingface/transformers-structured-output` | 4.3.2 | "experimental, dependency-free". JSON schema, JSON object or regex through a `logits_processor`. One sequence at a time. |
| `onnxruntime-web` | 1.31.1 (2026-10-26); dev 1.33.0 | Underlies Transformers.js. Liquid's cards require the `onnxruntime-web/webgpu` import. |
| `@mlc-ai/web-llm` | 0.2.88 (2026-11-10) | 0.2.86 added Gemma 4 E2B with text and audio input. 0.2.85 added OPFS. 0.2.83 added cross-origin storage and integrity checks. XGrammar JSON-schema and structural-tag constraints. No Liquid models. |
| `@litert-lm/core` | 0.19.0 (2026-10-30) | Google's web LLM API. Loads `hf://litert-community/...`. Has `enableConstrainedDecoding`. Supported browsers not stated. |
| `@mediapipe/tasks-genai` | 0.10.30 (2026-10-25) | A search summary said the web guide calls it "maintenance-only" and points to LiteRT-LM JS. The pages I opened did not show that sentence. [S, conflicting] |
| `@wllama/wllama` | 3.13.0 (2026-11-08) | llama.cpp in the browser, any GGUF. WebGPU arrived in the 3.x line; Safari through `@wllama/wllama-compat`. 3.13 added ASR and TTS. |

Sources: https://github.com/huggingface/transformers.js/releases , https://github.com/mlc-ai/web-llm/releases , https://developers.google.com/edge/litert-lm/js , https://github.com/ngxson/wllama/releases

### Built-in browser AI

| Browser | State | Languages | Usable without flags? |
|---|---|---|---|
| Chrome Prompt API (Gemini Nano) | Stable for web pages from Chrome 148. Docs updated 2026-10-21. | en, ja, es, de, fr only | Yes, but desktop only: Windows 10/11, macOS 13+, Linux, Chromebook Plus. **Not Android, not iOS.** Needs 22 GB free disk, and either more than 4 GB VRAM or 16 GB RAM with 4 cores. Supports `responseConstraint` (JSON Schema or regex). |
| Chrome Translator and Language Detector | Stable from Chrome 138 | Translator: 39 language codes | Desktop only ("don't work on mobile devices"). Needs a user gesture. Not available in workers. |
| Chrome Summarizer | Stable from 138 | | Writer, Rewriter, Proofreader are still trials. |
| Edge Prompt API (Phi-4-mini) | "developer preview in the Microsoft Edge Canary and Edge Dev channels", behind a flag. Needs 5.5 GB VRAM. Docs updated 2026-10-19. | not stated | **No.** The Translator page's support badge shows Edge 148 for Translator. |
| Firefox | No built-in prompt API found. Mozilla formally opposed the Prompt API. [S] | | No. |
| Safari | No built-in prompt API found. WebKit also opposed. [S] | | No. |

Sources: https://developer.chrome.com/docs/ai/prompt-api , https://developer.chrome.com/docs/ai/built-in-apis , https://developer.chrome.com/docs/ai/translator-api , https://learn.microsoft.com/en-us/microsoft-edge/web-platform/prompt-api

### Recommendation

**Primary: Transformers.js 4.3.2.** It is the only runtime with verified builds of both owner-requested families (LFM3, LFM2.5 and Gemma 4 E2B), it also runs Whisper, and Liquid documents it as their browser path.

**Fallback: WebLLM 0.2.88**, for Gemma 4 E2B. It is already integrated, its JSON-schema constraint is not labelled experimental, and it gives a second implementation if a Transformers.js WebGPU bug blocks a device.

Costs to know about:

- In the one independent comparison I read (the May 2026 paper), Transformers.js decoded 69% slower than a llama.cpp WebGPU backend and WebLLM 54% slower, and Transformers.js leaked memory on Safari until the tab was killed (about 10 GB on an M4 Pro). That was measured before 4.3.x; whether it is fixed is unknown.
- LiteRT-LM JS has the only published in-browser Gemma 4 speed (73 tokens/s) and the smallest Gemma 4 file. It is worth a spike as the Gemma path if WebLLM disappoints, but its browser support matrix is undocumented.
- The Chrome Prompt API is on-device and needs no download from you, but it covers five languages on desktop Chrome only. Use it at most as an optional accelerator, never as the base.

---

## 3. Browsers and devices

### WebGPU availability

From https://github.com/gpuweb/gpuweb/wiki/Implementation-Status [V]:

| Browser | Shipped | Gaps |
|---|---|---|
| Chrome, Edge desktop | Mac, Windows x64, ChromeOS since 113 | Windows ARM64 behind a flag. Linux: Intel Gen12+ from 144, NVIDIA on Wayland from 147, the rest behind flags. |
| Chrome Android | ARM, Qualcomm, Intel GPUs on Android 12+ since 121; Imagination on Android 16+ since 139 | **Samsung Xclipse (Exynos) still in progress.** Other GPUs to be decided. |
| Safari | macOS 26, iOS 26, iPadOS 26, visionOS 26, on by default | Nothing earlier. |
| Firefox | Windows since 141; Apple Silicon Mac since 145 (macOS 26) and 147 (all) | Intel Mac and Linux Nightly only. Android behind a flag. |
| Quest Browser | Release notes show experimental WebGPU-in-WebXR work through 2026. [S] | Whether plain WebGPU is on by default is unverified. [U] |

### Measured performance

- **Firefox, re-checked and confirmed.** "Llamas on the Web" (UC Santa Cruz and Microsoft Research, arXiv 2605.20706, 2026-05-20): "on an Apple M3 the llama model with q4_k_m weights runs at ∼1 tok/s on Firefox, but ∼52 tok/s on Chrome". The model is Llama 3.2 1B, on their llama.cpp WebGPU backend. The authors dropped Firefox from the evaluation. This is one engine, six months ago; it has not been shown to hold for ONNX Runtime Web. (https://arxiv.org/html/2605.20706v1) [V]
- Same paper: phones and efficient GPUs decode at about 4 to 17 tokens/s and fit only the four smallest models tested; high-end desktop GPUs exceed 100 tokens/s on small models. Chrome's Dawn was "the highest and most stable". [V]
- Gemma 4 E2B: 73 tokens/s on an M4 Max in the browser (LiteRT-LM). [V]
- Transformers.js 4.2.0, Chrome 155, RTX 4070 (single-author blog, 2026-10-17): Llama 3.2 1B 55 to 64 tokens/s, SmolLM2 360M 63 to 67 tokens/s, cold load 7.5 to 27 s. (https://dev.to/mattbusel/run-an-llm-in-the-browser-webgpu-did-63-tokenss-wasm-did-16-24ob) [S]
- I found no measured in-browser numbers for Android Chrome, visionOS or Quest for these models. [U]

### No WebGPU

The same blog measured SmolLM2 360M on WASM at **1.6 to 1.7 tokens/s**, about 27 s per short reply. That run was single-threaded because the page was not cross-origin isolated. With COOP/COEP headers and threads it will be faster, by an amount I could not verify. [S/U]

Plan for it: a 360M model on WASM is too slow and too weak to judge. Devices without WebGPU should get a scripted opponent and a rule-based score, clearly labelled, not a degraded LLM.

### Phone memory

All from bug reports filed 2026-10-29 on an iPhone 16 Pro Max [V, single reporter]:

- Safari killed the tab with "exceeded mem limit: ActiveHard 2048 MB". Other reports cite about 1.5 GB. Apple documents no figure. (https://github.com/huggingface/transformers.js/issues/1827 , https://github.com/mlc-ai/web-llm/issues/753)
- WebGPU uploads count against the page. LFM3-1.7B put about 950 MB on the GPU and still exceeded the limit after a download workaround.
- Transformers.js holds a large `.onnx_data` file in memory about twice while caching it, which alone kills the tab. The reporter's workaround streams the file into OPFS. With it, LFM2.5-1.2B loads and generates, and "q4f16 models with up to about 0.8 GB of external data fit". The issue is open with no maintainer reply.
- A single prefill of about 900 tokens crashes Safari's GPU process on iOS. Feeding the prompt in 256-token chunks works. (https://github.com/microsoft/onnxruntime/issues/33753)
- WebLLM closed its iOS crash issue as "not planned": SmolLM2-135M works, a 3B model does not.

Consequence: on iPhone, budget for a model of about 0.3 to 0.8 GB, short prompts, and chunked prefill. Android memory limits were not verified. [U]

### Caching and storage

- Safari and iOS (https://webkit.org/blog/14403/updates-to-storage-policy/) [V]: an origin may use up to 60% of disk in a browser app, 15% in other apps' web views. Storage is best-effort and whole origins are evicted least-recently-used under pressure or after disuse. `navigator.storage.persist()` exists; it is granted on heuristics such as being a Home Screen web app. The page covers Cache API, IndexedDB and "File System"; it does not name OPFS.
- Chrome's quota rules were not re-checked this session. [U]
- Runtime support: WebLLM has OPFS (0.2.85) and cross-origin storage with integrity verification (0.2.83). Transformers.js and wllama support the experimental Cross-Origin Storage API. Transformers.js has `env.useWasmCache`. [V]
- Practical rules: call `persist()`, show `estimate()` before a multi-gigabyte download, handle `QuotaExceededError`, make downloads resumable, and expect iOS to evict.

---

## 4. Speech

### Text-to-speech

| Model | Languages | Size | Licence | Honest quality note |
|---|---|---|---|---|
| **Supertonic 3** (released 2026-04-29) | 31: en, ko, ja, ar, bg, cs, da, de, el, es, et, fi, fr, hi, hr, hu, id, it, lt, lv, nl, pl, pt, ro, ru, sk, sl, sv, tr, uk, vi | about 99M parameters; file size not stated | Model OpenRAIL-M, code MIT | Vendor charts only; no per-language numbers in text. Browser example uses `onnxruntime-web`, WebGPU or WASM. Voice count not stated. Repo is marked archived. |
| **Kokoro-82M v1.0** (2025-01-27; `kokoro-js` 1.2.1, 2025-05-03) | 8 nominal, 54 voices | 82M parameters | Apache 2.0 | **Older than the cutoff and not updated.** Good only in English (best voice graded A). The card's own grades: Japanese C, Hindi C, Italian C, Mandarin D, French one voice at B-. "Support for non-English languages may be absent or thin". |
| LFM3-Audio-2B | 18: ar, da, de, el, en, fi, fr, he, it, ja, ko, nl, pl, pt, es, sv, tr, zh | q4f16 2.09 GB | LFM Open License | Does speech in and out, but too large to load beside the LLM. Two voices ("female", "male"). English TTS UTMOSv2 3.83. |
| Chatterbox | about 23 [S] | about 1.5 GB [S] | MIT [S] | Architecture supported since Transformers.js 4.0.0 [V]; details unverified. |
| `speechSynthesis` (OS voices) | whatever the OS has | 0 | n/a | Free fallback. Whether a given voice is local or network-backed varies by browser. [U] |

Sources: https://huggingface.co/Supertone/supertonic-3 , https://github.com/supertone-inc/supertonic , https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md , https://huggingface.co/LiquidAI/LFM3-Audio-2B

Supertonic 3 is the best verified multilingual option. Read the OpenRAIL-M use restrictions in the model's LICENSE file before shipping to children; I did not open that file. [U]

### Speech-to-text

| Option | Languages | Notes |
|---|---|---|
| **Web Speech API (current)** | many | MDN: by default "Your audio is sent to a web service for recognition processing". **This is a cloud provider.** An on-device mode exists: `processLocally = true`, with `SpeechRecognition.available()` and `install()` for per-language packs. Per-browser support was not verified. (https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API) [V] |
| **Whisper** in Transformers.js | 99 nominal | MIT. `onnx-community/whisper-large-v3-turbo` exists (809M parameters, too heavy for phones). The card says "Our models perform unevenly across languages" and that it can output text that was not spoken. Smaller Whisper sizes are far weaker outside major languages. **Older than the cutoff** (2024). (https://huggingface.co/openai/whisper-large-v3-turbo) [V] |
| **Moonshine** | 10: English, Spanish, German, Mandarin, Japanese, Korean, Vietnamese, Tagalog, Ukrainian, Arabic | MIT for the current streaming models; older non-English models are non-commercial. The repo lists "JavaScript/WASM" support. The npm package `@moonshine-ai/moonshine-js` is 0.1.29 from July 2025, so the current browser route is unclear. (https://github.com/moonshine-ai/moonshine) [V/U] |
| **Gemma 4 E2B audio input** | not listed | The model accepts up to 30 s of audio. FLEURS error 0.09. WebLLM 0.2.86 says "text and audio input". On the Gemma tier, one model could transcribe and judge. Untested. [V/U] |
| LFM3-Audio-2B | 18 | FLEURS mean error 6.03% across nine major languages. Live ASR is English only. |

Realistic coverage: perhaps 10 to 20 languages transcribe well enough for verse on a model that fits in a browser; the rest of Whisper's 99 are nominal. Typing must stay a first-class input everywhere.

---

## 5. "All languages represented"

### What each model card supports

| Model | Stated languages | Evidence for verse or judging per language |
|---|---|---|
| LFM3-1.7B | 16, named | None. No per-language scores on the card. |
| Gemma 4 E2B | "35+" unnamed, "140+" pre-trained | Aggregate only: MMMLU 67.4%. No per-language table. |
| Qwen3.5-2B | "201 languages and dialects" | None on the card. |
| LFM2.5 small models | 10 or 16, unnamed on the ONNX cards | None. |

No card or independent evaluation I found measures poetry, rhyme, metre or rubric judging in any language for these models. Every "handles language X for verse" statement would be an inference from general multilingual scores. The game needs its own small evaluation set per launch language.

### Strategy

1. **Separate three things.** UI localisation is static text and can cover any language you can get translated. Verse generation and judging depend on the model. Speech depends on the TTS and STT lists. Publish each list honestly in the UI.
2. **Route by language.** If the verse language is one of LFM3's 16, use LFM3. Otherwise use Gemma 4 E2B where the device can hold it. Detect the language of the verse itself (Chrome's Language Detector API on desktop, or a small in-browser classifier elsewhere).
3. **Optional larger model for long-tail languages.** Offer Gemma 4 E2B as an opt-in download ("2.3 to 3.1 GB, better for more languages"). E4B is a desktop-only option beyond that.
4. **Translation as a bridge, used carefully.** Chrome's Translator API is free, on-device and covers 39 codes, but desktop Chrome only. `onnx-community/translategemma-text-4b-it-ONNX` exists with WebGPU demos [V], but it is a 4B model, and its language count (55 or 56) and licence were not verified [U]. NLLB-200 and MADLAD-400 are older; I found no verified successor with a browser build [U]. **Translating a poem destroys rhyme and metre**, so pivot translation can support judging of meaning and imagery only, never form. Say so in the score.
5. **Fallback for unsupported languages.** Let the player write in any language, mark the result "experimental language", and weight deterministic signals (line count, length, repetition) rather than pretend the model can judge.

### Gaps, plainly

- No in-browser model is verified for creative verse in low-resource languages: most African languages, most Indigenous languages, many South and Southeast Asian languages.
- Gemma 4's supported list is not published, so you cannot promise a specific language from the card.
- TTS tops out at 31 languages. STT that fits on a phone covers about 10 well.
- On iPhone the model that fits is the least multilingual one.
- Right-to-left and non-space-delimited scripts need their own UI and syllable handling; nothing in the models solves that.

---

## 6. A small in-browser model as judge

### Constrained JSON, per runtime

| Runtime | Mechanism | Maturity |
|---|---|---|
| WebLLM | XGrammar: JSON schema and structural tags. 0.2.85 fixed hangs on invalid constraints; 0.2.87 fixed schema generation for Qwen3.5. | Most mature [V] |
| Transformers.js | `StructuredOutputProcessor` from `@huggingface/transformers-structured-output`, passed as `logits_processor`, with `type: "json_schema"`. | "experimental" [V] |
| LiteRT-LM JS | `enableConstrainedDecoding: true` in the conversation config. Docs do not say what it constrains to. | Unclear [V] |
| Chrome and Edge Prompt API | `responseConstraint` with JSON Schema or regex. | Stable in Chrome [V] |
| wllama | llama.cpp grammars. | Not verified this session [U] |

A grammar guarantees the JSON parses and matches the schema. It does not make the numbers meaningful.

### Scoring noise and defences (my engineering judgement, not sourced)

- Turn thinking off, or strip it. LFM3's off switch "can be inconsistent", so constrain the output from the first token.
- Use greedy decoding or very low temperature for the judge. Use a separate, warmer call for the persona's verse.
- Use small integer scales (1 to 5) with enums. Small models cannot use a 0 to 100 scale consistently.
- **Score each verse in its own call with the same rubric.** Do not show both and ask for a comparison. This removes position bias and, more important, means one verse cannot tell the judge what to do to the other.
- The model wrote the opponent's verse, so expect self-preference. Independent scoring plus a fixed handicap or anchor examples helps.
- Put two or three scored anchor verses in the prompt per language, and run the judge two or three times and take the median if the device is fast enough.
- Blend in deterministic features (line count, length, repeated lines, banned words) so the result does not rest on the model alone.

### Prompt injection from the player's verse (my engineering judgement)

- Make the schema carry no free text: four integers and nothing else. An injected instruction then has no channel except the numbers.
- Clamp and sanity-check in code. Four maximum scores on a verse that contains "ignore", "system", "score" or similar is a signal to re-run or cap.
- Wrap the verse in clear delimiters, state that it is data, cap its length, and strip control and zero-width characters.
- Never let the judge's output drive anything but the four numbers. No tool calls, no HTML rendering of model text without escaping.
- Because everything runs on the player's device, **the player can always forge the score.** Treat client scores as untrusted for any shared leaderboard or reward. Injection only matters for honest play feeling fair.
- One data point: a hobby benchmark dropped 13 of 96 replies from small models, two for leaking their instructions. Expect to need an output filter. [S]

---

## 7. Auth

### Versions (crates.io and npm registry APIs, 2026-11-16) [V]

| Package | Version | Date |
|---|---|---|
| `webauthn-rs` | 0.6.2 (MPL-2.0) | 2026-10-31 |
| `axum` | 0.8.9 | 2026-04-14 |
| `tower-sessions` | 0.15.0 | 2026-02-01 |
| `resend-rs` | 0.36.1 | 2026-11-14 |
| `reqwest` | 0.13.5 | 2026-09-08 |
| `@simplewebauthn/browser` (client helper) | 14.0.0 | 2026-09-02 |

### Passkeys with webauthn-rs (https://docs.rs/webauthn-rs/latest/webauthn_rs/) [V]

- `WebauthnBuilder::new(rp_id, &rp_origin)` then `.build()`. Flow: `start_passkey_registration`, `finish_passkey_registration`, `start_passkey_authentication`, `finish_passkey_authentication`.
- The registration and authentication state "MUST be persisted on the server". Putting it in a client cookie allows replay. Keep it in a server-side session store and send only a session key. Serialising state needs the `danger-allow-state-serialisation` feature.
- The `conditional-ui` feature (passkey autofill) exists but the docs do not recommend it.
- What changed in 0.6 was not on the page I read. [U]

### Email sign-in through Resend [V]

- `POST https://api.resend.com/emails` with `Authorization: Bearer re_...` and JSON `from`, `to`, `subject`, and `html` or `text`. Optional `Idempotency-Key` header (256 characters maximum, valid 24 hours). Hosted templates through `template: { id, variables }`. Response is `{"id": "..."}`. (https://resend.com/docs/api-reference/emails/send-email)
- Free plan: 3,000 emails a month, 100 a day, 3 domains, 30-day retention. Pro is USD 20 a month for 50,000. (https://resend.com/pricing)
- You must verify a domain you own, and Resend recommends a subdomain such as `updates.example.com`. The page I read did not list the DNS records; expect SPF and DKIM records and add DMARC. [V for the requirement, U for the records]
- The 100-a-day cap is the real limit for sign-in codes.

### Combining them (common practice, my summary)

1. Sign-up: collect an email, send a one-time code, verify it, then immediately offer "create a passkey".
2. Sign-in: try the passkey first; offer "email me a code" as the fallback and as recovery.
3. Prefer a 6-digit code to a magic link, or make the link land on a page with a confirm button. Mail scanners pre-open links and consume single-use tokens.
4. Store codes hashed, single-use, about 10 minutes, with per-email and per-IP rate limits, and give the same response whether or not the address exists.
5. Allow several passkeys per account, and require a fresh email code before adding one.

### COPPA points for under-13s

I could not open the Federal Register text of the amended rule this session (the site blocked the fetch), so this paragraph is **[U]** and is not legal advice. The FTC's COPPA page links a rule text dated 2025-04-22 and a 2026-02-25 policy statement on age verification [V].

- An email address is personal information. Collecting one from a child to create an account generally needs verifiable parental consent first.
- A voice recording is personal information. Processing speech entirely in the browser and never uploading it avoids collecting it, which is one more reason to drop the default Web Speech API path.
- The simplest design for children: no account at all. Keep progress in local storage, or use a passkey with a random handle and no email. Screen names must not be real names.
- If there are accounts: neutral age screen, parent's email for consent, collect the minimum, a written retention policy, and no third-party analytics or ads on the child path.
- Sending a child's email address to Resend is a disclosure to a service provider; cover it in the privacy notice.
- Model licences reviewed here (Apache 2.0, LFM Open License) contain no rule about child users. Supertonic's OpenRAIL-M was not read.

---

## 8. Recommended stack

### Models

| Role | Model ID | Repo |
|---|---|---|
| Default brain | `onnx-community/LFM3-1.7B-ONNX`, `q4f16` | https://huggingface.co/onnx-community/LFM3-1.7B-ONNX |
| Wide-language brain (opt-in) | `gemma-4-E2B-it-q4f16_1-MLC` on WebLLM, or `onnx-community/gemma-4-E2B-it-ONNX` `q4f16` on Transformers.js | https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX |
| Gemma alternative to spike | `litert-community/gemma-4-E2B-it-litert-lm`, file `gemma-4-E2B-it-gpu.litertlm` | https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm |
| Phone brain | `LiquidAI/LFM2.5-1.2B-Instruct-ONNX` `q4f16`, or `LiquidAI/LFM2.5-350M-ONNX` `q4` | https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct-ONNX , https://huggingface.co/LiquidAI/LFM2.5-350M-ONNX |
| TTS, multilingual | Supertonic 3 on `onnxruntime-web` | https://huggingface.co/Supertone/supertonic-3 |
| TTS, English | Kokoro-82M through `kokoro-js` 1.2.1 (keep; older) | https://huggingface.co/hexgrad/Kokoro-82M |
| STT | Whisper through Transformers.js (older); Web Speech only with `processLocally = true` | https://huggingface.co/onnx-community/whisper-large-v3-turbo for desktop; a smaller Whisper for phones, repo not verified |

### Packages

- `@huggingface/transformers@4.3.2`
- `@huggingface/transformers-structured-output@4.3.2`
- `onnxruntime-web@1.31.1` (for Supertonic; Transformers.js brings its own)
- `@mlc-ai/web-llm@0.2.88` (upgrade from 0.2.80)
- `kokoro-js@1.2.1`
- Optional spike: `@litert-lm/core@0.19.0`
- Backend: `axum 0.8.9`, `webauthn-rs 0.6.2`, `tower-sessions 0.15.0`, `resend-rs 0.36.1` or plain `reqwest 0.13.5`

### Tiers

Decide the tier at start-up from `navigator.gpu`, the adapter, `navigator.deviceMemory` where present, the platform, and a short speed probe. Drop a tier if the probe is slow, which is how Firefox should be handled.

| Tier | Devices | Brain | Download |
|---|---|---|---|
| A, opt-in | Desktop Chrome, Edge, Safari 26 with a capable GPU and 8 GB or more | Gemma 4 E2B | 2.3 GB (LiteRT) to about 3.1 GB (ONNX text path) |
| B, default | Any desktop with WebGPU; strong Android phones on Chrome | LFM3-1.7B `q4f16` | about 1.1 to 1.4 GB |
| C | iPhone and iPad on iOS 26+, mid Android | LFM2.5-1.2B `q4f16` with OPFS streaming and 256-token prefill chunks, or LFM2.5-350M `q4` | about 0.73 GB, or about 0.28 GB |
| D | No WebGPU, Exynos Android, Linux Firefox, or a failed speed probe | No LLM: scripted opponent verses and rule-based scoring, labelled as such | 0 |

Speech adds Supertonic 3 (size unverified) or Kokoro, and a Whisper model, on top.

---

## 9. What I could not verify

- Any tokens/s figure for LFM3 or LFM2.5 in a browser, and any for Gemma 4 through Transformers.js or WebLLM.
- Whether Transformers.js downloads Gemma 4's audio and vision encoders for text-only use, and the real memory footprint of its 1.59 GB embedding file.
- Download size of the WebLLM Gemma 4 E2B build (only its 3,387 MB VRAM figure).
- The exact Gemma 4 release date and the names of its "35+" languages.
- The languages behind the "10 languages" and "16 languages" tags on LFM2.5 ONNX cards.
- Whether the Firefox slowdown still exists, and whether it affects ONNX Runtime Web.
- Whether the Transformers.js Safari memory leak reported in May 2026 is fixed.
- Android Chrome, visionOS and Quest performance and memory limits; whether Quest Browser ships WebGPU by default.
- The iOS memory figures beyond one reporter's logs; Apple publishes none.
- Chrome's storage quota rules; whether Safari's policy covers OPFS by name.
- WASM speed with threads enabled.
- Supertonic 3 file size, voice count, per-language quality and OpenRAIL-M restrictions.
- A current, maintained browser package for Moonshine.
- Sizes and repo names of small Whisper ONNX builds.
- TranslateGemma's language count and licence; any NLLB or MADLAD successor with a browser build.
- Tiny Aya's licence, date and browser build; the DeepSeek-V4, Zaya and HRM-Text models.
- Whether MediaPipe LLM Inference for web is officially in maintenance mode.
- The Chrome Translator page was last updated in May 2025; its 39-language list and Edge 148 badge may be stale.
- The amended COPPA rule's dates and text.
- Resend's exact DNS records and API rate limit.
- What changed in `webauthn-rs` 0.6.
- Any evaluation of verse writing or verse judging, in any language, for any of these models.
