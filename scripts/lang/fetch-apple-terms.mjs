#!/usr/bin/env node
/**
 * A second vendor's wording for "passkey" and "sign in": the opening sentence
 * of Apple's support article "About the security of passkeys" (102195) in each
 * language Apple publishes it in.
 *
 *   node scripts/lang/fetch-apple-terms.mjs     writes docs/language/sources/apple-passkeys.json
 *
 * Only the first sentence is kept, as evidence of the term in use, and, for a term the glossary
 * cites Apple for (TERMS), the first sentence that uses it: on 2026-11-16 the glossary called
 * サインイン "Apple's word" while the first sentence it had kept did not contain it. Apple's text
 * is Apple's; it is quoted here for terminology, not redistributed.
 */
import { writeFileSync } from 'node:fs';

const LOCALES = { en: 'en-us', es: 'es-es', fr: 'fr-fr', de: 'de-de', it: 'it-it', pt: 'pt-br', pl: 'pl-pl', ru: 'ru-ru', ar: 'ar-ae', hi: 'hi-in', zh: 'zh-cn', ja: 'ja-jp', ko: 'ko-kr', vi: 'vi-vn', th: 'th-th', id: 'id-id' };
// Terms the glossary cites Apple for, per language.
const TERMS = { ja: ['サインイン'] };
const NAMED = { ntilde: 'ñ', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', agrave: 'à', egrave: 'è', igrave: 'ì', ograve: 'ò', ugrave: 'ù', acirc: 'â', ecirc: 'ê', icirc: 'î', ocirc: 'ô', ucirc: 'û', atilde: 'ã', otilde: 'õ', ccedil: 'ç', auml: 'ä', ouml: 'ö', uuml: 'ü', szlig: 'ß', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', hellip: '…', ndash: '–', mdash: '—', nbsp: ' ', amp: '&', quot: '"', Eacute: 'É', Agrave: 'À' };
const decode = (s) => s.replace(/<[^>]+>/g, '').replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&([a-zA-Z]+);/g, (whole, n) => NAMED[n] ?? whole).trim();
const out = { source: 'https://support.apple.com/<locale>/102195', fetched: new Date().toISOString(), note: 'First sentence of the article body, as evidence of the vendor term. Where Apple has no translation the page is English and is recorded as such.', pages: {} };
for (const [lang, loc] of Object.entries(LOCALES)) {
  const url = `https://support.apple.com/${loc}/102195`;
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!r.ok) {
    out.pages[lang] = { url, status: r.status };
    continue;
  }
  const html = await r.text();
  const paras = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => decode(m[1])).filter((t) => t.length > 80 && !t.includes('{"props"'));
  const first = paras[0] ?? '';
  const sentence = first.split(/(?<=[.。؟])\s|(?<=。)/)[0].slice(0, 400);
  const sentences = paras.flatMap((p) => p.split(/(?<=[.。؟])\s|(?<=。)/));
  const termSentences = Object.fromEntries((TERMS[lang] ?? []).map((t) => [t, sentences.find((x) => x.includes(t))?.slice(0, 400) ?? null]));
  out.pages[lang] = { url, pageLocale: (html.match(/"locale":"([a-zA-Z_]+)"/) ?? [])[1] ?? null, firstSentence: sentence, ...(TERMS[lang] ? { termSentences } : {}) };
}
writeFileSync(new URL('../../docs/language/sources/apple-passkeys.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
for (const [l, p] of Object.entries(out.pages)) console.log(l, p.pageLocale, '|', (p.firstSentence ?? p.status + '').slice(0, 150));
