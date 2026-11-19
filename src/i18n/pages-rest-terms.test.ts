/**
 * The terms record of the page areas (docs/language/pages-rest-terms.json): one word per thing
 * in each language, and where the word comes from. scripts/pages-rest/terms.mjs does the
 * checking; this file runs it with the unit tests, and shows it failing on the defects an
 * independent checker found on 2026-11-16, which no test caught then:
 *   - five byes recorded as Wikidata's words, where Wikidata has none in those languages;
 *   - Thai calling virtual reality ความจริงเสมือน in the badge and ความเป็นจริงเสมือน (Wikidata's
 *     label) in the same page's description, while the doc said every language used the label.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LOCALES, type Messages } from './index';
// @ts-ignore a plain .mjs script, shared with the command line
import { checkTerms, loadVendors, loadWikidata, renderDoc } from '../../scripts/pages-rest/terms.mjs';

const AREAS = ['classroom', 'marketplace', 'tournaments', 'season', 'viewer', 'shared', 'pwa'];
const modules = import.meta.glob<{ default: Messages }>('./pages/*/*.ts', { eager: true });
function messagesNow(): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const l of LOCALES) {
    out[l] = {};
    for (const a of AREAS) Object.assign(out[l], modules[`./pages/${a}/${l}.ts`]!.default);
  }
  return out;
}
const read = (f: string) => JSON.parse(readFileSync(f, 'utf8'));
const RECORD = read('docs/language/pages-rest-terms.json');
const MEANING = read('docs/language/pages-rest-meaning.json');
const wikidata = loadWikidata();
const vendors = loadVendors();
const check = (over: { record?: unknown; messages?: unknown; meaning?: unknown } = {}): string[] =>
  checkTerms({ record: over.record ?? RECORD, messages: over.messages ?? messagesNow(), meaning: over.meaning ?? MEANING, wikidata, vendors });

describe('the terms record', () => {
  it('holds against its saved sources, the strings and the meaning record', () => {
    const problems = check();
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('is what the term tables of docs/language/pages-rest.md show', () => {
    const doc = readFileSync('docs/language/pages-rest.md', 'utf8');
    expect(renderDoc(doc, RECORD, wikidata, vendors) === doc, 'the term tables are stale: run node scripts/pages-rest/terms.mjs --write').toBe(true);
  });

  it('refuses a word recorded as Wikidata’s where Wikidata has none in that language (the five byes)', () => {
    for (const l of ['ja', 'pl', 'pt', 'ru', 'vi']) {
      const record = structuredClone(RECORD);
      record.terms.bye.langs[l].rel = 'same';
      const problems = check({ record });
      expect(problems.some((p) => p.startsWith(`bye/${l}: `) && p.includes("is said to be Wikidata's label")), `${l}: ${problems.join('\n')}`).toBe(true);
    }
  });

  it('refuses a verdict that names Wikidata for a word the record says has no source', () => {
    const meaning = structuredClone(MEANING);
    const ja = meaning.reviewed.find((r: { lang: string; id: string }) => r.lang === 'ja' && r.id === 'tour.bye');
    expect(ja, 'the Japanese bye has a verdict').toBeTruthy();
    // The note as it stood before this record existed.
    ja.note = 'the bye, as Wikidata labels it (Q1268659) or, where it has no usable label, a description (Tournaments table); a one-word sports term the round trip cannot keep';
    const problems = check({ meaning });
    expect(problems.some((p) => p.includes('ja tour.bye') && p.includes('which the terms record says is the model\'s word')), problems.join('\n')).toBe(true);
    // And a verdict that names a source without saying which term it is about.
    delete ja.term;
    expect(check({ meaning }).some((p) => p.includes('ja tour.bye') && p.includes('names no term'))).toBe(true);
  });

  it('refuses Thai VR as the branch had it: the badge with a word that is not Wikidata’s label', () => {
    const record = structuredClone(RECORD);
    record.terms.vr.langs.th.word = 'ความจริงเสมือน';
    const problems = check({ record });
    expect(problems.some((p) => p.startsWith('vr/th: "ความจริงเสมือน" is said to be Wikidata')), problems.join('\n')).toBe(true);
  });

  it('refuses a second word for one thing on one page (the checker’s mutation M14: a third Thai word for VR)', () => {
    const messages = messagesNow();
    messages.th['vr.badge'] = 'โลกเสมือนจริง';
    const problems = check({ messages });
    expect(problems.some((p) => p.startsWith('vr/th: vr.badge does not say')), problems.join('\n')).toBe(true);
    // The same for Polish, whose word order the strings had reversed.
    messages.pl['vr.badge'] = 'Wirtualna rzeczywistość';
    expect(check({ messages }).some((p) => p.startsWith('vr/pl: vr.badge does not say'))).toBe(true);
  });

  it('refuses "none" where the source has a word, and "other" where the word is the source’s own', () => {
    const record = structuredClone(RECORD);
    record.terms.bye.langs.de.rel = 'none';
    record.terms.vr.langs.es.rel = 'other';
    record.terms.vr.langs.es.note = 'a test';
    const problems = check({ record });
    expect(problems.some((p) => p.startsWith('bye/de: "none" says Wikidata has nothing')), problems.join('\n')).toBe(true);
    expect(problems.some((p) => p.startsWith('vr/es: "realidad virtual" is Wikidata\'s own word')), problems.join('\n')).toBe(true);
  });

  it('refuses a vendor’s word the vendor does not write', () => {
    const record = structuredClone(RECORD);
    record.terms.not_now.langs.ja.word = '今はしない';
    const messages = messagesNow();
    messages.ja['pwa.install.dismiss'] = '今はしない';
    const problems = check({ record, messages });
    expect(problems.some((p) => p.startsWith('not_now/ja: "今はしない" is said to be Android')), problems.join('\n')).toBe(true);
  });
});
