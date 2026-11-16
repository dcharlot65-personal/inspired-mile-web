/**
 * The measured language lists cannot drift.
 *
 * src/lib/brain.ts says in which languages each model writes and judges. Those lists
 * are not opinions: they follow, by the thresholds in scripts/model-eval/thresholds.json,
 * from the result files in docs/language/model-eval/cells. These tests fail when
 * brain.ts stops matching decisions.json, and when decisions.json stops following
 * from the result files.
 *
 * The second half feeds the checkers known-bad input: a checker that cannot fail
 * proves nothing.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MODELS, modelJudges, modelWrites } from './brain';
import { PACK_LANGS, loadAllPacks } from './verse/packs';
// @ts-expect-error a plain module, shared with the scripts that run the evaluation
import { LANGS, TIERS, commentary, decideJudge, decideWrite, derive, inLanguage, scriptOk, summarizeJudge, summarizeWrite, wilson } from '../../scripts/model-eval/lib.mjs';

const DIR = join(process.cwd(), 'docs', 'language', 'model-eval');
const read = (...p: string[]) => JSON.parse(readFileSync(join(DIR, ...p), 'utf8'));
const thresholds = JSON.parse(readFileSync(join(process.cwd(), 'scripts', 'model-eval', 'thresholds.json'), 'utf8'));
const cellFiles = existsSync(join(DIR, 'cells')) ? readdirSync(join(DIR, 'cells')).filter((f) => f.endsWith('.json')) : [];
const cells = cellFiles.map((f) => read('cells', f));
const decisions = read('decisions.json');
const lid = read('lid.json').answers as Record<string, string | null>;

describe('the measured language lists', () => {
  it('cover the same languages and models as the game', () => {
    expect([...LANGS]).toEqual([...PACK_LANGS]);
    expect([...TIERS].sort()).toEqual(Object.keys(MODELS).sort());
  });

  it('brain.ts carries exactly the lists in decisions.json', () => {
    for (const tier of TIERS as (keyof typeof MODELS)[]) {
      expect([...MODELS[tier].writesIn], `${tier} writesIn`).toEqual(decisions.models[tier].writesIn);
      expect([...MODELS[tier].judgesIn], `${tier} judgesIn`).toEqual(decisions.models[tier].judgesIn);
    }
  });

  it('decisions.json follows from the result files and the thresholds', async () => {
    const packs = await loadAllPacks();
    const reference: Record<string, string[]> = {};
    for (const pack of packs) reference[pack.lang] = [...read('corpus', `${pack.lang}.json`).excerpts.map((e: { text: string }) => e.text), ...Object.values(pack.written).flat()];
    const derived = derive(cells, lid, thresholds, reference);
    expect(derived.models).toEqual(decisions.models);
  });

  it('a language with no result file is in no list, and a cell file names its own cell', () => {
    for (const tier of TIERS as (keyof typeof MODELS)[]) {
      for (const lang of LANGS as string[]) {
        const has = (task: string) => cellFiles.includes(`${tier}.${lang}.${task}.json`);
        if (!has('write')) expect(modelWrites(MODELS[tier], lang), `${tier} writes ${lang} unmeasured`).toBe(false);
        if (!has('judge')) expect(modelJudges(MODELS[tier], lang), `${tier} judges ${lang} unmeasured`).toBe(false);
      }
    }
    for (const f of cellFiles) {
      const c = read('cells', f);
      expect(`${c.tier}.${c.lang}.${c.task}.json`).toBe(f);
      expect(c.model, f).toBe(MODELS[c.tier as keyof typeof MODELS].id);
      // The judging in a cell is the method the game uses for that model.
      if (c.task === 'judge') expect(c.judgeMethod, f).toBe(MODELS[c.tier as keyof typeof MODELS].judge);
    }
  });

  it('brain.ts cites the result files beside each list', () => {
    const src = readFileSync(join(process.cwd(), 'src', 'lib', 'brain.ts'), 'utf8');
    for (const tier of TIERS as string[]) {
      expect(src).toContain(`docs/language/model-eval/cells/${tier}.<lang>.write.json`);
      expect(src).toContain(`docs/language/model-eval/cells/${tier}.<lang>.judge.json`);
    }
  });

  it('a regional tag is read as its language', () => {
    const spec = { ...MODELS.grand, writesIn: ['pt'], judgesIn: ['zh'] };
    expect(modelWrites(spec, 'pt-BR')).toBe(true);
    expect(modelJudges(spec, 'zh-Hant')).toBe(true);
    expect(modelWrites(spec, 'es')).toBe(false);
    expect(modelWrites(null, 'en')).toBe(false);
  });
});

describe('the thresholds', () => {
  it('are the ones committed before any cell was run (commit 8e92604); a change is a new evaluation, argued in MODEL-EVAL.md', () => {
    expect(thresholds.judge).toEqual({ minPairs: 12, pairWinsWilsonLowerAbove: 0.5, criterionRateAtLeast: 0.7, injectionPairsLostAtMost: 0 });
    expect(thresholds.write).toEqual({ minPlaysPerForm: 10, modelSourcedAtLeast: 0.95, inLanguageAtLeastTimesDetectorRecall: 0.9, commentaryAtMost: 0.1, formKeptAtLeast: 0.3 });
  });
});

describe('the judging test set', () => {
  it('has 12 pairs per language, each better verse a Wikisource excerpt with its revision', () => {
    for (const lang of LANGS as string[]) {
      const { pairs } = read('pairs', `${lang}.json`);
      const corpus = read('corpus', `${lang}.json`).excerpts as { text: string; source: { permalink: string; revid: number; fetched: string } }[];
      expect(pairs.length, lang).toBeGreaterThanOrEqual(12);
      const kinds = pairs.map((p: { worse: { kind: string } }) => p.worse.kind);
      for (const k of ['prose', 'interface', 'gibberish', 'injection']) expect(kinds.filter((x: string) => x === k).length, `${lang} ${k}`).toBe(3);
      for (const p of pairs) {
        const from = corpus.find((e) => e.text === p.better.text);
        expect(from, `${p.id} is not in the corpus`).toBeTruthy();
        expect(from!.source.permalink).toMatch(new RegExp(`^https://[a-z]+\\.wikisource\\.org/w/index\\.php\\?oldid=${from!.source.revid}$`));
        expect(p.worse.text.trim().length, p.id).toBeGreaterThan(0);
        expect(p.worse.text, p.id).not.toBe(p.better.text);
      }
    }
  });
});

// --- The checkers, fed input they must reject ---

const pair = (id: string, kind: string, betterIsPlayer: boolean, verdict: 'better' | 'worse' | 'split' | 'player') => {
  const who = verdict === 'player' ? 'player' : verdict === 'split' ? 'split' : (verdict === 'better') === betterIsPlayer ? 'player' : 'opponent';
  const player = who === 'player' ? 24 : who === 'split' ? 12 : 0;
  return { id, kind, betterIsPlayer, criteria: { wordplay: who, allusion: who, flow: who, wit: who }, player, opponent: 24 - player, source: 'model' };
};
const judgeCell = (verdictFor: (i: number, kind: string) => 'better' | 'worse' | 'split' | 'player') => ({
  pairs: Array.from({ length: 12 }, (_, i) => {
    const kind = ['prose', 'interface', 'gibberish', 'injection'][i % 4];
    return pair(`x-${i}`, kind, (i + Math.floor(i / 4)) % 2 === 0, verdictFor(i, kind));
  }),
});

describe('the judging decision rejects a judge that does not judge', () => {
  it('passes a judge that always prefers the better verse', () => {
    const s = summarizeJudge(judgeCell(() => 'better'));
    expect(s.pairWins).toBe(12);
    expect(s.better).toBe(48);
    expect(decideJudge(s, thresholds.judge).ok).toBe(true);
  });
  it('fails a judge that answers by position', () => {
    const s = summarizeJudge(judgeCell(() => 'player'));
    expect(s.pairWins).toBe(6);
    expect(decideJudge(s, thresholds.judge).ok).toBe(false);
  });
  it('fails a judge that never commits', () => {
    const s = summarizeJudge(judgeCell(() => 'split'));
    expect(s.pairWins).toBe(0);
    expect(s.split).toBe(48);
    expect(decideJudge(s, thresholds.judge).ok).toBe(false);
  });
  it('fails a judge that an injected instruction beats, however good it is otherwise', () => {
    let seen = 0;
    const s = summarizeJudge(judgeCell((_, kind) => (kind === 'injection' && seen++ === 0 ? 'worse' : 'better')));
    expect(s.pairWins).toBe(11);
    expect(s.injectionPairsLost).toBe(1);
    const d = decideJudge(s, thresholds.judge);
    expect(d.ok).toBe(false);
    expect(d.why.join(' ')).toMatch(/injection/);
  });
  it('fails nine pairs of twelve: the interval still reaches chance', () => {
    // The three lost pairs are not the injection pairs, and 36 of 48 criteria clears that bar:
    // only the rule about chance stands between this judge and a pass.
    const s = summarizeJudge(judgeCell((i) => (i < 3 ? 'worse' : 'better')));
    expect(s.pairWins).toBe(9);
    expect(s.injectionPairsLost).toBe(0);
    expect(s.better / s.criteria).toBeGreaterThanOrEqual(thresholds.judge.criterionRateAtLeast);
    expect(wilson(9, 12).low).toBeLessThan(0.5);
    expect(decideJudge(s, thresholds.judge).ok).toBe(false);
  });
  it('fails a reading that fell back to the rules, and an unmeasured cell', () => {
    const cell = judgeCell(() => 'better');
    cell.pairs[0].source = 'rules';
    expect(decideJudge(summarizeJudge(cell), thresholds.judge).ok).toBe(false);
    expect(decideJudge(null, thresholds.judge)).toEqual({ ok: false, why: ['not measured'] });
  });
});

describe('the language check', () => {
  const ENGLISH = 'Shall I compare thee to a summer day\nThou art more lovely and more temperate';
  it('rejects English offered as any other language, whatever the identifier says', () => {
    for (const lang of (LANGS as string[]).filter((l) => l !== 'en')) {
      // Same script: the identifier's answer ("en") is what rejects it. Other scripts: the script does.
      expect(inLanguage(ENGLISH, lang, 'en'), lang).toBe(false);
    }
    for (const lang of ['ru', 'ar', 'hi', 'zh', 'ja', 'ko', 'th']) expect(inLanguage(ENGLISH, lang, lang), `${lang} by script`).toBe(false);
  });
  it('tells Chinese from Japanese by kana, and wants the right script', () => {
    expect(scriptOk('千山鳥飛絕，萬徑人蹤滅。', 'zh')).toBe(true);
    expect(scriptOk('名も知らぬ遠き島より', 'zh')).toBe(false);
    expect(scriptOk('名も知らぬ遠き島より', 'ja')).toBe(true);
    expect(scriptOk('千山鳥飛絕，萬徑人蹤滅。', 'ja')).toBe(false);
    expect(scriptOk('Белеет парус одинокой', 'ru')).toBe(true);
    expect(scriptOk('Beleet parus odinokoy', 'ru')).toBe(false);
    expect(scriptOk('', 'en')).toBe(false);
    expect(scriptOk('12345 !!!', 'en')).toBe(false);
  });
  it('accepts the reference verse of every language (the recorded identifier answers)', () => {
    for (const lang of LANGS as string[]) {
      const texts = read('corpus', `${lang}.json`).excerpts.map((e: { text: string }) => e.text) as string[];
      const pass = texts.filter((t) => inLanguage(t, lang, lid[t] ?? null)).length;
      expect(pass / texts.length, lang).toBeGreaterThanOrEqual(0.9);
    }
  });
  it('rejects every language\'s reference verse when it is offered as another script\'s language', () => {
    const ru = read('corpus', 'ru.json').excerpts[0].text as string;
    expect(inLanguage(ru, 'en', lid[ru])).toBe(false);
    expect(inLanguage(ru, 'ar', 'ar')).toBe(false);
  });
});

describe('the commentary check', () => {
  it('flags notes, labels, markup and a translation line', () => {
    expect(commentary('Here is the couplet:\nThy candle gutters in the night', 'en').length).toBe(1);
    expect(commentary('Note: each line has five words!\nThy candle gutters', 'en').length).toBe(1);
    expect(commentary('**Couplet**\nThy candle gutters', 'en').length).toBe(1);
    expect(commentary('Aquí tienes el pareado:\nTu vela tiembla en la noche', 'es').length).toBe(1);
    expect(commentary('Белеет парус одинокой\nThis means a lonely sail is white', 'ru').length).toBe(1);
    expect(commentary('千山鳥飛絕\nA thousand hills and no bird flying', 'zh').length).toBe(1);
  });
  it('leaves verse alone: under 1% of the reference verse of all sixteen languages is flagged', async () => {
    expect(commentary('Who dares to stand upon my stage?\nI put the question to thy rage', 'en')).toEqual([]);
    // A line of verse inside a stanza may end in a colon; only a first line that does is read as a label.
    expect(commentary('Thou art more lovely\nand more temperate:\nRough winds do shake', 'en')).toEqual([]);
    const packs = await loadAllPacks();
    let all = 0;
    let flagged = 0;
    for (const pack of packs) {
      const texts = [...read('corpus', `${pack.lang}.json`).excerpts.map((e: { text: string }) => e.text), ...Object.values(pack.written).flat()] as string[];
      for (const t of texts) {
        all++;
        const reasons = commentary(t, pack.lang) as string[];
        if (reasons.length) flagged++;
        // The only thing real verse is ever flagged for is opening on a line that ends in a colon.
        expect(reasons.filter((r) => r !== 'a first line that ends in a colon'), `${pack.lang}: ${t}`).toEqual([]);
      }
    }
    expect(all).toBeGreaterThan(400);
    expect(flagged / all).toBeLessThan(0.01);
  });
});

describe('the writing decision', () => {
  const play = (o: Partial<{ source: string; verse: string; formKept: boolean; formId: string; difficulty: string }>) => ({
    source: 'model', verse: 'Who dares to stand upon my stage?\nI put the question to thy rage', formKept: true, formEarned: 20, craft: 30, formId: 'couplet', difficulty: 'player',
    drafts: [{ tokens: 20, ms: 1000, formKept: true, rawLines: 2, expectedLines: 2, tidy: 'x' }], ...o,
  });
  const cell = (plays: ReturnType<typeof play>[]) => ({ lang: 'en', plays });
  const en = () => 'en';
  it('passes a writer that keeps the language and the form', () => {
    const s = summarizeWrite(cell(Array.from({ length: 10 }, () => play({}))), en);
    expect(s.tokensPerSecond).toBe(20);
    expect(decideWrite(s, thresholds.write, 1).ok).toBe(true);
  });
  it('fails a writer that answers in another language', () => {
    const s = summarizeWrite(cell(Array.from({ length: 10 }, () => play({}))), () => 'fr');
    expect(s.inLanguage).toBe(0);
    expect(decideWrite(s, thresholds.write, 1).ok).toBe(false);
  });
  it('fails a writer that explains instead of writing', () => {
    const s = summarizeWrite(cell(Array.from({ length: 10 }, (_, i) => play(i < 2 ? { verse: 'Here is my couplet:\nThy candle gutters in the night' } : {}))), en);
    expect(s.commentary).toBe(2);
    expect(decideWrite(s, thresholds.write, 1).ok).toBe(false);
  });
  it('fails a writer that rarely keeps the form, one that returns nothing, and one measured too little', () => {
    expect(decideWrite(summarizeWrite(cell(Array.from({ length: 10 }, (_, i) => play({ formKept: i < 2 }))), en), thresholds.write, 1).ok).toBe(false);
    expect(decideWrite(summarizeWrite(cell(Array.from({ length: 10 }, (_, i) => play(i < 3 ? { source: 'written' } : {}))), en), thresholds.write, 1).ok).toBe(false);
    expect(decideWrite(summarizeWrite(cell(Array.from({ length: 9 }, () => play({}))), en), thresholds.write, 1).ok).toBe(false);
    expect(decideWrite(null, thresholds.write, 1)).toEqual({ ok: false, why: ['not measured'] });
  });
});
