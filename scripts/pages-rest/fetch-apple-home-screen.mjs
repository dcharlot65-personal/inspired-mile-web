#!/usr/bin/env node
// Apple's own words for the two iPhone controls the install guidance names: the Share
// button and "Add to Home Screen". They are labels of Apple's interface, so the source is
// Apple: the iPhone User Guide, "Bookmark a website", section "Add a website icon to your
// Home Screen" (task iph4f9a47bbc of page iph42ab2f3a7), in each language Apple publishes it.
//
//   node scripts/pages-rest/fetch-apple-home-screen.mjs
//     -> docs/language/sources/pages-rest-apple-home-screen.json
//
// Kept per language: the page's own locale, the alt text Apple gives the Share button's
// icon, and the steps of that section as text. The label itself is read out of the steps
// by the longest stretch the two sentences of step 4 share ("…then tap Add to Home Screen.
// If you don't see Add to Home Screen…"); `label` is that stretch, for a person to confirm.
// Apple's text is Apple's: quoted here as evidence of the term, not redistributed.
import { writeFileSync } from 'node:fs';

const LOCALES = { en: 'en-us', es: 'es-es', fr: 'fr-fr', de: 'de-de', it: 'it-it', pt: 'pt-br', pl: 'pl-pl', ru: 'ru-ru', ar: 'ar-ae', hi: 'hi-in', zh: 'zh-cn', ja: 'ja-jp', ko: 'ko-kr', vi: 'vi-vn', th: 'th-th', id: 'id-id' };
const TASK = 'iph4f9a47bbc';
const NAMED = { nbsp: ' ', amp: '&', quot: '"', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', hellip: '…', ndash: '–', mdash: '—', lt: '<', gt: '>' };
const decode = (s) => s.replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&([a-zA-Z]+);/g, (w, n) => NAMED[n] ?? w);
const text = (html) => decode(html.replace(/<img[^>]*alt="([^"]*)"[^>]*>/g, ' [$1] ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

/** The longest run of characters two strings share (on word edges where the script has spaces). */
function shared(a, b) {
  let best = '';
  for (let i = 0; i < a.length; i++) {
    for (let j = i + best.length + 1; j <= a.length; j++) {
      if (b.includes(a.slice(i, j))) best = a.slice(i, j);
      else break;
    }
  }
  return best.trim().replace(/^[\s,.:;，。、「」“”"']+|[\s,.:;，。、「」“”"']+$/g, '');
}

const out = { source: 'https://support.apple.com/<locale>/guide/iphone/iph42ab2f3a7/ios, section "Add a website icon to your Home Screen"', fetched: new Date().toISOString(), licence: 'Apple Inc. text, quoted as evidence of interface terms', pages: {} };
for (const [lang, loc] of Object.entries(LOCALES)) {
  const url = `https://support.apple.com/${loc}/guide/iphone/iph42ab2f3a7/ios`;
  let r;
  // Apple answers 429 to a quick run of requests: wait and ask again.
  for (let attempt = 0; attempt < 4; attempt++) {
    r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' }, redirect: 'follow' });
    if (r.status !== 429) break;
    await new Promise((done) => setTimeout(done, 15000 * (attempt + 1)));
  }
  const html = r.ok ? await r.text() : '';
  const start = html.indexOf(`id="${TASK}"`);
  if (!r.ok || start < 0) {
    out.pages[lang] = { url, status: r.status, found: false };
    console.log(lang, r.status, 'section not found');
    continue;
  }
  const end = html.indexOf('class="Outro"', start);
  const section = html.slice(start, end > start ? end : start + 6000);
  const heading = text((/<h2[^>]*>([\s\S]*?)<\/h2>/.exec(section) ?? [])[1] ?? '');
  const steps = [...section.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => [...m[1].matchAll(/<p>([\s\S]*?)<\/p>/g)].map((p) => text(p[1])));
  const shareAlt = (/<img[^>]*alt="([^"]+)"[^>]*>/.exec(section.slice(section.indexOf('<ol>'))) ? [...section.matchAll(/<img[^>]*alt="([^"]+)"[^>]*>/g)].map((m) => decode(m[1])) : []);
  const step4 = steps[3] ?? [];
  out.pages[lang] = {
    url,
    finalUrl: r.url,
    pageLocale: (html.match(/<html[^>]*lang="([^"]+)"/) ?? [])[1] ?? null,
    heading,
    iconAlts: shareAlt,
    steps,
    label: step4.length >= 2 ? shared(step4[0], step4[1]) : null,
  };
  await new Promise((done) => setTimeout(done, 3000));
  console.log(lang, out.pages[lang].pageLocale, '|', heading, '|', shareAlt.join(' / '), '|', out.pages[lang].label);
}
writeFileSync(new URL('../../docs/language/sources/pages-rest-apple-home-screen.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
