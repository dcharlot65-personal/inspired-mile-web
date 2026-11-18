/**
 * Moving a cell of the model evaluation to docs/language/model-eval/set-aside/, where it counts as
 * not measured until it is run again (src/lib/model-eval.rescore.test.ts for writing cells,
 * src/lib/model-eval.judge.test.ts for judging cells). Node only: the tests use it, the browser
 * never does.
 *
 * set-aside/ also keeps the record of the game before a change: the cells that change set aside,
 * which src/lib/model-eval.test.ts still reads ("what the model wrote is what the cells read"). A
 * second change can set aside a cell of the same name (the integration set aside every cell, and
 * lang/qa-pipeline's relic words then set aside four of the cells measured again). Writing over the
 * earlier one would lose that record, so it is moved first to set-aside/before-<day>/, the day the
 * newer one is set aside.
 */
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Write `cell` (already carrying its `setAside` reason) as <aside>/<name>, `aside` being the
 * set-aside folder, and remove `from`, its file in cells/. Returns where an earlier cell of that
 * name was moved, or null.
 */
export function setAsideCell(aside: string, name: string, cell: object, from: string, day = new Date().toISOString().slice(0, 10)): string | null {
  mkdirSync(aside, { recursive: true });
  const dest = join(aside, name);
  let kept: string | null = null;
  if (existsSync(dest)) {
    const older = join(aside, `before-${day}`);
    kept = join(older, name);
    if (existsSync(kept)) throw new Error(`${kept} exists already; move one of the two cells of that name by hand, then set ${name} aside again`);
    mkdirSync(older, { recursive: true });
    renameSync(dest, kept);
  }
  writeFileSync(dest, JSON.stringify(cell, null, 1) + '\n');
  rmSync(from);
  return kept;
}
