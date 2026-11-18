/**
 * The judging cells against the game as it is now, and the gate that keeps a model out of a
 * language it was not measured in (docs/language/MODEL-EVAL.md).
 *
 * A judging cell stores verdicts, not the prompts behind them, so a change to the judge's prompts
 * (judge.ts) or to how referee.ts reads a model would leave the judging decisions describing a
 * judge the game no longer runs, and nothing would turn red. Each judging cell therefore carries a
 * fingerprint: the SHA-256 of every request modelJudge makes for the cell's pairs (the messages
 * and the answer labels, in order). The test below computes it again by calling modelJudge itself
 * with a stand-in for the model library that records each request and answers nothing.
 *
 *   MEVAL_FINGERPRINT=1 npx vitest run src/lib/model-eval.judge.test.ts
 *
 * writes the fingerprint into each judging cell that has none, and only when the code the cell
 * ran from (its `commit`, an rb snapshot) has the same src/lib/verse/ and the same answerScores
 * as the working tree; otherwise it refuses, and that cell must be judged again (run.mjs, or
 * MEVAL_CONTROL=repeat to compare). The model library's own request to the model (the chat
 * template, the tokenizer) is below this fingerprint: a change there is what the repeat control
 * is for.
 *
 * The fingerprint covers what the model is asked, not how its answer is read. So each judged pair
 * also keeps the model's raw reading (referee.ts JudgeReading: the lean in both orders, or each
 * verse's grade), and the test "every verdict follows from…" derives each verdict again from it
 * with the code now (verdictOf, and the rule-based judge the grade path is bounded by): a change
 * to SPLIT_BELOW, GRADE_MARGIN, combineMargins or boundedByRules turns it red.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelSpec } from './brain';
// @ts-expect-error a plain module, shared with the scripts that run the evaluation
import { judgingCode } from '../../scripts/model-eval/lib.mjs';

const stand = vi.hoisted(() => ({ info: null as unknown, requests: [] as unknown[], generated: 0 }));
vi.mock('./brain', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./brain')>();
  return {
    ...actual,
    isBrainLoaded: () => stand.info !== null,
    brainInfo: () => stand.info,
    answerScores: async (messages: unknown, answers: string[]) => { stand.requests.push({ messages, answers }); return answers.map(() => 0); },
    generate: async () => { stand.generated++; return 'Thy candle gutters in the night\nAnd I am bright'; },
  };
});

const { MODELS } = await import('./brain');
const { allusionLexicon, modelJudge, referee, verdictOf } = await import('./verse/referee');
const { DuelSession } = await import('./verse/session');
const { starterDeck } = await import('./verse/duel');
const { loadAllPacks, loadPack } = await import('./verse/packs');
const { judgeLines, rulesJudge } = await import('./verse/judge');
// The language's data, loaded as the game has loaded it by the time a round is judged (its pack, with
// the function words the grade path's filter reads, and its sound data, which the rule judge's flow
// reads); run.mjs loads the same before judging. Absent on a branch without the phonetics work.
const soundPath = './verse/sound';
const sound = (await import(/* @vite-ignore */ soundPath).catch(() => null)) as { loadSound(lang: string): Promise<boolean> } | null;
async function prepare(lang: string) {
  await loadPack(lang);
  if (sound && !(await sound.loadSound(lang))) throw new Error(`the sound data for ${lang} did not load`);
}

const DIR = join(process.cwd(), 'docs', 'language', 'model-eval');
const read = (...p: string[]) => JSON.parse(readFileSync(join(DIR, ...p), 'utf8'));
const cellFiles = existsSync(join(DIR, 'cells')) ? readdirSync(join(DIR, 'cells')).filter((f) => f.endsWith('.judge.json')).sort() : [];

interface StoredPair { id: string; betterIsPlayer: boolean; criteria: Record<string, string>; player: number; opponent: number; source: string; reason?: string; reading?: import('./verse/referee').JudgeReading | null }
interface JudgeCell { tier: keyof typeof MODELS; lang: string; judgeMethod: 'compare' | 'grade'; commit: string; pairs: StoredPair[]; judgePrompts?: { sha256: string; requests: number } }

