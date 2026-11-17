/**
 * Single words checked against a published dictionary: English Wiktionary's translation tables
 * (docs/language/sources/wiktionary-words.json, fetched by scripts/lang/fetch-wiktionary-words.mjs).
 *
 * What is checked, in every language but English:
 *   - each relic's power words: word i of a relic translates English word i (they score in a duel);
 *   - the judge's four criteria (criterion.* in the locale files);
 *   - the glossary's core terms (verse, round, ink, …): the glossary's word for each.
 * A word is "listed" when one of the tables on its English word's page gives it for that language
 * (any sense; the sense that matched is reported), compared after removing what does not change the
 * word: letter case, Arabic short-vowel marks, the Devanagari nukta and candrabindu, Russian ё. It is
 * "not covered" when the page has no translation for that language at all, which proves nothing either
 * way. A word that is not listed where the page does cover the language is a finding: it is changed to
 * a listed word, or accepted in docs/language/allow/words.json with the reason a reader kept it (a
 * noun chosen for an English verb, an inflected form, a word the table lacks).
 */

/** glossary term id or criterion key -> the English Wiktionary page for it. */
export const WORD_PAGES = {
  verse: 'verse',
  round: 'round',
  ink: 'ink',
  curse: 'curse',
  relic: 'relic',
  potion: 'potion',
  deck: 'deck',
  duel: 'duel',
  craft: 'craft',
  judge: 'judge',
  opponent: 'opponent',
  signature: 'signature',
  syllable: 'syllable',
  rhyme: 'rhyme',
  'criterion.wordplay': 'wordplay',
  'criterion.allusion': 'allusion',
  'criterion.flow': 'flow',
  'criterion.wit': 'wit',
};

/**
 * A word as compared. Also: Wiktionary's wiki links ([[아무것]][[-도]]) lose their brackets, a Korean or
 * Vietnamese word loses the Hanja written after it (왕관(王冠) -> 왕관), and Chinese is compared in
 * simplified characters, each traditional one mapped by OpenCC's table (`ts`, sources/opencc-ts.json):
 * Wiktionary writes Mandarin in traditional characters.
 */
export function loose(word, lang, ts = {}) {
  let w = String(word).normalize('NFC').replace(/\[\[|\]\]/g, '').toLocaleLowerCase(lang).trim();
  if (lang === 'ko' || lang === 'vi') w = w.replace(/\s*\([^)]*\)$/, '');
  if (lang === 'zh') w = [...w].map((c) => ts[c] ?? c).join('');
  if (lang === 'ar') w = w.replace(/[ً-ْٰـ]/g, '');
  if (lang === 'hi') w = w.normalize('NFD').replace(/़/g, '').replace(/ँ/g, 'ं').normalize('NFC');
  if (lang === 'ru') w = w.replace(/ё/g, 'е');
  return w;
}

/** Where a word stands: { state: 'listed'|'not-listed'|'not-covered'|'no-page', sense?, offered? }. */
export function lookUp(wikt, english, lang, word, ts) {
  const page = wikt.words?.[english];
  if (!page || !page.exists) return { state: 'no-page' };
  const tables = (page.tables ?? []).filter((t) => t.langs?.[lang]?.length);
  if (!tables.length) return { state: 'not-covered' };
  const want = loose(word, lang, ts);
  for (const t of tables) if (t.langs[lang].some((w) => loose(w, lang, ts) === want)) return { state: 'listed', sense: t.sense };
  return { state: 'not-listed', offered: [...new Set(tables.flatMap((t) => t.langs[lang]))].slice(0, 12) };
}

/**
 * Every word to check: [{ lang, kind, id, english, word }].
 * `packs`: { lang: pack }, `ui`: { lang: messages }, `glossary`: glossary.json.
 */
export function wordsToCheck(langs, packs, ui, glossary) {
  const out = [];
  for (const lang of langs) {
    if (lang === 'en') continue;
    for (const [id, words] of Object.entries(packs.en.relics)) words.forEach((english, i) => out.push({ lang, kind: 'relic', id: `relics.${id}.${i}`, english, word: packs[lang].relics[id]?.[i] }));
    for (const [id, page] of Object.entries(WORD_PAGES)) {
      if (id.startsWith('criterion.')) out.push({ lang, kind: 'criterion', id, english: page, word: ui[lang][id] });
      else if (glossary.terms?.[id]?.langs?.[lang]) out.push({ lang, kind: 'term', id, english: page, word: glossary.terms[id].langs[lang].term });
    }
  }
  return out;
}

/** The findings, with each accepted one marked; `allow` is allow/words.json's entries, `ts` OpenCC's table. */
export function checkWords(items, wikt, allow, ts = {}) {
  const rows = items.map((x) => ({ ...x, ...lookUp(wikt, x.english, x.lang, x.word, ts) }));
  const used = new Set();
  const open = [];
  for (const r of rows) {
    if (r.state !== 'not-listed') continue;
    const i = allow.findIndex((a) => a.lang === r.lang && a.id === r.id && a.word === r.word);
    if (i >= 0) {
      used.add(i);
      r.allowed = allow[i].reason;
    } else open.push(r);
  }
  const stale = allow.filter((_, i) => !used.has(i));
  return { rows, open, stale };
}
