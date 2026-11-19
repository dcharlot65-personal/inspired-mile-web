// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import thirdPartyNotices from './scripts/third-party-notices.mjs';
import selfHostedRuntime from './scripts/self-hosted-runtime.mjs';

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
  // thirdPartyNotices: the license notices of everything the build ships that others made, checked
  // against /credits (public/licenses/THIRD-PARTY-NOTICES.txt). No React integration: no page renders a
  // React component, and it only added React's client renderer to the build, which nothing loaded.
  integrations: [selfHostedRuntime(), thirdPartyNotices()],
  vite: {
    plugins: [tailwindcss()],
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