/** What modelJudge asks the model for a cell's pairs, in the order run.mjs judged them. */
async function fingerprint(cell: JudgeCell): Promise<{ sha256: string; requests: number }> {
  const pairs = new Map((read('pairs', `${cell.lang}.json`).pairs as { id: string; better: { text: string }; worse: { text: string } }[]).map((p) => [p.id, p]));
  await prepare(cell.lang);
  stand.info = { ...MODELS[cell.tier], judge: cell.judgeMethod };
  stand.requests = [];
  for (const p of cell.pairs) {
    const pair = pairs.get(p.id);
    if (!pair) throw new Error(`${cell.tier}.${cell.lang}: pair ${p.id} is no longer in pairs/${cell.lang}.json`);
    await modelJudge(p.betterIsPlayer ? pair.better.text : pair.worse.text, p.betterIsPlayer ? pair.worse.text : pair.better.text, cell.lang);
  }
  const requests = stand.requests.length;
  return { sha256: createHash('sha256').update(JSON.stringify(stand.requests)).digest('hex'), requests };
}

beforeEach(() => { stand.info = null; stand.requests = []; stand.generated = 0; });

describe('the judging cells', () => {
  it.runIf(process.env.MEVAL_FINGERPRINT === '1')('record the fingerprint of the judge\'s prompts, where the cell ran this judging code', async () => {
    // The judging code now, digested as run.mjs and scripts/model-eval/judge-code.mjs digest the code a cell ran.
    const verseDir = join(process.cwd(), 'src', 'lib', 'verse');
    const files = (readdirSync(verseDir, { recursive: true }) as string[]).filter((p) => p.endsWith('.ts')).map((p) => ({ path: `src/lib/verse/${p.split('\\').join('/')}`, text: readFileSync(join(verseDir, p), 'utf8') }));
    const now = judgingCode(files, readFileSync(join(process.cwd(), 'src', 'lib', 'brain.ts'), 'utf8'));
    const at = (() => { try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return null; } })();
    const refused: string[] = [];
    for (const f of cellFiles) {
      const file = join(DIR, 'cells', f);
      const cell = JSON.parse(readFileSync(file, 'utf8'));
      if (cell.judgePrompts) continue;
      if (!cell.code?.verse || cell.code.verse !== now.verse || !cell.code.answerScores || cell.code.answerScores !== now.answerScores) {
        refused.push(`${f}: ${cell.code ? 'it ran other judging code than this' : 'no digest of the code it ran (node scripts/model-eval/judge-code.mjs)'}`);
        continue;
      }
      cell.judgePrompts = { ...(await fingerprint(cell)), at, how: `the requests modelJudge makes now, recorded by src/lib/model-eval.judge.test.ts because the code is the code the cell ran (${cell.code.from})` };
      writeFileSync(file, JSON.stringify(cell, null, 1) + '\n');
    }
    expect(refused, 'cells whose judging code is not the code now').toEqual([]);
  }, 120_000);

  // After a change to the judge's prompts, until the cells are judged again: as the re-score does for
  // writing cells (src/lib/model-eval.rescore.test.ts), move them to set-aside/, where they count as
  // not measured and run.mjs measures them again.
  it.runIf(process.env.MEVAL_SET_ASIDE === '1')('sets aside the judging cells whose prompts the game no longer sends', async () => {
    const aside = join(DIR, 'set-aside');
    mkdirSync(aside, { recursive: true });
    for (const f of cellFiles) {
      const file = join(DIR, 'cells', f);
      if (!existsSync(file)) continue;
      const cell = JSON.parse(readFileSync(file, 'utf8'));
      if (cell.judgePrompts && (await fingerprint(cell)).sha256 === cell.judgePrompts.sha256) continue;
      const at = (() => { try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return null; } })();
      cell.setAside = { date: new Date().toISOString(), commit: at, why: cell.judgePrompts ? 'the judge\'s prompts changed since this cell ran; judge it again (scripts/model-eval/run.mjs)' : 'no fingerprint of the judge\'s prompts; judge it again (scripts/model-eval/run.mjs)' };
      writeFileSync(join(aside, f), JSON.stringify(cell, null, 1) + '\n');
      rmSync(file);
      console.log(`${f}: set aside; it counts as not measured`);
    }
  }, 120_000);

  it.skipIf(process.env.MEVAL_SET_ASIDE === '1')('were judged with the prompts the game sends now', async () => {
    const differ: string[] = [];
    for (const f of cellFiles) {
      const cell = read('cells', f) as JudgeCell;
      if (!cell.judgePrompts) { differ.push(`${f}: no fingerprint (MEVAL_FINGERPRINT=1 npx vitest run src/lib/model-eval.judge.test.ts)`); continue; }
      const now = await fingerprint(cell);
      if (now.sha256 !== cell.judgePrompts.sha256) differ.push(`${f}: the judge's prompts changed since this cell ran (${cell.judgePrompts.requests} requests then, ${now.requests} now): judge it again, or run MEVAL_CONTROL=repeat`);
    }
    expect(differ.slice(0, 12), `${differ.length} of ${cellFiles.length} judging cells`).toEqual([]);
    // Nothing checked would prove nothing; every pair is read on 4 criteria, twice for a comparing judge.
    if (cellFiles.length) expect(cellFiles.length).toBeGreaterThan(10);
  }, 120_000);

  it.skipIf(process.env.MEVAL_SET_ASIDE === '1')('every verdict follows from the reading the cell stores, by the code that reads a model now', async () => {
    const differ: string[] = [];
    let checked = 0;
    for (const f of cellFiles) {
      const cell = read('cells', f) as JudgeCell;
      const texts = new Map((read('pairs', `${cell.lang}.json`).pairs as { id: string; better: { text: string }; worse: { text: string } }[]).map((p) => [p.id, p]));
      await prepare(cell.lang);
      for (const p of cell.pairs) {
        if (!p.reading) { differ.push(`${f} ${p.id}: no raw reading stored (judge the cell again: scripts/model-eval/run.mjs)`); continue; }
        const pair = texts.get(p.id)!;
        const [mine, theirs] = p.betterIsPlayer ? [pair.better.text, pair.worse.text] : [pair.worse.text, pair.better.text];
        const r = p.reading;
        let now;
        if (r.method === 'compare') now = verdictOf(r);
        else {
          // The grade path is bounded by the rules: those are derived again too, from the verses.
          const rules = rulesJudge(mine, theirs, cell.lang, allusionLexicon());
          const unread = judgeLines(mine, cell.lang).left.length > 0 || judgeLines(theirs, cell.lang).left.length > 0;
          if (unread !== !!r.unread) { differ.push(`${f} ${p.id}: the grader would now ${unread ? 'not read' : 'read'} a line it ${r.unread ? 'did not read' : 'read'}: judge it again`); continue; }
          now = verdictOf(r.unread ? { method: 'grade', unread: true, rules } : { method: 'grade', player: r.player, opponent: r.opponent, rules });
        }
        checked++;
        const stored = { criteria: p.criteria, player: p.player, source: p.source, reason: p.reason };
        const derived = { criteria: now.criteria, player: now.player, source: now.source, reason: now.reason };
        if (JSON.stringify(stored) !== JSON.stringify(derived)) differ.push(`${f} ${p.id}: stored ${JSON.stringify(stored)}, the reading gives ${JSON.stringify(derived)} now`);
      }
    }
    expect(differ.slice(0, 12), `${differ.length} of the stored pairs`).toEqual([]);
    if (cellFiles.length) expect(checked, 'pairs re-derived').toBeGreaterThan(100);
  }, 600_000);

  it.skipIf(process.env.MEVAL_SET_ASIDE === '1')('a fingerprint tells two pairs apart, and two judging methods', async () => {
    const cell = read('cells', cellFiles.find((f) => f.startsWith('grand.'))!) as JudgeCell;
    const a = await fingerprint(cell);
    const b = await fingerprint({ ...cell, pairs: [...cell.pairs].reverse() });
    const c = await fingerprint({ ...cell, judgeMethod: 'grade' });
    expect(a.requests).toBe(cell.pairs.length * 8);
    expect(c.requests).toBe(cell.pairs.length * 8);
    expect(new Set([a.sha256, b.sha256, c.sha256]).size).toBe(3);
  });
});

