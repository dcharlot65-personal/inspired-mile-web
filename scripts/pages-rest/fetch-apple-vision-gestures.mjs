#!/usr/bin/env node
// Apple's own words for the gesture that selects something on Apple Vision Pro, which the VR
// gallery's Vision Pro card describes ("Look at a card and pinch to select it"). The gesture is
// Apple's, so the source is Apple: the Apple Vision Pro User Guide, "Learn basic gestures and
// controls on Apple Vision Pro" (page tan1e2a29e00), table "Use eyes and hands to navigate
// visionOS" (subhead tanf0540d63d), its first row: the gesture's name, what it does, and the
// instruction ("Look at content (like an app icon or button), then tap your index finger and
// thumb together to select it."). Apple's English names it "tap"; developers call it a pinch.
//
//   node scripts/pages-rest/fetch-apple-vision-gestures.mjs
//     -> docs/language/sources/pages-rest-apple-vision-gestures.json
//
// A locale Apple does not publish the guide in is recorded as not found, never filled in.
// Apple's text is Apple's: quoted here as evidence of the term, not redistributed.
import { writeFileSync } from 'node:fs';

const LOCALES = { en: 'en-us', es: 'es-es', fr: 'fr-fr', de: 'de-de', it: 'it-it', pt: 'pt-br', pl: 'pl-pl', ru: 'ru-ru', ar: 'ar-ae', hi: 'hi-in', zh: 'zh-cn', ja: 'ja-jp', ko: 'ko-kr', vi: 'vi-vn', th: 'th-th', id: 'id-id' };
const PAGE = 'tan1e2a29e00';
const SUBHEAD = 'tanf0540d63d';
const NAMED = { nbsp: ' ', amp: '&', quot: '"', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', hellip: '…', ndash: '–', mdash: '—', lt: '<', gt: '>' };
const decode = (s) => s.replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&([a-zA-Z]+);/g, (w, n) => NAMED[n] ?? w);
const text = (html) => decode(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

const out = {
  source: `https://support.apple.com/<locale>/guide/apple-vision-pro/${PAGE}/visionos, table "Use eyes and hands to navigate visionOS", first row`,
  fetched: new Date().toISOString(),
  licence: 'Apple Inc. text, quoted as evidence of interface terms',
  pages: {},
};
for (const [lang, loc] of Object.entries(LOCALES)) {
  const url = `https://support.apple.com/${loc}/guide/apple-vision-pro/${PAGE}/visionos`;
  let r;
  // Apple answers 429 to a quick run of requests: wait and ask again.
  for (let attempt = 0; attempt < 4; attempt++) {
    r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' }, redirect: 'follow' });
    if (r.status !== 429) break;
    await new Promise((done) => setTimeout(done, 15000 * (attempt + 1)));
  }
  const html = r.ok ? await r.text() : '';
  const pageLocale = (/<body[^>]*\blang="([^"]+)"/.exec(html) ?? [])[1] ?? null;
  const start = html.indexOf(`id="${SUBHEAD}"`);
  const row = start < 0 ? null : /<tbody>\s*<tr>([\s\S]*?)<\/tr>/.exec(html.slice(start));
  const cells = row ? [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => text(m[1])) : [];
  // Apple serves its English page for a locale it has no guide in: that is not a translation.
  const isOwnLanguage = pageLocale !== null && (lang === 'en' || !pageLocale.startsWith('en'));
  if (!r.ok || cells.length < 3 || !isOwnLanguage) {
    out.pages[lang] = { url, finalUrl: r.url, status: r.status, pageLocale, found: false };
    console.log(lang, r.status, pageLocale, 'not found');
  } else {
    out.pages[lang] = { url, finalUrl: r.url, pageLocale, found: true, gesture: cells[0], purpose: cells[1], instruction: cells[2] };
    console.log(lang, pageLocale, '|', cells[0], '|', cells[2]);
  }
  await new Promise((done) => setTimeout(done, 3000));
}
writeFileSync(new URL('../../docs/language/sources/pages-rest-apple-vision-gestures.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
