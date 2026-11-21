import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ECONOMY_LIVE } from './economy-live';

/**
 * The switch that says whether play pays (economy-live.ts) is held to the code: it is false exactly
 * while nothing in the front end calls the functions that pay or sell (earnCredits, addXP, buyPack),
 * so the pages cannot promise rewards nobody is paid, nor stay silent about ones that are.
 */
const ROOT = join(process.cwd(), 'src');
const PAYS = /\b(earnCredits|addXP|buyPack)\s*\(/g;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx|astro)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
  });
}

/** Every call of a paying function in the front end, as "file:line name" (definitions are not calls). */
function callers(): string[] {
  const found: string[] = [];
  for (const file of sources(ROOT)) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(PAYS)) {
      const before = text.slice(text.lastIndexOf('\n', m.index) + 1, m.index);
      if (/\bfunction\s*$/.test(before)) continue;
      found.push(`${relative(ROOT, file)}:${text.slice(0, m.index).split('\n').length} ${m[1]}`);
    }
  }
  return found;
}

describe('whether play pays', () => {
  it('ECONOMY_LIVE is true exactly when the front end calls something that pays credits or XP or sells a pack', () => {
    const calls = callers();
    expect(
      ECONOMY_LIVE,
      ECONOMY_LIVE
        ? 'ECONOMY_LIVE is true but nothing calls earnCredits, addXP or buyPack: the pages would promise rewards nobody is paid'
        : `something now pays or sells (${calls.join(', ')}): set ECONOMY_LIVE to true in src/lib/economy-live.ts, so the pages say so`,
    ).toBe(calls.length > 0);
  });

  it('finds a call, and does not count a definition', () => {
    expect('export async function addXP(source: string)'.match(PAYS)).not.toBeNull();
    const text = 'export async function addXP(source) {}\nvoid addXP(source);';
    const calls = [...text.matchAll(PAYS)].filter((m) => !/\bfunction\s*$/.test(text.slice(text.lastIndexOf('\n', m.index) + 1, m.index)));
    expect(calls).toHaveLength(1);
  });
});
