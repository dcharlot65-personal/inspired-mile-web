import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { breakPoints } from '../src/lib/xr/line-break';
import { wrapUnits } from '../src/lib/xr/text-wrap';

/**
 * Right-to-left text on the theatre's canvas panels (src/lib/xr/text-wrap.ts).
 *
 * Babylon's TextBlock draws a line with fillText on a canvas whose direction is left to right, the line
 * being the pieces wrapUnits() gave it, joined. A right-to-left reader must see what a canvas set to
 * direction 'rtl' would draw. So every line of every Arabic interface sentence, filled in as the pages
 * fill it (a card's Latin name, the model's name, numbers: scripts/lang/samples.mjs), is drawn both ways
 * in this browser, and the pixels must be the same: whole, and cut where a panel might wrap it (the
 * trailing space of a wrapped line is drawn, as Babylon draws it, and is invisible either way).
 *
 * The check found on 2026-11-16 that 'Hamlet يكسب الجولة.' and 'حكم Gemma 4 E2B على هذا الجهاز.' were
 * drawn in the wrong order under the marks used then. Those marks, and no marks at all, are drawn here
 * too, as controls: the comparison must see them fail, or its silence about the real code means nothing.
 */
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const RLM = String.fromCharCode(0x200f);
const ARABIC = /\p{Script=Arabic}/u;

/** The marks used until 2026-11-17: RLM around each piece, and only when the first letter is Arabic. */
function oldUnits(line: string): string[] {
  const first = line.match(/\p{L}/u);
  const pieces = breakPoints(line);
  return first && ARABIC.test(first[0]) ? pieces.map((p) => RLM + p + RLM) : pieces;
}

type Case = { id: string; drawn: string; reference: string };

/** A line drawn whole, and its first half as a wrapped panel line would be. */
function cases(line: string, units: (l: string) => string[]): Case[] {
  const pieces = units(line);
  // LRM, RLM and the embedding and override marks, by code point (a file tool may write the characters themselves).
  const MARKS = new Set([0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e]);
  const strip = (s: string) => [...s].filter((c) => !MARKS.has(c.codePointAt(0)!)).join('');
  const out: Case[] = [{ id: line, drawn: pieces.join(''), reference: line.trimEnd() }];
  if (pieces.length >= 4) {
    const head = pieces.slice(0, Math.floor(pieces.length / 2)).join('');
    out.push({ id: `${line} [wrapped]`, drawn: head, reference: strip(head).trimEnd() });
  }
  return out;
}

/** The cases whose drawing differs from the right-to-left reference. */
async function mismatches(page: import('@playwright/test').Page, all: Case[]): Promise<Array<{ id: string; pixels: number }>> {
  return page.evaluate((all) => {
    const W = 4096;
    const H = 40;
    const ctx = () => {
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const x = c.getContext('2d', { willReadFrequently: true })!;
      x.font = '20px Georgia, serif';
      x.textBaseline = 'top';
      x.textAlign = 'left';
      x.fillStyle = '#000';
      return x;
    };
    const a = ctx();
    const b = ctx();
    const bad: Array<{ id: string; pixels: number }> = [];
    for (const { id, drawn, reference } of all) {
      a.clearRect(0, 0, W, H);
      b.clearRect(0, 0, W, H);
      a.direction = 'ltr'; // as Babylon's canvas is
      a.fillText(drawn, 4, 8);
      b.direction = 'rtl';
      b.fillText(reference, 4, 8);
      const da = a.getImageData(0, 0, W, H).data;
      const db = b.getImageData(0, 0, W, H).data;
      let n = 0;
      for (let i = 3; i < da.length; i += 4) if (da[i] !== db[i]) n++;
      if (n) bad.push({ id, pixels: n });
    }
    return bad;
  }, all);
}

test.describe('Theatre: right-to-left text', () => {
  test('every line of the Arabic interface is drawn as a right-to-left paragraph draws it', async ({ page }) => {
    test.setTimeout(Math.max(120_000, Number(process.env.E2E_TIMEOUT ?? 0)));
    const samples: Record<string, string[]> = JSON.parse(
      execFileSync(process.execPath, ['scripts/lang/samples.mjs', 'ar'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }),
    );
    const lines = [...new Set(Object.values(samples).flat().flatMap((s) => s.split('\n')).filter((l) => ARABIC.test(l) && l.trim()))];
    // Lines with Latin text in them are the ones the old marks got wrong; there must be some.
    const mixed = lines.filter((l) => /\p{Script=Latin}/u.test(l));
    expect(lines.length).toBeGreaterThan(400);
    expect(mixed.length).toBeGreaterThan(20);
    await page.setContent('<!doctype html><meta charset="utf-8"><body></body>');

    const now = await mismatches(page, lines.flatMap((l) => cases(l, (x) => wrapUnits(x, true))));
    expect(now, now.slice(0, 20).map((m) => `${m.pixels} px differ: ${m.id}`).join('\n')).toEqual([]);

    // Controls: the comparison sees the faults it is here for.
    const old = await mismatches(page, mixed.flatMap((l) => cases(l, oldUnits)));
    const none = await mismatches(page, lines.flatMap((l) => cases(l, breakPoints)));
    expect(old.length, 'the RLM marks used until 2026-11-17 got mixed lines wrong').toBeGreaterThan(10);
    expect(old.map((m) => m.id)).toEqual(expect.arrayContaining([expect.stringMatching(/Gemma 4 E2B/)]));
    expect(none.length, 'with no marks at all the full stops stand at the wrong end').toBeGreaterThan(100);
  });
});
