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
import { MODELS, modelJudges, modelsToOffer, modelWrites, usedAnywhere, type Capability } from './brain';
import { PACK_LANGS, loadAllPacks } from './verse/packs';
// @ts-expect-error a plain module, shared with the scripts that run the evaluation
import { LANGS, TIERS, commentary, decideJudge, decideWrite, derive, inLanguage, instructionLines, scriptOk, summarizeJudge, summarizeWrite, wilson } from '../../scripts/model-eval/lib.mjs';

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

  it('MODEL-EVAL.md is finished and states the lists decisions.json holds', () => {
    const doc = readFileSync(join(process.cwd(), 'docs', 'language', 'MODEL-EVAL.md'), 'utf8');
    expect(doc).not.toMatch(/FILL-[A-Z]+/);
    const LABEL: Record<string, string> = { grand: 'Gemma 4 E2B', standard: 'LFM3 1.7B', lite: 'LFM2.5 350M' };
    const section = doc.slice(doc.indexOf('### What follows'), doc.indexOf('### Cells'));
    expect(section.length, 'the generated "What follows" and "Cells" sections').toBeGreaterThan(20);
    for (const tier of TIERS as string[]) {
      const row = section.split('\n').find((l) => l.startsWith(`| ${LABEL[tier]} | `));
      expect(row, `${tier}: the "What follows" row`).toBeTruthy();
      const [, , writes, judges] = row!.split('|').map((c) => c.trim());
      expect(writes, `${tier} writes`).toBe(decisions.models[tier].writesIn.join(', ') || 'none');
      expect(judges, `${tier} judges`).toBe(decisions.models[tier].judgesIn.join(', ') || 'none');
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

describe('a model used in no language is never offered', () => {
  const desktop: Capability = { webgpu: true, f16: true, memoryGb: 16, handheld: false };
  const phone: Capability = { webgpu: true, f16: true, memoryGb: 4, handheld: true };
  it('offers, with the measured lists, only models used somewhere, and nothing without WebGPU', () => {
    for (const cap of [desktop, phone, { ...desktop, f16: false }]) for (const m of modelsToOffer(cap)) expect(usedAnywhere(m), m.tier).toBe(true);
    expect(modelsToOffer({ ...desktop, webgpu: false })).toEqual([]);
  });
  it('drops a model whose lists are empty and keeps one used in a single language', () => {
    const saved = (TIERS as (keyof typeof MODELS)[]).map((t) => [t, MODELS[t].writesIn, MODELS[t].judgesIn] as const);
    const set = (t: keyof typeof MODELS, writesIn: string[], judgesIn: string[]) => Object.assign(MODELS[t], { writesIn, judgesIn });
    try {
      set('grand', ['en'], []);
      set('standard', [], []);
      set('lite', [], ['ja']);
      expect(modelsToOffer(desktop).map((m) => m.tier)).toEqual(['grand']);
      expect(modelsToOffer(phone).map((m) => m.tier)).toEqual(['lite']);
      set('lite', [], []);
      expect(modelsToOffer(phone)).toEqual([]);
      set('standard', [], ['de']);
      expect(modelsToOffer(desktop).map((m) => m.tier)).toEqual(['grand', 'standard']);
    } finally {
      for (const [t, w, j] of saved) Object.assign(MODELS[t], { writesIn: w, judgesIn: j });
    }
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
  // Verbatim from the first English and Spanish cells (standard.en.write.json; echo from
  // lite.en.write.json; labelsEs from grand.es.write.json). The rules committed before any cell
  // ran missed every one of these.
  const MISSED = {
    selfTalk: 'How I love thee, my heart in bloom\nIn every hour the sun inspires (3) — wait need rhyme pattern.\nLet me design:\nCrossed quatrain: lines 1-3 form one group (A-A?), but instructions: line 1 rhymes with line 3; line 2 with line 4.',
    interruption: 'Many mornings have I seen, / with sorrow blooming like dew, / yet still the world doth hear.\nBut wait—three lines, each longer than the previous; need to craft.',
    echo: 'Open the duel\nFearless',
    labels: 'W - Vivid rays strike the dawning light,\nI - In harmony I draw my might.\nT - Tribute rings where hearts once sang,',
    labelsEs: 'L: Llevo mi veneno ardiente,\nU: Urte con mi sombra oscura,\nN: Nunca cesará mi furia,\nA: Ahora seré lo que debo ser.',
    // standard.fr.write.json and lite.en.write.json
    reasoning: "<think>We need to parse the user's request.",
    announceFr: 'To answer your challenge, I shall craft a heroic couplet in French, echoing Shakespeare’s form.\nNé, je me brise comme un dragon en vain,',
    title: "Crescendo\nThe shadows stretch, dark as dust\nBeneath the moon's pale witnessing light",
  };
  const LANG: Record<string, string> = { labelsEs: 'es', announceFr: 'fr' };
  const PROMPT = ['You are Christina Rossetti…', 'Form: Crescendo. Three lines, each longer than the one before.\nWrite exactly 3 lines.\nYour flourish: Give every line the same number of words.\nOpen the duel: taunt your challenger.\nWrite only the verse, in English. No title, no notes, no explanation.'];
  it('flags what the first cells showed the rules committed before them missing', () => {
    const instructions = instructionLines(PROMPT, null);
    for (const [name, verse] of Object.entries(MISSED)) {
      const lang = LANG[name] ?? 'en';
      expect(commentary(verse, lang, { instructions, narrow: true }), `${name}, narrow`).toEqual([]);
      expect(commentary(verse, lang, { instructions }).length, name).toBeGreaterThan(0);
    }
    // Without the prompt the echo and the title cannot be seen: those rules need the instructions.
    expect(commentary(MISSED.echo, 'en')).toEqual([]);
    expect(commentary(MISSED.title, 'en')).toEqual([]);
  });
  it('does not take verse that names its own making for commentary', () => {
    for (const verse of [
      'Let me not to the marriage of true minds\nAdmit impediments.',
      'How do I love thee? Let me count the ways.\nI love thee to the depth and breadth and height',
      'They also serve who only stand and wait.',
      'O — what a rogue and peasant slave am I!\nIs it not monstrous that this player here',
      'Not marble, nor the gilded monuments\nOf princes, shall outlive this powerful rhyme;',
    ]) expect(commentary(verse, 'en', { instructions: instructionLines(PROMPT, null) }), verse).toEqual([]);
  });
  it('leaves out of the echo rule the challenger\'s verse a prompt quotes', () => {
    const answering = 'Rough winds do shake the darling buds of May';
    const prompt = ['…', `Form: Couplet. Two lines that rhyme.\nYour challenger last said:\n${answering}\nAnswer them.`];
    expect(instructionLines(prompt, answering)).not.toContain(answering);
    expect(commentary('Rough winds do shake the darling buds of May,\nAnd so my answer shakes thy day', 'en', { instructions: instructionLines(prompt, answering) })).toEqual([]);
  });
  it('never reads real verse as an echo of any prompt the game sent in its language', async () => {
    const packs = await loadAllPacks();
    let checked = 0;
    for (const cell of cells.filter((c) => c.task === 'write')) {
      const pack = packs.find((p) => p.lang === cell.lang)!;
      const texts = [...read('corpus', `${cell.lang}.json`).excerpts.map((e: { text: string }) => e.text), ...Object.values(pack.written).flat()] as string[];
      const sets = [...new Map(cell.plays.map((p: { prompt: string[]; answering: string | null }) => [p.prompt.join('\n'), instructionLines(p.prompt, p.answering)])).values()] as string[][];
      for (const t of texts) for (const instructions of sets) {
        checked++;
        expect(commentary(t, cell.lang, { instructions }), `${cell.lang}: ${t}`).toEqual([]);
      }
    }
    // Nothing checked would prove nothing: there are cells, so there are prompts.
    if (cells.some((c) => c.task === 'write')) expect(checked).toBeGreaterThan(1000);
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
  it('bounds what the spelling-based rhyme check can cost: only plays that failed on rhyme alone are added back', () => {
    const checks = (...failed: string[]) => ['lines', 'rhyme-1-2', 'rhyme-3-4'].map((id) => ({ id, met: !failed.includes(id) }));
    const plays = [
      play({ formKept: false, ...({ checks: checks('rhyme-1-2') } as object) }),
      play({ formKept: false, ...({ checks: checks('rhyme-1-2', 'rhyme-3-4') } as object) }),
      play({ formKept: false, ...({ checks: checks('lines', 'rhyme-1-2') } as object) }),
      play({ formKept: false, ...({ checks: checks('lines') } as object) }),
      play({ ...({ checks: checks() } as object) }),
    ];
    const s = summarizeWrite(cell(plays), en);
    expect(s.formKept).toBe(1);
    expect(s.formKeptIfRhymeWaived).toBe(3);
  });
  it('fails a writer that rarely keeps the form, one that returns nothing, and one measured too little', () => {
    expect(decideWrite(summarizeWrite(cell(Array.from({ length: 10 }, (_, i) => play({ formKept: i < 2 }))), en), thresholds.write, 1).ok).toBe(false);
    expect(decideWrite(summarizeWrite(cell(Array.from({ length: 10 }, (_, i) => play(i < 3 ? { source: 'written' } : {}))), en), thresholds.write, 1).ok).toBe(false);
    expect(decideWrite(summarizeWrite(cell(Array.from({ length: 9 }, () => play({}))), en), thresholds.write, 1).ok).toBe(false);
    expect(decideWrite(null, thresholds.write, 1)).toEqual({ ok: false, why: ['not measured'] });
  });
});
