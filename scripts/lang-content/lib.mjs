// Shared by build.mjs and check.mjs: the entity table, and the name of an entity in a language.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, '..', '..');
export const LANGS = ['es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ar', 'hi', 'zh', 'ja', 'ko', 'vi', 'th', 'id'];
/** Languages written in the Latin alphabet: an English name can stand in one of these, never in the others. */
export const LATIN = new Set(['es', 'fr', 'de', 'it', 'pt', 'pl', 'vi', 'id']);

const PART_OK = new Set(['es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ar', 'vi', 'id']);

export const wikidata = JSON.parse(readFileSync(join(HERE, 'wikidata-labels.json'), 'utf8'));
export const entities = wikidata.entities;

export function readTsv(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').filter((l) => l.trim() && !l.startsWith('#')).map((l) => l.split('\t'));
}

/** key -> [English names as the game writes them] */
export const gameNames = Object.fromEntries(readTsv(join(HERE, 'entities.tsv')).map(([key, , names]) => [key, names.split('|')]));

/** picks.tsv: key, lang, name, note. A name chosen by hand; it must be found in a source (checked below). */
const picks = new Map(readTsv(join(HERE, 'picks.tsv')).map(([key, lang, name, note]) => [`${key}/${lang}`, { name, note: note ?? '' }]));

/** English names that carry a title the languages translate (Friar Lawrence, Captain Fluellen, Sir Toby). */
const TITLE = /^(?:King|Queen|Prince|Princess|Duke|Lord|Lady|Sir|Captain|Friar|Earl|Saint|Doctor)\s/;

const tokens = (s) => s.split(/[\s·・]+/u).filter(Boolean);

function labelOf(e, lang) {
  const L = e.labels;
  const raw = lang === 'zh' ? L['zh-hans'] ?? L['zh-cn'] ?? L.zh : lang === 'pt' ? L.pt ?? L['pt-br'] : L[lang];
  // A label should not carry a disambiguator, but some do: "Polonio (Hamlet)", "Enrique VIII (teatro)".
  return raw?.replace(/\s*[(（][^)）]*[)）]\s*$/u, '');
}

/** A name standing alone (a quiz option) starts with a capital where the script has capitals. */
export const ucfirst = (s) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

/**
 * names-evidence.tsv: a name read in a language's Wikipedia article (written only by wikipedia.py take,
 * from the fetched text, with the article's revision). For a character Wikidata has no label for in
 * that language, the article on the play is where the language's usual name for it is to be found.
 */
const nameEvidence = readTsv(join(HERE, 'names-evidence.tsv'));

/** Everything a source says this entity is called in a language. */
export function sourcesOf(key, lang) {
  const e = entities[key];
  const out = [];
  const add = (v, where) => v && out.push({ value: v, where });
  for (const [k, l, name, url, , how] of nameEvidence) if (k === key && l === lang) add(name, `${url.match(/^https:\/\/([a-z]+\.wiki[a-z]+)\.org/)?.[1] ?? 'the web'}, ${decodeURIComponent(url.match(/title=([^&]+)/)?.[1] ?? '').replace(/_/g, ' ')} (oldid ${url.match(/oldid=(\d+)/)?.[1]}; ${how})`);
  for (const code of lang === 'zh' ? ['zh-hans', 'zh-cn', 'zh', 'zh-hant'] : lang === 'pt' ? ['pt', 'pt-br'] : [lang]) {
    add(e.labels[code], `label (${code})`);
    for (const a of e.aliases?.[code] ?? []) add(a, `alias (${code})`);
  }
  add(e.sitelinks?.[lang], `${lang}.wikipedia title`);
  if (LATIN.has(lang)) add(e.labels.mul, 'label (mul)');
  return out;
}

/**
 * The name of an entity in a language, and how it was arrived at.
 *   how: 'label'      the Wikidata label, whole
 *        'part'       part of the label: the same words the English game name is of the English label
 *        'pick'       chosen by hand in picks.tsv, and found in a label, alias or Wikipedia title
 *        'unsourced'  chosen by hand in picks.tsv, in no source we hold (listed in the provenance file)
 *        'mul'        Wikidata's language-neutral label (Latin-alphabet languages only)
 *        'english'    no label in this language: the English name stands (Latin alphabet), or is
 *                     left in Latin letters (other scripts) rather than transliterated by guesswork
 */
export function nameOf(key, lang, which = 0) {
  const e = entities[key];
  if (!e) throw new Error(`no such entity: ${key}`);
  const game = gameNames[key][which] ?? gameNames[key][0];
  if (lang === 'en') return { name: game, how: 'english' };
  const pick = picks.get(`${key}#${which}/${lang}`) ?? picks.get(`${key}/${lang}`);
  if (pick) {
    const low = (s) => s.toLocaleLowerCase(lang);
    const sources = sourcesOf(key, lang);
    let found = sources.find((s) => low(s.value).includes(low(pick.name)));
    // A sourced name with a title translated before or after it ("로렌스 신부" for "Friar Lawrence"),
    // where the English name has that title: the name is the source's, the title a translation.
    if (!found && TITLE.test(game)) {
      const named = sources.find((s) => s.value.length > 2 && low(pick.name).includes(low(s.value)));
      if (named) found = { ...named, where: `${named.where}, with the title translated` };
    }
    // The English name kept on purpose (Latin letters where no source has the name in this language).
    if (!found && pick.name === game) return { name: pick.name, how: 'english', note: pick.note };
    return { name: pick.name, how: found ? 'pick' : 'unsourced', where: found?.where, note: pick.note };
  }
  const strip = (v) => v?.replace(/\s*[(（][^)）]*[)）]\s*$/u, '');
  const enLabel = e.labels.en ?? '';
  let label = labelOf(e, lang);
  let from = 'label';
  // No label, or a label that only repeats the English one: the title of that language's Wikipedia article.
  const site = strip(e.sitelinks?.[lang]);
  if (site && (!label || (/^[pw]\./.test(key) && label === enLabel && site !== enLabel))) { label = site; from = 'sitelink'; }
  if (label) {
    const same = (x) => x === game || x === game.replace(/^The /, '');
    if (same(enLabel)) return { name: label, how: from };
    // The English label says more than the game does ("Prince Hamlet" for "Hamlet", "Pericles, Prince
    // of Tyre" for "Pericles", "Gaius Julius Caesar" for "Caesar"): take the same part of this label.
    if (enLabel.startsWith(game + ', ') && label.includes(', ')) return { name: label.split(', ')[0], how: 'part', where: label };
    const en = tokens(enLabel), g = tokens(game), mine = tokens(label);
    const sep = label.includes('・') ? '・' : label.includes('·') ? '·' : ' ';
    const at = en.findIndex((_, i) => g.every((w, j) => en[i + j] === w));
    // Only where a title comes before the name, as in English: in Korean, Japanese, Hindi, Chinese and Thai it does not.
    if (!PART_OK.has(lang)) return { name: label, how: from, check: `English label is "${enLabel}", the game says "${game}"` };
    if (at >= 0 && mine.length === en.length) return { name: mine.slice(at, at + g.length).join(sep), how: 'part', where: label };
    if (at >= 0 && at + g.length === en.length && mine.length > g.length && en.length > g.length) return { name: mine.slice(-g.length).join(sep), how: 'part', where: label };
    return { name: label, how: from, check: `English label is "${enLabel}", the game says "${game}"` };
  }
  if (LATIN.has(lang) && e.labels.mul && (e.labels.mul === game || e.labels.mul === enLabel)) return { name: game, how: 'mul' };
  return { name: game, how: 'english' };
}
