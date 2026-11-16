/**
 * The tool checks of the card text written for the game (scripts/language/check, run on a build host):
 * every finding on the text as it now reads is either fixed or accepted with a reason, no acceptance is
 * left over from text that has changed, and every item has been read by each check as it now reads.
 *
 * The findings files are produced on the build host; this test reads them as committed. After changing
 * any translated text, run the checks again (scripts/language/check/run.sh) and commit their output.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { CARD_CATALOG } from '../cards';
import { loadAllCardText, type CardTextPack } from './index';

type Items = Map<string, string>; // "id|field" -> text
interface Finding { id: string; field: string; text: string; unknown?: string[]; matches?: { rule: string; found: string }[] }
interface CheckFile { languages: Record<string, { flagged?: Finding[]; checked?: Record<string, string>; dictionary?: null; supported?: false }> }
interface BtRow { id: string; field: string; text: string; cos: number; xcos: number | null; control?: number; xcontrol?: number | null }
interface Accepted {
  spelling: Record<string, Record<string, string>>;
  grammar: { lang: string; id: string; field: string; rule: string; found: string; reason: string }[];
  meaning: { lang: string; id: string; field: string; text: string; reason: string }[];
}

const dir = 'docs/language/checks';
const read = <T,>(f: string): T | null => (existsSync(`${dir}/${f}`) ? JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) : null);
const spelling = read<CheckFile>('spelling.json');
const grammar = read<CheckFile>('grammar.json');
const meaning = read<{ languages: Record<string, BtRow[]> }>('backtranslation.json');
const accepted = read<Accepted>('accepted.json') ?? { spelling: {}, grammar: [], meaning: [] };
const provenance = JSON.parse(readFileSync('docs/language/card-text.provenance.json', 'utf8'));

const hash = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex').slice(0, 16);
// The meaning rule of the language QA pipeline: both signals under 0.6.
const doubt = (cos: number, x: number | null | undefined) => cos < 0.6 && (x == null || x < 0.6);

/** The items scripts/language/check/collect.mjs hands to the checks, from a language's card text. */
function itemsOf(pack: CardTextPack): Items {
  const m: Items = new Map();
  for (const c of CARD_CATALOG) {
    const e = pack.cards[c.id];
    if (e.scene) m.set(`${c.id}|scene`, e.scene);
    if (e.quoteSource === 'new' && e.quote) m.set(`${c.id}|quote`, e.quote);
    if (e.nameSource === 'translated' && c.id !== 'SM-001' && e.name) m.set(`${c.id}|name`, e.name);
  }
  for (const [h, t] of Object.entries(pack.houses)) if (provenance.langs[pack.lang].houses[h]?.source === 'translated') m.set(`house:${h}|house`, t);
  for (const [el, t] of Object.entries(pack.elements)) m.set(`element:${el}|element`, t);
  for (const [ty, t] of Object.entries(pack.types)) m.set(`type:${ty}|type`, t);
  return m;
}

/** Everything unresolved in one language. Empty means every finding was dealt with and every check read the current text. */
function triageProblems(lang: string, items: Items, sp: CheckFile | null, gr: CheckFile | null, bt: typeof meaning, acc: Accepted): string[] {
  const out: string[] = [];
  const s = sp?.languages[lang];
  if (!s) out.push(`${lang}: no spelling record`);
  else if (s.dictionary !== null) {
    const words = acc.spelling[lang] ?? {};
    const seen = new Set<string>();
    for (const f of s.flagged ?? []) {
      if (items.get(`${f.id}|${f.field}`) !== f.text) continue;
      for (const w of f.unknown ?? []) {
        seen.add(w);
        if (!words[w]) out.push(`${lang} ${f.id} ${f.field}: Hunspell does not know "${w}", and it is not accepted`);
      }
    }
    for (const w of Object.keys(words)) if (!seen.has(w)) out.push(`${lang}: accepted word "${w}" is no longer found`);
    for (const [k, t] of items) if (s.checked?.[k] !== hash(t)) out.push(`${lang} ${k}: not spell-checked as it now reads`);
  }
  const g = gr?.languages[lang];
  if (!g) out.push(`${lang}: no grammar record`);
  else if (g.supported !== false) {
    const mine = acc.grammar.filter((a) => a.lang === lang);
    const used = new Set<number>();
    for (const f of g.flagged ?? []) {
      if (items.get(`${f.id}|${f.field}`) !== f.text) continue;
      for (const m of f.matches ?? []) {
        const i = mine.findIndex((a) => a.id === f.id && a.field === f.field && a.rule === m.rule && a.found === m.found);
        if (i < 0) out.push(`${lang} ${f.id} ${f.field}: LanguageTool ${m.rule} on "${m.found}", not accepted`);
        else used.add(i);
      }
    }
    mine.forEach((a, i) => { if (!used.has(i)) out.push(`${lang} ${a.id} ${a.field}: accepted ${a.rule} on "${a.found}" is no longer found`); });
    for (const [k, t] of items) if (g.checked?.[k] !== hash(t)) out.push(`${lang} ${k}: not grammar-checked as it now reads`);
  }
  const rows = bt?.languages[lang];
  if (!rows) out.push(`${lang}: not back-translated`);
  else {
    const by = new Map(rows.map((r) => [`${r.id}|${r.field}`, r]));
    const mine = acc.meaning.filter((a) => a.lang === lang);
    const used = new Set<number>();
    for (const [k, t] of items) {
      const r = by.get(k);
      if (!r || r.text !== t) { out.push(`${lang} ${k}: not back-translated as it now reads`); continue; }
      if (!doubt(r.cos, r.xcos)) continue;
      const i = mine.findIndex((a) => `${a.id}|${a.field}` === k && a.text === t);
      if (i < 0) out.push(`${lang} ${k}: back-translation flagged (cos ${r.cos}, LaBSE ${r.xcos}), not accepted`);
      else used.add(i);
    }
    mine.forEach((a, i) => { if (!used.has(i)) out.push(`${lang} ${a.id} ${a.field}: accepted back-translation no longer matches`); });
  }
  for (const [w, why] of Object.entries(acc.spelling[lang] ?? {})) if (!why.trim()) out.push(`${lang}: accepted word "${w}" without a reason`);
  for (const a of [...acc.grammar, ...acc.meaning]) if (a.lang === lang && !a.reason.trim()) out.push(`${lang} ${a.id}: acceptance without a reason`);
  return out;
}

