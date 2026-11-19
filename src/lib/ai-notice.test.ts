/**
 * The notice before a duel says who plays and who judges (EU AI Act Article 50(1)); see ai-notice.ts.
 * The page tests (tests/ai-notice.spec.ts) show it on screen in every language; these hold the choice
 * of sentence to the model's measured lists, and each language's sentences to their source.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MODELS, modelJudges, modelWrites, type ModelSpec } from './brain';
import { aiNotice } from './ai-notice';
import { PACK_LANGS } from './verse/packs';
import { LOCALES } from '../i18n';

const spec = (writesIn: string[], judgesIn: string[]): ModelSpec => ({ ...MODELS.grand, writesIn, judgesIn });

describe('which notice a duel gets', () => {
  const m = spec(['en', 'it'], ['de', 'it']);
  it.each([
    ['it', 'notice.aiBoth', 'model', 'model'],
    ['en', 'notice.aiWrites', 'model', 'rules'],
    ['de', 'notice.aiJudges', 'written', 'model'],
    ['fr', 'notice.none', 'written', 'rules'],
  ])('%s: %s', (lang, key, opponent, judge) => {
    const n = aiNotice(m, lang);
    expect(n).toMatchObject({ key, opponent, judge });
    expect(n.vars.model).toBe(key === 'notice.none' ? undefined : m.label);
  });

  it('with no model, nobody is told a model plays or judges', () => {
    for (const lang of PACK_LANGS) expect(aiNotice(null, lang)).toEqual({ key: 'notice.none', vars: {}, opponent: 'written', judge: 'rules' });
  });

  it('follows the measured lists of every model, in every language, as the duel itself does', () => {
    for (const model of Object.values(MODELS)) {
      for (const lang of PACK_LANGS) {
        const n = aiNotice(model, lang);
        expect([model.tier, lang, n.opponent], 'who writes').toEqual([model.tier, lang, modelWrites(model, lang) ? 'model' : 'written']);
        expect([model.tier, lang, n.judge], 'who judges').toEqual([model.tier, lang, modelJudges(model, lang) ? 'model' : 'rules']);
      }
    }
  });
});

describe('where a model can be loaded', () => {
  // A model runs on a page only after that page loads it (brain.ts keeps it per page load): content-gen.ts, for one,
  // writes trivia with a model only where one is loaded already, and /playground loads none. Any page or module
  // that starts loading a model must tell the player first, as the battle page and the theatre do.
  const dir = (p: string) => (readdirSync(new URL(`../${p}`, import.meta.url), { recursive: true }) as string[]).map((f) => `src/${p}/${f}`);
  const files = [...dir('pages'), ...dir('lib'), ...dir('components')].filter((f) => /\.(astro|ts)$/.test(f) && !/\.test\.ts$/.test(f));
  const text = (f: string) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');

  it('is only a page that shows the notice first', () => {
    const loaders = files.filter((f) => f !== 'src/lib/brain.ts' && /\bloadBrain\s*\(/.test(text(f)));
    expect(loaders.sort()).toEqual(['src/pages/battle.astro', 'src/pages/theatre.astro']);
    for (const f of loaders) {
      expect([f, text(f).includes('id="ai-notice"')], `${f} shows #ai-notice`).toEqual([f, true]);
      expect([f, /\baiNotice\(/.test(text(f))], `${f} picks it with aiNotice()`).toEqual([f, true]);
    }
  });

  /** The arguments of each loadBrain(...) call in a source, split at their top-level commas. */
  function loadBrainCalls(src: string): string[][] {
    const calls: string[][] = [];
    for (const m of src.matchAll(/\bloadBrain\s*\(/g)) {
      const args: string[] = [];
      let depth = 0;
      let arg = '';
      for (let i = m.index! + m[0].length; i < src.length; i++) {
        const c = src[i];
        if (depth === 0 && (c === ',' || c === ')')) {
          if (arg.trim()) args.push(arg.trim());
          arg = '';
          if (c === ')') break;
          continue;
        }
        if ('([{'.includes(c)) depth++;
        if (')]}'.includes(c)) depth--;
        arg += c;
      }
      calls.push(args);
    }
    return calls;
  }

  it('names the model now loading when the one asked for fails and a smaller one is tried (loadBrain\'s onTry)', () => {
    const loaders = files.filter((f) => f !== 'src/lib/brain.ts' && /\bloadBrain\s*\(/.test(text(f)));
    for (const f of loaders) {
      const calls = loadBrainCalls(text(f).replace(/^\s*import .*$/gm, ''));
      expect(calls.length, `${f} calls loadBrain`).toBeGreaterThan(0);
      for (const args of calls) {
        expect([f, args.length], `${f}: loadBrain(tier, onProgress, onTry)`).toEqual([f, 3]);
        expect([f, /loadingModel\s*=\s*\w+/.test(args[2]) && /renderNotice\(\)/.test(args[2])], `${f}: onTry sets loadingModel and redraws the notice`).toEqual([f, true]);
      }
    }
  });
});

describe('the notice in sixteen languages', () => {
  const KEYS = ['notice.aiBoth', 'notice.aiWrites', 'notice.aiJudges', 'notice.none', 'notice.online'] as const;
  const source = JSON.parse(readFileSync(new URL('../../docs/language/sources/wikidata-ai.json', import.meta.url), 'utf8'));
  const locales = Object.fromEntries(
    LOCALES.map((l) => [l, import(`../i18n/locales/${l}.ts`).then((m) => m.default as Record<string, string>)]),
  );

  it('the source is Wikidata\'s item for artificial intelligence, with a Wikipedia title in every language', () => {
    expect(source.qid).toBe('Q11660');
    expect(source.licence).toBe('CC0 1.0');
    for (const l of LOCALES) expect(source.langs[l]?.sitelink, l).toBeTruthy();
  });

  for (const l of LOCALES) {
    it(`${l}: names artificial intelligence as its Wikipedia does, and the model only where one is used`, async () => {
      const strings = await locales[l];
      // Each word of the title may take an ending (German "künstlicher Intelligenz"), in order.
      const title: string = source.langs[l].sitelink;
      const words = title.split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const named = new RegExp(words.join('\\S*\\s+'), 'iu');
      for (const k of KEYS) {
        const s = strings[k];
        expect(s, `${l} ${k}`).toBeTruthy();
        expect([k, named.test(s)], `${l} ${k} names "${title}"`).toEqual([k, true]);
        const takesModel = k !== 'notice.none' && k !== 'notice.online';
        expect([k, s.includes('{model}')], `${l} ${k}: {model}`).toEqual([k, takesModel]);
      }
    });
  }
});
