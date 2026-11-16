#!/usr/bin/env node
// How Apple's Arabic pages join the conjunction و ("and") to a product name in Latin letters:
// attached (وiPad) or with a space (و iPad). Standard Arabic writes و as a prefix of the next
// word; with a Latin word publishers differ, so the page areas follow one publisher that writes
// a great deal of it: Apple. Kept per page: the count of each way and a few examples.
//
//   node scripts/pages-rest/fetch-apple-arabic-wa.mjs
//     -> docs/language/sources/pages-rest-apple-arabic-wa.json
//
// Apple's text is Apple's: quoted here as evidence of the usage, not redistributed.
import { writeFileSync } from 'node:fs';

const PAGES = [
  'https://www.apple.com/ae-ar/icloud/',
  'https://www.apple.com/ae-ar/airpods/',
  'https://www.apple.com/ae-ar/apple-vision-pro/',
  'https://support.apple.com/ar-ae/guide/apple-vision-pro/tan1e2a29e00/visionos',
  'https://support.apple.com/ar-ae/guide/iphone/iph42ab2f3a7/ios',
];
const NAMED = { nbsp: ' ', amp: '&', quot: '"', lt: '<', gt: '>' };
const decode = (s) => s.replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&([a-zA-Z]+);/g, (w, n) => NAMED[n] ?? w);

const out = { source: 'Apple Arabic web pages, text with markup removed', fetched: new Date().toISOString(), licence: 'Apple Inc. text, quoted as evidence of usage', pages: {}, total: { attached: 0, spaced: 0 } };
for (const url of PAGES) {
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' }, redirect: 'follow' });
  const html = r.ok ? await r.text() : '';
  const text = decode(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
  // و that begins a word (after a space or at the start), then a Latin letter: attached, or after one space.
  const attached = [...text.matchAll(/(?:^|\s)(و[A-Za-z][\w.-]*)/g)].map((m) => m[1]);
  const spaced = [...text.matchAll(/(?:^|\s)(و[  ][A-Za-z][\w.-]*)/g)].map((m) => m[1]);
  out.pages[url] = { status: r.status, attached: attached.length, spaced: spaced.length, examplesAttached: [...new Set(attached)].slice(0, 8), examplesSpaced: [...new Set(spaced)].slice(0, 8) };
  out.total.attached += attached.length;
  out.total.spaced += spaced.length;
  console.log(url, r.status, 'attached', attached.length, 'spaced', spaced.length);
  await new Promise((done) => setTimeout(done, 2000));
}
console.log('total', out.total);
writeFileSync(new URL('../../docs/language/sources/pages-rest-apple-arabic-wa.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
