#!/usr/bin/env node
/**
 * Fetch how each language names artificial intelligence (Wikidata Q11660): the title of that
 * language's Wikipedia article (the sitelink), Wikidata's label and its aliases, with the item's
 * revision.
 *
 *   node scripts/lang/fetch-wikidata-ai.mjs     writes docs/language/sources/wikidata-ai.json
 *
 * The notice before a duel (notice.* in src/i18n/locales, EU AI Act Article 50) names artificial
 * intelligence in words the player knows; src/lib/ai-notice.test.ts holds every language's notice
 * to the Wikipedia title kept here (or the label or an alias, where the string says which).
 * Wikidata is CC0.
 */
import { writeFileSync } from 'node:fs';

const QID = 'Q11660';
// Our languages, and the variants Wikidata keeps apart (Simplified Chinese, Brazilian Portuguese).
const LANGS = ['en', 'es', 'fr', 'de', 'it', 'pt', 'pt-br', 'pl', 'ru', 'ar', 'hi', 'zh', 'zh-hans', 'ja', 'ko', 'vi', 'th', 'id'];
const WIKIS = ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ar', 'hi', 'zh', 'ja', 'ko', 'vi', 'th', 'id'];
const UA = 'language-qa-script/1.0 (terminology lookup)';

const url = 'https://www.wikidata.org/w/api.php?' + new URLSearchParams({
  action: 'wbgetentities', ids: QID, props: 'labels|aliases|sitelinks|info', languages: LANGS.join('|'),
  sitefilter: WIKIS.map((w) => `${w}wiki`).join('|'), format: 'json',
});
const r = await fetch(url, { headers: { 'user-agent': UA } });
if (!r.ok) throw new Error(`${r.status} ${url}`);
const e = (await r.json()).entities[QID];
const langs = {};
for (const l of LANGS) {
  const wiki = WIKIS.includes(l) ? e.sitelinks?.[`${l}wiki`] : undefined;
  langs[l] = { label: e.labels?.[l]?.value ?? null, aliases: (e.aliases?.[l] ?? []).map((a) => a.value), sitelink: wiki?.title ?? null, badges: wiki?.badges ?? [] };
}
const out = {
  source: `Wikidata, wbgetentities ${QID} (labels, aliases, sitelinks)`,
  licence: 'CC0 1.0',
  fetched: new Date().toISOString(),
  qid: QID,
  revision: e.lastrevid,
  modified: e.modified,
  langs,
};
writeFileSync(new URL('../../docs/language/sources/wikidata-ai.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
for (const [l, v] of Object.entries(langs)) console.log(`${l}\t${v.sitelink ?? '—'}\t${v.label ?? '—'}\t${v.aliases.join(', ')}`);
