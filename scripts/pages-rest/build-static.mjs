// The two static files that cannot ask the i18n runtime for their words, written from the
// "shared" page area (src/i18n/pages/shared/<locale>.ts):
//
//   public/offline.html    the page the service worker shows when there is no network. It
//                          is served alone, with no bundle to import, so it carries its
//                          sixteen languages inside itself.
//   public/manifest.json   the app's name, its description and each shortcut's name per
//                          language (the *_localized members of the Web App Manifest; Chrome
//                          and Edge from 148; a shortcut carries its own name_localized). Only
//                          those members and "lang" are touched; the rest of the file is
//                          whoever last edited it, and its English must match the area's.
//
//   node scripts/pages-rest/build-static.mjs           write both files
//   node scripts/pages-rest/build-static.mjs --check   exit 1 if either is out of date
//
// Run it after changing a string in the shared area. src/i18n/pages-rest.test.ts fails
// while the files on disk differ from what this would write.
//
// Needs Node 23.6 or later: it imports the locale modules as they are (.ts, types stripped).
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const LOCALES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ar', 'hi', 'zh', 'ja', 'ko', 'vi', 'th', 'id'];
const RTL = ['ar'];
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** What the offline page says, and which key each piece comes from. */
export const OFFLINE_KEYS = {
  pageTitle: 'offline.pageTitle',
  title: 'offline.title',
  body: 'offline.body',
  available: 'offline.available',
  home: 'offline.link.home',
  collection: 'offline.link.collection',
  battle: 'offline.link.battle',
  retry: 'offline.retry',
};

export async function loadShared() {
  const all = {};
  for (const l of LOCALES) {
    all[l] = (await import(path.join(ROOT, 'src/i18n/pages/shared', `${l}.ts`))).default;
  }
  return all;
}

