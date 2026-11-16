#!/usr/bin/env node
/**
 * Fetch Mozilla's shipped translations of "Sign out" (the Firefox account menu
 * and its confirmation button), a platform term the Android strings fetched by
 * fetch-platform-terms.mjs do not carry.
 *
 *   node scripts/lang/fetch-mozilla-terms.mjs     writes docs/language/sources/mozilla-terms.json
 *
 * Source: github.com/mozilla-l10n/firefox-l10n at a pinned commit, file
 * <locale>/browser/browser/sync.ftl (Mozilla Public License 2.0); the English
 * from Firefox's own source, browser/locales/en-US/browser/sync.ftl.
 */
import { writeFileSync } from 'node:fs';

const COMMIT = 'bb61adaeeaefe5db067571d42d0eb7a1c2309b1a';
const L10N = `https://raw.githubusercontent.com/mozilla-l10n/firefox-l10n/${COMMIT}`;
const EN = 'https://raw.githubusercontent.com/mozilla-firefox/firefox/main/browser/locales/en-US/browser/sync.ftl';
// our language -> Mozilla's locale
const LOCALES = { es: 'es-ES', fr: 'fr', de: 'de', it: 'it', pt: 'pt-BR', pl: 'pl', ru: 'ru', ar: 'ar', hi: 'hi-IN', zh: 'zh-CN', ja: 'ja', ko: 'ko', vi: 'vi', th: 'th', id: 'id' };
const IDS = ['fxa-menu-sign-out', 'fxa-signout-dialog2-button'];
const UA = 'language-qa-script/1.0 (terminology lookup)';

/** The value of a Fluent message, or of its .label attribute when it has no value of its own. */
function message(ftl, id) {
  const m = ftl.match(new RegExp(`^${id} =(.*)\\n((?:[ \\t]+.*\\n)*)`, 'm'));
  if (!m) return null;
  if (m[1].trim()) return m[1].trim();
  return m[2].match(/^\s+\.label\s*=\s*(.*)$/m)?.[1].trim() ?? null;
}

const get = async (url) => {
  const r = await fetch(url, { headers: { 'user-agent': UA } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
};
const out = { source: `${L10N}/<locale>/browser/browser/sync.ftl`, english: EN, commit: COMMIT, licence: 'Mozilla Public License 2.0 (Firefox localization)', fetched: new Date().toISOString(), locales: LOCALES, terms: {} };
const en = await get(EN);
for (const id of IDS) out.terms[id] = { text: { en: message(en, id) } };
for (const [lang, loc] of Object.entries(LOCALES)) {
  const ftl = await get(`${L10N}/${loc}/browser/browser/sync.ftl`);
  for (const id of IDS) out.terms[id].text[lang] = message(ftl, id);
}
writeFileSync(new URL('../../docs/language/sources/mozilla-terms.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
for (const id of IDS) console.log(id, JSON.stringify(out.terms[id].text));
