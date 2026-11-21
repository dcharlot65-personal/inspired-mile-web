// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import selfHostedRuntime from './scripts/self-hosted-runtime.mjs';
import { fileURLToPath } from 'node:url';

// kokoro-js imports "phonemizer", an Emscripten build of eSpeak NG (GPL-3.0-or-later). The voice
// reads English itself (src/lib/voice/g2p-en.ts), so the package is swapped for a stub that
// throws, in the dev server and in the build; scripts/check-no-espeak.mjs (run by `npm run
// build`) fails the build if any of eSpeak NG reaches dist/ all the same.
const noEspeak = fileURLToPath(new URL('./src/lib/voice/no-espeak.ts', import.meta.url));

// Dev only: the pages call the API at /api on their own origin (in production Caddy
// forwards it), so the dev server forwards it too. Point API_PROXY_TARGET at another
// API when it is not on the default port.
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3849';

export default defineConfig({
  compressHTML: true,
  // Off: the browser tests run against the dev server, and the toolbar adds its own headings
  // and controls to every page, which production never has.
  devToolbar: { enabled: false },
  // selfHostedRuntime: the model runtime and 3D decoders come from this site, not a CDN.
  integrations: [react(), selfHostedRuntime()],
  vite: {
    plugins: [tailwindcss()],
    resolve: { alias: [{ find: /^phonemizer$/, replacement: noEspeak }] },
    // The Japanese analyser's source modules are CommonJS and are imported lazily (a Japanese
    // duel only). Naming them here lets the dev server prepare them at start-up instead of
    // reloading the page the first time one is asked for.
    optimizeDeps: { include: ['kuromoji/src/Tokenizer.js', 'kuromoji/src/dict/DynamicDictionaries.js'] },
    server: {
      proxy: {
        '/api': { target: apiTarget, changeOrigin: false, ws: true },
      },
    },
  },
});
