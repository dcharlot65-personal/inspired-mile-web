#!/usr/bin/env node
/**
 * Google's own localised help pages, as evidence for a platform term: the
 * page title and first heading of each, in each language of the game.
 *
 *   node scripts/lang/fetch-google-help.mjs     writes docs/language/sources/google-help.json
 *
 * Used for "sign out" and "sign in", where Mozilla (fetch-mozilla-terms.mjs), Android and the game
 * disagreed in some languages. © Google; a title and a heading quoted per
 * language as evidence of a term.
 */
import { writeFileSync } from 'node:fs';

// our language -> Google's hl parameter
const HL = { en: 'en', es: 'es', fr: 'fr', de: 'de', it: 'it', pt: 'pt-BR', pl: 'pl', ru: 'ru', ar: 'ar', hi: 'hi', zh: 'zh-Hans', ja: 'ja', ko: 'ko', vi: 'vi', th: 'th', id: 'id' };
const PAGES = { 'sign-out': 'https://support.google.com/mail/answer/8154', 'sign-in': 'https://support.google.com/mail/answer/8494' };
const decode = (s) => s.replace(/<[^>]+>/g, '').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

const out = { source: 'Google Help Center pages, ?hl=<language>', licence: '© Google; a page title and a heading quoted per language as evidence of a term', fetched: new Date().toISOString(), hl: HL, pages: {} };
for (const [concept, url] of Object.entries(PAGES)) {
  out.pages[concept] = { url, text: {} };
  for (const [lang, hl] of Object.entries(HL)) {
    const r = await fetch(`${url}?hl=${hl}`, { headers: { 'user-agent': 'Mozilla/5.0 (language-qa-script/1.0)' } });
    if (!r.ok) throw new Error(`${r.status} ${url}?hl=${hl}`);
    const html = await r.text();
    const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1];
    const h2 = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1];
    out.pages[concept].text[lang] = { title: title ? decode(title) : null, heading: h2 ? decode(h2) : null };
  }
}
writeFileSync(new URL('../../docs/language/sources/google-help.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
for (const [c, p] of Object.entries(out.pages)) for (const [l, t] of Object.entries(p.text)) console.log(`${c}\t${l}\t${t.heading}\t| ${t.title}`);