// The gate itself, with lists set here so that it is tested whatever the measured lists hold. A
// careless merge of referee.ts or session.ts (other branches change both) that drops the gate
// turns these red.
describe('a loaded model is used only in the languages it was measured in', () => {
  const spec = (): ModelSpec => ({ ...MODELS.grand, writesIn: ['fr'], judgesIn: ['de'] });
  const a = 'Thy candle gutters in the night\nAnd I am bright';
  const b = 'Ich weiß nicht, was soll es bedeuten,\nDaß ich so traurig bin';

  it('judges by the model in a language in judgesIn, and by rule elsewhere', async () => {
    stand.info = spec();
    const judged = await referee(a, b, 'de');
    expect(judged.source).toBe('model');
    expect(stand.requests.length).toBeGreaterThan(0);
    for (const lang of ['fr', 'th', 'en']) {
      stand.requests = [];
      const ruled = await referee(a, b, lang);
      expect(ruled.source, lang).toBe('rules');
      expect(stand.requests, `${lang}: the model was asked`).toEqual([]);
    }
  });

  it('writes the opponent\'s verse by the model in a language in writesIn, and plays written verse elsewhere', async () => {
    await loadAllPacks();
    stand.info = spec();
    const session = (lang: string) => new DuelSession({ seed: 11, lang, deck: starterDeck(), difficulty: 'apprentice', useModel: true });
    const fr = session('fr');
    await fr.beginRound();
    expect(stand.generated, 'fr: the model was asked to write').toBeGreaterThan(0);
    for (const lang of ['de', 'th', 'en']) {
      stand.generated = 0;
      const s = session(lang);
      await s.beginRound();
      expect(stand.generated, `${lang}: the model was asked to write`).toBe(0);
      expect(s.opponentSource, lang).toBe('written');
    }
  });

  it('reads the verse as the grader would, and says so in the checklist, only in a language the model judges', async () => {
    await loadAllPacks();
    stand.info = { ...spec(), judge: 'grade' };
    const session = (lang: string) => new DuelSession({ seed: 11, lang, deck: starterDeck(), difficulty: 'apprentice', useModel: true });
    const de = session('de');
    expect(de.modelJudges, 'de').toBe(true);
    de.setVerse('Der Mond geht auf\nNote: fünf');
    expect(de.judgeUnread().map((u) => u.line), 'de').toEqual([2]);
    for (const lang of ['fr', 'en']) {
      const s = session(lang);
      expect(s.modelJudges, lang).toBe(false);
      s.setVerse(lang === 'fr' ? 'La lune se lève\nNote : cinq' : 'The moon is up\nGrade: five');
      expect(s.judgeUnread(), lang).toEqual([]);
    }
  });

  it('passes what the opponent answered to the model path, as to the rules', async () => {
    stand.info = { ...spec(), judge: 'grade' };
    const seen: unknown[] = [];
    await modelJudge(a, b, 'de', 'Wer reitet so spät durch Nacht und Wind?', (r) => seen.push(r));
    expect(seen).toHaveLength(1);
    const r = seen[0] as { method: string; rules: { criteria: Record<string, string> } };
    expect(r.method).toBe('grade');
    expect(r.rules).toEqual(rulesJudge(a, b, 'de', allusionLexicon(), 'Wer reitet so spät durch Nacht und Wind?'));
  });

  it('uses no model when none is loaded, and none when the player chose the written opponent', async () => {
    const ruled = await referee(a, b, 'de');
    expect(ruled.source).toBe('rules');
    stand.info = spec();
    const s = new DuelSession({ seed: 11, lang: 'fr', deck: starterDeck(), difficulty: 'apprentice', useModel: false });
    await s.beginRound();
    expect(stand.generated).toBe(0);
    expect(s.opponentSource).toBe('written');
  });
});
