# Assets: where every shipped file came from

What the site serves besides its code, where each file came from, how that was found out, and what is still
not known. Checked on 2026-11-19 against the repository, its git history, the owner's other repositories on
the dev Mac, the model library on the M4, and the original publications. The credits page
(`src/pages/credits.astro`, `/credits`) is what a visitor reads; this is the record behind it.
`src/lib/credits.test.ts` fails when a file of music, sound or 3D is added without a line here, or an image
folder's count changes.

**Open, for the owner**: the source and license of two music tracks, all fourteen sound effects, and the model
that made the 3D figure (sections 2, 3 and 4). Until they are known, the credits page says plainly that they
are not yet traced.

## 1. Music (`public/audio/music/`, 4 files)

All four came in the initial commit (`8adecfe0`, 2026-02-13), whose message names none of them. No script
in the repository made or fetched them. What was found, track by track:

| File | Plays | Source | License | How it was established |
|---|---|---|---|---|
| `battle-beat.mp3` (3,289,143 bytes, sha256 `6042399782e581d7…`) | solo duel | "Battle Theme A" by **cynicmusic** (The Cynic Project), [opengameart.org/content/battle-theme-a](https://opengameart.org/content/battle-theme-a), uploaded 2013-12-15 | **CC0 1.0**, as the page states on 2026-11-19. Attribution instructions on the page: "cynicmusic.com, pixelsphere.org". A 2013 comment there says the track was once CC-BY-SA 3.0 and the author changed it | The file's tags (title "Battle Theme A redone", artist "The Cynic Project", composer "cynicmusic.com") led to the page; the page's `battleThemeA.mp3`, downloaded 2026-11-19, is **byte-identical** (same sha256, `6042399782e581d753d616bc703e66483d5eccb5fb687a20c9a552d68c49e620`) |
| `landing-ambient.mp3` (4,755,625 bytes, sha256 `f8e31242051774cb…`) | home page | "Oldschool Horror Theme" by **EmoPreben**, [opengameart.org/content/oldschool-horror-theme](https://opengameart.org/content/oldschool-horror-theme), uploaded 2020-04-01 ("made using VST instruments in Mixcraft 7", "feel free to use it for whatever you feel like") | **CC0 1.0**, as the page states on 2026-11-19 | The tags (artist "Lasse Bührmann", title "Horror Theme 1", encoder "Mixcraft 7.7 32-Bit Bygget 316") and its length (3 min 18 s) matched that page; its `Horror.mp3` (served as `Horror_2.mp3`), downloaded 2026-11-19, is **byte-identical** (sha256 `f8e31242051774cbeecefcba44122c09c111ca485787b4245c23ac5dce25c86e`). That EmoPreben and Lasse Bührmann are one person is not established; the credit names both as found |
| `playground-ambient.mp3` (2,047,625 bytes, 127.9 s, 22.05 kHz mono) | playground | **not found** | **not known** | Its only metadata is FFmpeg's (`Lavf62.3.100`, `Lavc62.11`, LAME 3.100): it was re-encoded with FFmpeg 8.x before the initial commit, which wiped any earlier tags. (The design fact base gives it a "Logic Pro X, 2019-02-04" tag; that tag is in `battle-victory.wav`, below, not in this file.) |
| `collection-browse.mp3` (2,152,114 bytes, 134.4 s, 44.1 kHz stereo) | collection, world map | **not found** | **not known** | Same as above: FFmpeg 8.x tags only |

Nothing was changed in the two traced files. Search for the other two was by tags and text only; no audio
fingerprint search was made.

## 2. Sound effects (`public/audio/sfx/`, 14 files, all from the initial commit)

| File | Bytes | Seconds | sha256 (first 16) | Metadata |
|---|---|---|---|---|
| `battle-defeat.wav` | 44,182 | 0.50 | `3c8bd483d52b5b36` | FFmpeg (`ISFT Lavf62.3.100`) |
| `battle-victory.wav` | 785,082 | 4.45 | `e4bb5377bf9490ca` | Broadcast Wave `bext`: originator "Logic Pro X", date 2019-02-04 15:01:46; a cue labelled "Tempo: 115.0" |
| `card-flip.wav` | 88,278 | 0.50 | `81f1277ef9d5f4dc` | FFmpeg |
| `card-shimmer.wav` | 10,730 | 0.12 | `d820b0585dd7bc9c` | FFmpeg |
| `challenge-lose.wav` | 29,262 | 0.17 | `2ff5adefeb039c1c` | FFmpeg |
| `challenge-win.wav` | 43,332 | 0.49 | `dd3e57a72c24b502` | FFmpeg |
| `fanfare-common.wav` | 17,634 | 0.10 | `64976d01bb6e2fac` | FFmpeg |
| `fanfare-legendary.wav` | 46,120 | 0.52 | `7b47d9dda04ca6a6` | FFmpeg |
| `fanfare-rare.wav` | 31,976 | 0.36 | `66a7f0cbd5b0dfa3` | FFmpeg |
| `pack-open.wav` | 27,754 | 0.31 | `9260694040314a23` | FFmpeg |
| `trivia-correct.wav` | 47,618 | 0.54 | `7f3a008fdf20b4eb` | FFmpeg |
| `trivia-wrong.wav` | 18,510 | 0.10 | `8dcd7b001ea49edd` | FFmpeg |
| `ui-click.wav` | 706 | 0.01 | `4815ad3c87b84056` | FFmpeg |
| `ui-whoosh.wav` | 33,590 | 0.38 | `d7e66a789d465039` | FFmpeg |

**Source and license: not known for any of them.** No generator script, no commit message and no document
in this repository or `inspiredmile-web` names one. `card-flip` and `ui-whoosh` are preloaded but never
played (as-built design 7.3).

## 3. 3D (`public/models/`)

| File | What it is | Source |
|---|---|---|
| `sm-001.glb` (459,324 bytes, sha256 `4d1450ee466a0ec0…`) | glTF 2.0, one primitive in mode 0 (points): 16,384 coloured points, no mesh; generator "efficient-genai-optimizer" | **Made by the owner's own pipeline**, `efficient-genai` (`~/data-share/vibe-coding/efficient-genai` on the dev Mac). Its untracked script `scripts/optimize-for-web.py` writes exactly that generator string; it keeps the 16,384 most opaque splats of a frame (`--target`, default 16384) and writes a PLY and a points GLB. Its output `output/web-ready/SM-001_frame_0010.{glb,ply}`, written 2026-02-15 14:38, is **byte-identical** to the two shipped files (same sha256) |
| `splats/sm-001.ply` (917,865 bytes, sha256 `31e242d2aff437b0…`) | Gaussian splat, 16,384 splats (position, scale, rotation, DC colour, opacity) | as above |

They came into this repository in `49302d5d` (2026-02-16, "Fix all compiler warnings and audit issues"),
not in `99694234` as the design fact base says (`git log --diff-filter=A -- public/models`).

**Not known: the model that made the frames.** The source frames (`efficient-genai/output/sonnet-man/
SM-001_frame_0000…0039.ply`, 2026-02-15 08:10 to 08:21) hold 262,144 splats each, one per pixel of a 512×512
image, beside a 512×512 `_styled.ppm` image per frame. No code in efficient-genai's current tree writes those
file names. It has example image-to-3D generators for Apple SHARP (`examples/sharp_generate.rs`) and
TRELLIS (`examples/trellis_generate.rs`), and an SDXL img2img video style transfer
(`examples/video_style_transfer.rs`); which of them, if any, made these frames, and from which picture or
video, is not recorded. Each of those models has its own license, not checked here. Seventeen of the
eighteen GLBs `src/lib/ar-viewer.ts` names, and 52 of the 53 splats `/viewer` asks for, do not exist.

## 4. Images (`public/images/`)

- **`public/images/cards/` (71 files)**: every card's painting, made 2026-11-16 (commit `0566ca42`) with
  **FLUX 3 Image Klein** (Black Forest Labs; Hugging Face `black-forest-labs/flux-3-image-klein`) through
  mflux 0.24, by `scripts/art/gen_cards.py` from `scripts/art/prompts.json` (built by
  `scripts/art/build_prompts.py`), seed 7, 768×1024, WebP quality 88. Known flaws: `docs/CARD-ART.md`.
  **License: FLUX Kommunity License v1.0.** The text was read on 2026-11-19 from the weights' own
  `LICENSE.md` in the owner's model library on the M4
  (`/Volumes/macos_4tb_external_1/model_library/flux-3-image-klein/LICENSE.md`, sha256
  `100a3a5af8f1a2943dca0d127671bcaa93ad894a63330825219f1a0a44451f22`). What it says about the cards:
  - Section 2.a: commercial use of Outputs is licensed only to a **Qualifying User**, defined (1.e) as one
    whose gross annualized revenue, together with its affiliates', is **less than US$5,000,000**. This is a
    lower threshold than the LFM license's US$10M, and the owner's confirmation of 2026-11-17 was about the
    US$10M one.
  - Section 2.d: Black Forest Labs claims no ownership of Outputs.
  - Section 2.e: a Qualifying User must keep content filters, or have Output reviewed for unlawful or
    infringing content before it is distributed (each card was looked at: `docs/CARD-ART.md`), and must
    disclose that Output was generated with artificial intelligence "to the extent required under applicable
    law". The credits page says so.
  - Section 4.b's Attribution Notice is for distributing the model itself, which the game does not do.
- **`public/images/variants/` (198 files)**: city portraits of 17 cards, made 2026-02-14 (commit
  `58d168f7`) by `scripts/generate-variant-art.ts`, text to image, with **Z-Image Turbo** through the public
  Hugging Face Space `mcp-tools/Z-Image-Turbo` (Gradio API). The model, `Tongyi-MAI/Z-Image-Turbo`, is
  **Apache-2.0** by its card's metadata (read 2026-11-19); the Space also lists
  `CompVis/stable-diffusion-safety-checker`. No page shows these images (as-built design 7.2); 27 of them
  use city codes the catalogue no longer has.
- **Icons** (`favicon.svg`, `favicon.ico`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`,
  `apple-touch-icon.png`): the "IM" monogram, made in this repository (`8adecfe0`, `49302d5d`, `fc8d6cb3`). No
  outside source is recorded or suspected.

## 5. Fonts (`public/fonts/`, 12 woff2)

Inter, Playfair Display (regular and italic), JetBrains Mono, Outfit and Space Grotesk, Latin and Latin
Extended subsets, added in `49302d5d`. **All twelve files are byte-identical to what fonts.googleapis.com
served for them on 2026-11-19** (CSS2 API asked with a desktop Chrome user agent, each woff2 hashed;
JetBrains Mono at weights 400 to 500, as `fonts.css` declares). Each family is under the **SIL Open Font
License 1.1** (Google Fonts' `ofl/<family>/METADATA.pb`, `license: "OFL"`). Until 2026-11-19 no license
travelled with them; `public/fonts/OFL.txt` now does, with each family's copyright line from
`github.com/google/fonts` at commit `5bd87dfc525c8a0d1d8529d3684716e00c3fc59a`. Playfair Display has the
Reserved Font Name "Playfair Display"; the files are unmodified, so the name may be used.

## 6. Film

None. No video file is in `public/`, and no page embeds one. The films made with Kandinsky and LTX-2.5 belong
to the company site (`inspiredmile-web`), not to the game.

## 7. Code and data shipped from other projects

Listed on the credits page with their licenses; the records are `docs/language/PHONETICS.md` (sound tables),
`docs/language/NAMES-AND-QUOTATIONS.md` (card text), `docs/language/CONTENT-PROVENANCE.md` (play content),
`docs/language/PROVENANCE.md` (interface language) and `docs/MODEL-LICENCES.md` (models). Two findings of
this check:

- **The sound tables' license notices did not reach the site.** Every `src/lib/verse/sound/data/*.ts` states
  its source and CC BY-SA 4.0 in a `//` comment, which the build strips; the English table keeps CMU's and
  SCOWL's notices because they are part of the data string. The credits page is now the attribution and the
  share-alike statement for all of them (PHONETICS.md, "Licence consequence for shipping").
- **The mecab-ipadic notice did not travel with the dictionary.** `src/lib/verse/sound/ipadic/*.dat.gz` are
  binary cuts with no notice, and `scripts/sound/build-ipadic.mjs` adds none. The NAIST license asks that
  "any copy of this software, whether in its original form or modified, must include both the above copyright
  notice and the following paragraphs". `public/licenses/mecab-ipadic-NOTICE.txt` is kuromoji 0.1.2's own
  NOTICE.md section, copied unchanged (the npm tarball's sha512 matched `package-lock.json`).
- **eSpeak NG is in the voice's bundle.** `kokoro-js` 1.2.1 depends on `phonemizer` 1.2.1 ("Simple text to
  phones converter using eSpeak NG"), whose `dist/phonemizer.js` is Emscripten output carrying eSpeak NG's
  API and its `espeak-ng-data`. The package declares Apache-2.0 only; eSpeak NG's README says it "is released
  under the GPL version 3 or later". The site serves that chunk itself when a player turns the voice on. The
  credits page names eSpeak NG, its license and its source; whether that meets GPL-3.0's terms for conveying
  object code is the owner's question (section 6 of the GPL).
