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
 * choice of draft included. A prompt change cannot: the drafts answer another question. Nor can a
 * change to which forms a duel draws (a language that gains forms): the cell no longer holds 10
 * plays of each. Each cell is taken on its own. Every cell that can be re-scored is, and records it
 * under `rescored`, with the commit it was scored at; each cell that cannot is named, and the run
 * fails. Those cells must be run again in a browser (scripts/model-eval/run.mjs). Until they are,
 *
 *   MEVAL_RESCORE=1 MEVAL_SET_ASIDE=1 npx vitest run src/lib/model-eval.rescore.test.ts
 *
 * moves them to docs/language/model-eval/set-aside/, with the reason, and the run passes: a cell
 * set aside is not measured, so that model writes in no language it held (the brief's rule for an
 * unmeasured language). run.mjs does not see the set-aside folder, so it measures those cells again.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { setAsideCell } from './model-eval-aside';
import { replayPlay, scoredFields, type StoredPlay } from './model-eval-replay';
import { loadAllPacks } from './verse/packs';

const DIR = join(process.cwd(), 'docs', 'language', 'model-eval', 'cells');
const ASIDE = join(process.cwd(), 'docs', 'language', 'model-eval', 'set-aside');

describe('re-scoring the writing cells', () => {
  it.runIf(process.env.MEVAL_RESCORE === '1')('scores every stored draft again with the current code', async () => {
    await loadAllPacks();
    const commit = (() => { try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return null; } })();
    const refused: { file: string; f: string; why: string[] }[] = [];
    let rewritten = 0;
    for (const f of readdirSync(DIR).filter((x) => x.endsWith('.write.json')).sort()) {
      const file = join(DIR, f);
      const cell = JSON.parse(readFileSync(file, 'utf8'));
      let changed = 0;
      const why: string[] = [];
      const plays: StoredPlay[] = [];
      for (const p of cell.plays as StoredPlay[]) {
        const r = await replayPlay(cell.lang, p);
        if (r.drawn !== p.formId || JSON.stringify(r.prompt) !== JSON.stringify(p.prompt)) {
          why.push(`seed ${p.seed} round ${p.roundIndex}: ${r.drawn !== p.formId ? `the duel now draws ${r.drawn}, not ${p.formId}` : 'the prompt changed'}`);
          continue;
        }
        if (JSON.stringify(scoredFields(p)) !== JSON.stringify(scoredFields(r.play))) changed++;
        plays.push(r.play);
      }
      // A cell is re-scored whole or not at all: one play that cannot be leaves the cell to the model.
      if (why.length) { refused.push({ file, f, why }); console.log(`${f}: ${why.length} of ${cell.plays.length} plays cannot be re-scored`); continue; }
      console.log(`${f}: ${changed} of ${cell.plays.length} plays score differently now`);
      if (!changed) continue;
      const rescored = [...(cell.rescored ?? []), { date: new Date().toISOString(), commit, playsChanged: changed, how: 'stored drafts scored again by src/lib/model-eval.rescore.test.ts; the model was not run' }];
      writeFileSync(file, JSON.stringify({ ...cell, plays, rescored }, null, 1) + '\n');
      rewritten++;
    }
    console.log(`${rewritten} cell file(s) re-scored`);
    if (process.env.MEVAL_SET_ASIDE === '1') {
      mkdirSync(ASIDE, { recursive: true });
      for (const r of refused) {
        const cell = JSON.parse(readFileSync(r.file, 'utf8'));
        cell.setAside = { date: new Date().toISOString(), commit, why: `${r.why.length} of ${cell.plays.length} plays cannot be re-scored with the code now; run the cell again (scripts/model-eval/run.mjs)`, plays: r.why };
        const kept = setAsideCell(ASIDE, r.f, cell, r.file);
        console.log(`${r.f}: set aside; it counts as not measured${kept ? ` (the one set aside before is kept in ${kept})` : ''}`);
      }
      return;
    }
    expect(refused.map((r) => `${r.f}: ${r.why[0]}${r.why.length > 1 ? ` (and ${r.why.length - 1} more)` : ''}`), 'cells that cannot be re-scored; run them again in a browser, or set them aside with MEVAL_SET_ASIDE=1').toEqual([]);
  }, 300_000);
});
