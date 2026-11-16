#!/usr/bin/env node
/**
 * Fetch Wikidata's labels and aliases for the people and characters the
 * interface names (not the card names, which stay English, and not
 * Shakespeare's lines): how each language writes them.
 *
 *   node scripts/lang/fetch-wikidata-names.mjs     writes docs/language/sources/wikidata-names.json
 *
 * Wikidata is CC0. The glossary (docs/language/glossary.json, terms
 * "shakespeare" and "mercutio") holds each language to the label, or says why
 * an alias was taken instead.
 */
import { writeFileSync } from 'node:fs';

const NAMES = { shakespeare: 'Q692', mercutio: 'Q1767900' };
// Our languages, and the script variants Wikidata keeps apart (Simplified Chinese, Brazilian Portuguese).
const LANGS = ['es', 'fr', 'de', 'it', 'pt', 'pt-br', 'pl', 'ru', 'ar', 'hi', 'zh', 'zh-hans', 'zh-cn', 'ja', 'ko', 'vi', 'th', 'id'];
const UA = 'language-qa-script/1.0 (terminology lookup)';

const url = 'https://www.wikidata.org/w/api.php?' + new URLSearchParams({ action: 'wbgetentities', ids: Object.values(NAMES).join('|'), props: 'labels|aliases|sitelinks', languages: LANGS.join('|'), format: 'json' });
const r = await fetch(url, { headers: { 'user-agent': UA } });
if (!r.ok) throw new Error(`${r.status} ${url}`);
const { entities } = await r.json();
const out = { source: 'Wikidata, wbgetentities (labels, aliases, sitelinks)', licence: 'CC0 1.0', fetched: new Date().toISOString(), names: {} };
for (const [id, qid] of Object.entries(NAMES)) {
  const e = entities[qid];
  const langs = {};
  for (const l of LANGS) {
    const wiki = e.sitelinks?.[`${l.replace('-', '_')}wiki`]?.title ?? null;
    langs[l] = { label: e.labels?.[l]?.value ?? null, aliases: (e.aliases?.[l] ?? []).map((a) => a.value), sitelink: wiki };
  }
  out.names[id] = { qid, english: e.labels?.en?.value ?? null, langs };
}
writeFileSync(new URL('../../docs/language/sources/wikidata-names.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
for (const [id, n] of Object.entries(out.names)) for (const [l, v] of Object.entries(n.langs)) console.log(`${id}\t${l}\t${v.label ?? '—'}\t${v.aliases.join(', ')}\t${v.sitelink ?? ''}`);
