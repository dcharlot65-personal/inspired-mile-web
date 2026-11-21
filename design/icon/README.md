# The Sonnet Man icon

A quill and a microphone crossed like duelling blades: Shakespeare's pen against the rapper's mic,
the game's "duel of verses". The quill is ivory with a gold shaft and notched vane; the microphone
has a gold grille and a crimson handle; both lie on the game's obsidian card with a faint crimson
glow, in the site's own palette (`src/styles/global.css`: obsidian, gold, crimson). There is no text,
so nothing depends on a font, and it replaces the old "IM" monogram, which named the company rather
than the game.

Drawn by hand in this repository on 2026-11-20 as 64-unit SVG; no outside source, image or font.

| Master | Used for | Notes |
|---|---|---|
| `mark-small.svg` | the browser tab (`favicon.svg`) and `favicon.ico` (16, 32, 48 px) | no frame, the drawing enlarged so it reads at 16 px |
| `mark-full.svg` | app icons, 192 and 512 px | the same drawing on a rounded card with a thin gold frame |
| `mark-apple.svg` | the iOS home-screen icon, 180 px | square and opaque; iOS rounds the corners itself |
| `mark-maskable.svg` | Android's maskable icon, 512 px | full bleed, the drawing inside the central 80% safe circle |

To change the icon, edit these files and run `bash scripts/build-icons.sh`. It renders every size
into a new `public/icons/<UTC yyyymmddhhmmss>/` folder (changed files ship under a new name, the
owner's rule), moves every reference there (the `<link>`s in `src/layouts/BaseLayout.astro`,
`public/manifest.json`, the service worker's precache list in `public/sw.js` and its tests), keeps
the two previous folders, and refreshes `public/favicon.ico` and `public/apple-touch-icon.png`, the two
fixed paths browsers and iOS ask for by default. `src/lib/icons.test.ts` fails if any of that drifts.
It needs `rsvg-convert` (librsvg) and `python3`.