const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** The offline page. `shared` is { locale: messages }. */
export function renderOffline(shared) {
  const table = {};
  for (const l of LOCALES) {
    table[l] = {};
    for (const [name, key] of Object.entries(OFFLINE_KEYS)) {
      const value = shared[l]?.[key];
      if (typeof value !== 'string' || !value.trim()) throw new Error(`${l}: no "${key}" for the offline page`);
      table[l][name] = value;
    }
  }
  const en = table.en;
  // Inside <script>: no "<" may survive as written, or a "</script>" in a message would end the block.
  const json = JSON.stringify(table).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<!-- Written by scripts/pages-rest/build-static.mjs from src/i18n/pages/shared. Edit the strings there, not here. -->
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(en.pageTitle)} — Inspired Mile</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', sans-serif;
      background: #0a0a0f;
      color: #a0a0b0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 2rem;
    }
    .container { max-width: 400px; width: 100%; overflow-wrap: anywhere; }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 {
      font-size: 1.5rem;
      color: #e0e0f0;
      margin-bottom: 0.5rem;
      font-weight: 700;
    }
    p { line-height: 1.6; margin-bottom: 1rem; font-size: 0.9rem; }
    .available {
      background: rgba(212, 175, 55, 0.08);
      border: 1px solid rgba(212, 175, 55, 0.2);
      border-radius: 12px;
      padding: 1rem;
      margin-top: 1.5rem;
    }
    .available h2 {
      font-size: 0.75rem;
      color: rgba(212, 175, 55, 0.7);
      margin-bottom: 0.5rem;
    }
    /* Capitals and wide spacing suit the scripts that have capitals; they break the ones whose letters join. */
    html:lang(en) .available h2, html:lang(es) .available h2, html:lang(fr) .available h2, html:lang(de) .available h2,
    html:lang(it) .available h2, html:lang(pt) .available h2, html:lang(pl) .available h2, html:lang(ru) .available h2,
    html:lang(vi) .available h2, html:lang(id) .available h2 { text-transform: uppercase; letter-spacing: 0.05em; }
    .available ul { list-style: none; font-size: 0.85rem; }
    .available li { padding: 0.25rem 0; }
    .available a { color: rgba(212, 175, 55, 0.9); text-decoration: none; }
    .retry-btn {
      display: inline-block;
      margin-top: 1.5rem;
      padding: 0.6rem 1.5rem;
      background: rgba(212, 175, 55, 0.15);
      border: 1px solid rgba(212, 175, 55, 0.3);
      border-radius: 8px;
      color: rgba(212, 175, 55, 0.9);
      font-size: 0.85rem;
      cursor: pointer;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon" aria-hidden="true">&#9889;</div>
    <h1 data-k="title">${escapeHtml(en.title)}</h1>
    <p data-k="body">${escapeHtml(en.body)}</p>
    <div class="available">
      <h2 data-k="available">${escapeHtml(en.available)}</h2>
      <ul>
        <li><a href="/" data-k="home">${escapeHtml(en.home)}</a></li>
        <li><a href="/collection" data-k="collection">${escapeHtml(en.collection)}</a></li>
        <li><a href="/battle" data-k="battle">${escapeHtml(en.battle)}</a></li>
      </ul>
    </div>
    <a href="/" class="retry-btn" id="retry" data-k="retry">${escapeHtml(en.retry)}</a>
  </div>
  <script>
    // The language the player chose on the site, else the browser's first language that we have, else English.
    (function () {
      var M = ${json};
      var RTL = ${JSON.stringify(RTL)};
      function pick() {
        var stored = null;
        try { stored = localStorage.getItem('inspired-mile-locale'); } catch (e) { /* no storage: ask the browser */ }
        if (stored && M[stored]) return stored;
        var asked = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'];
        for (var i = 0; i < asked.length; i++) {
          var base = String(asked[i]).toLowerCase().split('-')[0];
          if (M[base]) return base;
        }
        return 'en';
      }
      var locale = pick();
      var m = M[locale];
      document.documentElement.lang = locale;
      document.documentElement.dir = RTL.indexOf(locale) >= 0 ? 'rtl' : 'ltr';
      document.title = m.pageTitle + ' — Inspired Mile';
      var nodes = document.querySelectorAll('[data-k]');
      for (var j = 0; j < nodes.length; j++) {
        var text = m[nodes[j].getAttribute('data-k')];
        if (text) nodes[j].textContent = text;
      }
      document.getElementById('retry').addEventListener('click', function (event) {
        event.preventDefault();
        location.reload();
      });
    })();
  </script>
</body>
</html>
`;
}

/** The manifest with its per-language name and description brought up to date. Other members are left as they are. */
/** Which key of the shared area names each shortcut of the manifest, by the shortcut's url. */
export const SHORTCUT_KEYS = { '/battle': 'app.shortcut.battle', '/theatre': 'app.shortcut.theatre' };

/** One member's translations, the English left out (it is the member itself). */
function translations(shared, key) {
  const out = {};
  for (const l of LOCALES) {
    const value = shared[l]?.[key];
    if (typeof value !== 'string' || !value.trim()) throw new Error(`${l}: no "${key}" for the manifest`);
    if (l !== 'en') out[l] = value;
  }
  return out;
}

/** Copy `obj`, putting `<member>_localized` straight after `<member>` and dropping any old one. */
function besides(obj, member, localized) {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === `${member}_localized` || (member === 'name' && key === 'lang' && localized.lang)) continue;
    out[key] = value;
    if (key === member) {
      if (localized.lang) out.lang = localized.lang;
      out[`${member}_localized`] = localized.values;
    }
  }
  return out;
}

/**
 * The manifest with the app's name, its description and each shortcut's name in every
 * language. The English stays the file's own: the shared area's English must say the
 * same, or its translations are of words the manifest no longer has.
 */
export function localiseManifest(manifestText, shared) {
  let manifest = JSON.parse(manifestText);
  const en = shared.en ?? {};
  const same = (member, key, english) => {
    if (en[key] !== english) throw new Error(`manifest ${member} is "${english}" but the shared area's ${key} is "${en[key]}": translate the new English first`);
  };
  if (typeof manifest.name !== 'string' || typeof manifest.description !== 'string') {
    throw new Error('manifest.json must have "name" and "description" for their translations to sit beside');
  }
  same('name', 'app.name', manifest.name);
  same('description', 'app.description', manifest.description);
  manifest = besides(manifest, 'name', { lang: 'en', values: translations(shared, 'app.name') });
  manifest = besides(manifest, 'description', { values: translations(shared, 'app.description') });
  if (Array.isArray(manifest.shortcuts)) {
    manifest.shortcuts = manifest.shortcuts.map((shortcut) => {
      const key = SHORTCUT_KEYS[shortcut.url];
      if (!key) throw new Error(`manifest shortcut ${shortcut.url} has no key in SHORTCUT_KEYS, so its name has no translations`);
      same(`shortcut ${shortcut.url}`, key, shortcut.name);
      return besides(shortcut, 'name', { values: translations(shared, key) });
    });
  }
  return JSON.stringify(manifest, null, 2) + '\n';
}

async function main() {
  const check = process.argv.includes('--check');
  const shared = await loadShared();
  const targets = [
    ['public/offline.html', async () => renderOffline(shared)],
    ['public/manifest.json', async (current) => localiseManifest(current, shared)],
  ];
  let stale = 0;
  for (const [file, build] of targets) {
    const full = path.join(ROOT, file);
    const current = await readFile(full, 'utf8');
    const wanted = await build(current);
    if (current === wanted) continue;
    if (check) {
      console.error(`${file} is out of date: run node scripts/pages-rest/build-static.mjs`);
      stale++;
    } else {
      await writeFile(full, wanted);
      console.log(`wrote ${file}`);
    }
  }
  if (stale) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