let packs: CardTextPack[] = [];
beforeAll(async () => { packs = await loadAllCardText(); });

describe('the tool checks of the text written for the game', () => {
  it('every finding is fixed or accepted with a reason, and every item was checked as it now reads', () => {
    const all = packs.flatMap((p) => triageProblems(p.lang, itemsOf(p), spelling, grammar, meaning, accepted));
    expect(all).toEqual([]);
  });

  it('the control: the meaning rule flags most deliberately mismatched pairs in every language', () => {
    for (const p of packs) {
      const rows = (meaning?.languages[p.lang] ?? []).filter((r) => r.control !== undefined);
      expect([p.lang, rows.length > 100]).toEqual([p.lang, true]);
      const caught = rows.filter((r) => doubt(r.control!, r.xcontrol)).length / rows.length;
      expect([p.lang, caught > 0.7]).toEqual([p.lang, true]);
    }
  });

  it('can fail: an unaccepted word, a changed text, a stale acceptance and a flagged meaning are each reported', () => {
    const fr = packs.find((p) => p.lang === 'fr')!;
    const items = itemsOf(fr);
    const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
    expect(triageProblems('fr', items, spelling, grammar, meaning, accepted)).toEqual([]);
    // A scene no check flagged, so that changing it touches nothing else.
    const flaggedKeys = new Set([
      ...[spelling, grammar].flatMap((f) => (f?.languages.fr.flagged ?? []).map((x) => `${x.id}|${x.field}`)),
      ...(meaning?.languages.fr ?? []).filter((r) => doubt(r.cos, r.xcos)).map((r) => `${r.id}|${r.field}`),
    ]);
    const [key, text] = [...items].find(([k]) => k.endsWith('|scene') && !flaggedKeys.has(k))!;
    // A word Hunspell rejected on a current text, with no acceptance.
    const [id, field] = key.split('|');
    const sp = clone(spelling)!;
    sp.languages.fr.flagged!.push({ id, field, text, unknown: ['chatteau'] });
    expect(triageProblems('fr', items, sp, grammar, meaning, accepted)).toEqual([`fr ${id} ${field}: Hunspell does not know "chatteau", and it is not accepted`]);
    // The text changed after the checks ran.
    const changed = new Map(items);
    changed.set(key, text + ' Une phrase de plus.');
    expect(triageProblems('fr', changed, spelling, grammar, meaning, accepted)).toEqual([
      `fr ${key}: not spell-checked as it now reads`, `fr ${key}: not grammar-checked as it now reads`, `fr ${key}: not back-translated as it now reads`,
    ]);
    // An acceptance that no longer excuses anything.
    const acc = clone(accepted);
    acc.grammar.push({ lang: 'fr', id, field, rule: 'D_N', found: 'des Montague', reason: 'test' });
    expect(triageProblems('fr', items, spelling, grammar, meaning, acc)).toEqual([`fr ${id} ${field}: accepted D_N on "des Montague" is no longer found`]);
    // A back-translation that both signals doubt.
    const bt = clone(meaning)!;
    const row = bt.languages.fr.find((r) => `${r.id}|${r.field}` === key)!;
    row.cos = 0.2; row.xcos = 0.3;
    expect(triageProblems('fr', items, spelling, grammar, bt, accepted)).toEqual([`fr ${key}: back-translation flagged (cos 0.2, LaBSE 0.3), not accepted`]);
  });
});
