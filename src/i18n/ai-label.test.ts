/**
 * The word for AI beside a verse a model wrote (`ai.label`, owner decision D-12) and in the voice
 * setting (`voice.*`, "AI voice", D-01), in every language, is Wikidata's for artificial intelligence
 * (Q11660): its label or one of its aliases, as saved in docs/language/sources/wikidata-Q11660.json.
 * An abbreviation may drop its full stops (A.I. is written AI), and an alias that gives one in
 * brackets (人工知能（AI）) gives that abbreviation too. English is the source text.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LOCALES, loadMessages } from './index';

const source = JSON.parse(readFileSync('docs/language/sources/wikidata-Q11660.json', 'utf8')) as {
  labels: Record<string, string>;
  aliases: Record<string, string[]>;
};

/** Every way the saved record lets a language write the item's name. */
export function formsOf(lang: string, record = source): string[] {
  const keys = lang === 'pt' ? ['pt', 'pt-br'] : lang === 'zh' ? ['zh', 'zh-hans', 'zh-cn'] : [lang];
  const given = keys.flatMap((k) => [record.labels[k], ...(record.aliases[k] ?? [])]).filter(Boolean) as string[];
  const forms = new Set<string>();
  for (const g of given) {
    forms.add(g);
    // An abbreviation written with stops (A.I., I.A.) may be written without them.
    if (/^(?:\p{Lu}\.)+$/u.test(g)) forms.add(g.replace(/\./g, ''));
    // An abbreviation an alias gives in brackets, 人工知能（AI）.
    for (const m of g.matchAll(/[（(]([^）)]+)[）)]/g)) forms.add(m[1]);
  }
  return [...forms];
}

/** The problems with one language's AI words: a label that is not a form of the item, a voice setting that names none. */
export function aiWordProblems(lang: string, m: Record<string, string>, record = source): string[] {
  if (lang === 'en') return [];
  const forms = formsOf(lang, record);
  const out: string[] = [];
  if (!forms.includes(m['ai.label'])) out.push(`${lang}: ai.label "${m['ai.label']}" is not Wikidata's (Q11660): ${forms.join(', ')}`);
  for (const k of ['voice.off', 'voice.on', 'voice.loading']) {
    if (!forms.some((f) => m[k]?.includes(f))) out.push(`${lang}: ${k} "${m[k]}" does not say AI as Wikidata does (Q11660)`);
  }
  return out;
}

describe('the word for AI, from Wikidata', () => {
  it('labels a model\'s verse and names the voice setting in every language', async () => {
    const problems: string[] = [];
    for (const l of LOCALES) problems.push(...aiWordProblems(l, await loadMessages(l)));
    expect(problems).toEqual([]);
  });

  it('English says AI in both', async () => {
    const en = await loadMessages('en');
    expect(en['ai.label']).toBe('AI');
    for (const k of ['voice.off', 'voice.on', 'voice.loading']) expect(en[k]).toMatch(/^AI voice: /);
  });

  it('objects to a word the record does not give, and to a voice setting that does not say AI (the check can fail)', () => {
    const de = { 'ai.label': 'AI', 'voice.off': 'Stimme: aus', 'voice.on': 'KI-Stimme: an', 'voice.loading': 'KI-Stimme: lädt' };
    const found = aiWordProblems('de', de);
    expect(found.some((p) => p.includes('ai.label'))).toBe(true);
    expect(found.some((p) => p.includes('voice.off'))).toBe(true);
    expect(found.some((p) => p.includes('voice.on'))).toBe(false);
    expect(formsOf('vi')).toContain('AI');
    expect(formsOf('ja')).toContain('AI');
    expect(formsOf('ko')).not.toContain('AI');
  });
});
