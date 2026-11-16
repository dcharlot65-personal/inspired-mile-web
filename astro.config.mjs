// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';

// Dev only: the pages call the API at /api on their own origin (in production Caddy
// forwards it), so the dev server forwards it too. Point API_PROXY_TARGET at another
// API when it is not on the default port.
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3849';

export default defineConfig({
  compressHTML: true,
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    server: {
      proxy: {
        '/api': { target: apiTarget, changeOrigin: false, ws: true },
      },
    },
  },
});
