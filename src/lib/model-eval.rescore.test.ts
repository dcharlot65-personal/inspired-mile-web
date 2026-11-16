/**
 * Score the writing cells again from their stored drafts, after a change to the game's rules.
 *
 *   MEVAL_RESCORE=1 npx vitest run src/lib/model-eval.rescore.test.ts
 *   node scripts/model-eval/analyze.mjs && node scripts/model-eval/copy-lists.mjs
 *
 * Does nothing unless MEVAL_RESCORE=1, so an ordinary `npx vitest run` never writes a file. Run it
 * on its own: it rewrites docs/language/model-eval/cells/*.write.json, which the other test file
 * reads.
 *
 * A rule change (forms, devices, rhyme, syllables, the tidy-up) changes nothing the model wrote,
 * only what the game made of it, so the stored drafts can be scored again exactly: the opponent's
 * choice of draft included. A prompt change cannot: the drafts answer another question. Then this
 * refuses, and those cells must be run again in a browser (scripts/model-eval/run.mjs).
 * Each cell it changes records it under `rescored`, with the commit it was scored at.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { replayPlay, scoredFields, type StoredPlay } from './model-eval-replay';
import { loadAllPacks } from './verse/packs';

const DIR = join(process.cwd(), 'docs', 'language', 'model-eval', 'cells');

describe('re-scoring the writing cells', () => {
  it.runIf(process.env.MEVAL_RESCORE === '1')('scores every stored draft again with the current code', async () => {
    await loadAllPacks();
    const commit = (() => { try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return null; } })();
    const refused: string[] = [];
    const updates: { file: string; cell: { plays: StoredPlay[]; rescored?: unknown[] }; changed: number }[] = [];
    for (const f of readdirSync(DIR).filter((x) => x.endsWith('.write.json')).sort()) {
      const file = join(DIR, f);
      const cell = JSON.parse(readFileSync(file, 'utf8'));
      let changed = 0;
      const plays: StoredPlay[] = [];
      for (const p of cell.plays as StoredPlay[]) {
        const r = await replayPlay(cell.lang, p);
        if (r.drawn !== p.formId || JSON.stringify(r.prompt) !== JSON.stringify(p.prompt)) {
          refused.push(`${f} seed ${p.seed} round ${p.roundIndex}: ${r.drawn !== p.formId ? `the duel now draws ${r.drawn}` : 'the prompt changed'}`);
          continue;
        }
        if (JSON.stringify(scoredFields(p)) !== JSON.stringify(scoredFields(r.play))) changed++;
        plays.push(r.play);
      }
      console.log(`${f}: ${changed} of ${cell.plays.length} plays score differently now`);
      if (changed) updates.push({ file, cell: { ...cell, plays }, changed });
    }
    // A prompt change anywhere: nothing is written at all, and the run says which plays.
    expect(refused.slice(0, 12), `${refused.length} plays cannot be re-scored; run their cells again in a browser`).toEqual([]);
    for (const u of updates) {
      u.cell.rescored = [...(u.cell.rescored ?? []), { date: new Date().toISOString(), commit, playsChanged: u.changed, how: 'stored drafts scored again by src/lib/model-eval.rescore.test.ts; the model was not run' }];
      writeFileSync(u.file, JSON.stringify(u.cell, null, 1) + '\n');
    }
    console.log(`${updates.length} cell file(s) rewritten`);
  });
});
