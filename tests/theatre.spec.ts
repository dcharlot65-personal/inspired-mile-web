import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { lineBreakFault } from '../src/lib/xr/line-break';
import { MODELS, usedAnywhere } from '../src/lib/brain';
import { setLists, standInModel, stubCount } from './stand-in-model';

/**
 * The 3D theatre. The scene is a canvas, so these tests drive it the way a
 * pointer would reach it (the action a picked mesh carries) and read the
 * session behind it, then check the canvas really drew something.
 *
 * The headset test installs Meta's WebXR emulator (iwer) as a Quest 3, so the
 * page sees a real navigator.xr and Babylon starts a real XRSession against
 * it. That proves session start-up and passthrough mode; it cannot prove
 * comfort, legibility or hand tracking on a physical headset.
 */

const IWER = fileURLToPath(new URL('../node_modules/iwer/build/iwer.min.js', import.meta.url));

async function drawnPixels(page: import('@playwright/test').Page): Promise<number> {
  // Count distinct colours in a screenshot of the canvas: a blank canvas has one.
  const shot = await page.locator('#theatre-canvas').screenshot();
  return new Set(shot.toString('base64').match(/.{1,24}/g)).size;
}

test.describe('Theatre', () => {
  test('a flat-screen duel plays through the 3D stage', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/theatre?seed=11&brain=rules');
    await page.waitForFunction(() => (window as any).__theatre?.session?.phase === 'player-turn');
    expect(await drawnPixels(page)).toBeGreaterThan(50);

    const first = await page.evaluate(() => (window as any).__theatre.session.duel.player.characters[0]);
    await page.evaluate((id) => (window as any).__theatre.act({ type: 'character', id }), first);
    await page.fill('#typed-verse', 'Who dares to stand upon my stage?\nI put the question to thy rage');
    expect(await page.evaluate(() => (window as any).__theatre.session.blocked())).toBeNull();

    await page.evaluate(() => (window as any).__theatre.act({ type: 'submit' }));
    await page.waitForFunction(() => (window as any).__theatre.session.phase === 'verdict');
    const state = await page.evaluate(() => {
      const s = (window as any).__theatre.session;
      return { results: s.results.length, winner: s.results[0].winner, total: s.results[0].playerTotal };
    });
    expect(state.results).toBe(1);
    expect(['player', 'opponent']).toContain(state.winner);

    await page.evaluate(() => (window as any).__theatre.act({ type: 'next' }));
    await page.waitForFunction(() => (window as any).__theatre.session.phase === 'player-turn');
    expect(await page.evaluate(() => (window as any).__theatre.session.roundIndex)).toBe(1);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  // The theatre starts a duel as the page opens. Counted then, a visitor who only looked at the page had
  // "Opening Act: complete your first battle" unlocked (seen in the 2026-11-18 screenshots, in every language).
  test('a duel counts as a battle when it ends, not when the page opens it', async ({ page }) => {
    await page.goto('/theatre?seed=11&brain=rules');
    await page.waitForFunction(() => (window as any).__theatre?.session?.phase === 'player-turn');
    await page.waitForTimeout(500);
    const battles = () => page.evaluate(() => JSON.parse(localStorage.getItem('inspired-mile-player-stats') ?? '{}').totalBattles ?? 0);
    expect(await battles()).toBe(0);
    await expect(page.locator('#achievement-toasts')).not.toContainText('Opening Act');
    for (let round = 0; round < 3; round++) {
      const phase = await page.evaluate(() => (window as any).__theatre.session.phase);
      if (phase === 'finished') break;
      const id = await page.evaluate(() => {
        const s = (window as any).__theatre.session;
        return s.duel.player.characters.find((c: string) => !s.characterUsed(c));
      });
      await page.evaluate((c) => (window as any).__theatre.act({ type: 'character', id: c }), id);
      await page.fill('#typed-verse', 'Who dares to stand upon my stage?\nI put the question to thy rage');
      await page.evaluate(() => (window as any).__theatre.act({ type: 'submit' }));
      await page.waitForFunction(() => (window as any).__theatre.session.phase === 'verdict');
      expect(await battles()).toBe(0);
      await page.evaluate(() => (window as any).__theatre.act({ type: 'next' }));
      await page.waitForFunction(() => ['player-turn', 'finished'].includes((window as any).__theatre.session.phase));
    }
    await page.waitForFunction(() => (window as any).__theatre.session.phase === 'finished');
    expect(await battles()).toBe(1);
  });

  test('clicking a card on the canvas picks it', async ({ page }) => {
    await page.goto('/theatre?seed=11&brain=rules');
    await page.waitForFunction(() => (window as any).__theatre?.session?.phase === 'player-turn');
    await page.locator('#theatre-canvas').scrollIntoViewIfNeeded();
    // Find a point on screen that the scene itself says is on the first hand card.
    const point = await page.evaluate(() => {
      const { theatre, session } = (window as any).__theatre;
      const id = session.duel.player.characters[0];
      const engine = theatre.engine;
      const w = engine.getRenderWidth();
      const h = engine.getRenderHeight();
      const rect = engine.getRenderingCanvas().getBoundingClientRect();
      const hits: Array<[number, number]> = [];
      for (let y = 0.02; y < 1; y += 0.02) for (let x = 0.02; x < 1; x += 0.02) {
        if (theatre.scene.pick(x * w, y * h)?.pickedMesh?.name === `hand-${id}`) hits.push([x, y]);
      }
      if (!hits.length) return null;
      const [x, y] = hits[Math.floor(hits.length / 2)];
      return { x: rect.left + x * rect.width, y: rect.top + y * rect.height, id };
    });
    expect(point, 'the first hand card must be on screen').not.toBeNull();
    await page.mouse.click(point!.x, point!.y);
    await expect.poll(() => page.evaluate(() => (window as any).__theatre.session.move.charId)).toBe(point!.id);
  });

  test('offers no headset button where there is no WebXR', async ({ page }) => {
    await page.goto('/theatre?seed=11&brain=rules');
    await page.waitForFunction(() => (window as any).__theatre?.session);
    await expect(page.locator('#enter-xr')).toBeHidden();
  });

  test('as an emulated Quest 3: offers passthrough and starts an immersive session', async ({ page }) => {
    await page.addInitScript({ path: IWER });
    await page.addInitScript(() => {
      const { XRDevice, metaQuest3 } = (window as any).IWER;
      // Chromium ships its own navigator.xr, which reports no headset; without removing it
      // the emulator's runtime is installed but never seen (found by probing, 2026-11-16).
      delete (Navigator.prototype as any).xr;
      const device = new XRDevice(metaQuest3);
      device.installRuntime();
      (window as any).__xrDevice = device;
    });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    // Nothing may be fetched from another origin once the headset session starts.
    const foreign: string[] = [];
    page.on('request', (r) => { if (!r.url().startsWith('http://localhost') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) foreign.push(r.url()); });
    await page.goto('/theatre?seed=11&brain=rules');
    await page.waitForFunction(() => (window as any).__theatre?.session?.phase === 'player-turn');

    const btn = page.locator('#enter-xr');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('Enter: stage in your room');
    // Count only what the session itself fetches; the page's own analytics script loaded earlier.
    foreign.length = 0;
    await btn.click();
    await expect.poll(() => page.evaluate(() => (window as any).__theatre.theatre.mode), { timeout: 20000 }).toBe('immersive-ar');
    await expect(page.locator('#theatre-status')).toContainText('passthrough');
    // In passthrough the stage set is hidden and the typing box, useless in a headset, goes away.
    expect(await page.evaluate(() => (window as any).__theatre.theatre.scene.getMeshByName('curtain').isEnabled())).toBe(false);
    await expect(page.locator('#typed')).toBeHidden();

    // The duel still plays inside the session.
    const first = await page.evaluate(() => (window as any).__theatre.session.duel.player.characters[0]);
    await page.evaluate((id) => (window as any).__theatre.act({ type: 'character', id }), first);
    expect(await page.evaluate(() => (window as any).__theatre.session.move.charId)).toBe(first);

    await page.evaluate(() => (window as any).__theatre.theatre.exitXR());
    await expect.poll(() => page.evaluate(() => (window as any).__theatre.theatre.mode)).toBe('flat');
    expect(errors, errors.join('\n')).toEqual([]);
    expect(foreign, 'requests to other origins').toEqual([]);
  });
  // What the panels draw, read back from Babylon (TextBlock.lines): at every place a line was wrapped
  // (not an explicit new line of the text), no closing punctuation opens the next line and no opening
  // bracket ends the one before (src/lib/xr/line-break.ts). The check saw "。" open a line of the
  // Japanese rules panel and "（" close one.
  for (const lang of ['ja', 'zh', 'th'] as const) {
    test(`${lang}: the panels wrap their lines where the script allows`, async ({ page }) => {
      await page.addInitScript((l) => {
        localStorage.setItem('inspired-mile-locale', l);
        localStorage.setItem('inspired-mile-duel-lang', l);
      }, lang);
      await page.goto('/theatre?seed=11&brain=rules');
      await page.waitForFunction(() => (window as any).__theatre?.session?.phase === 'player-turn', undefined, { timeout: 120_000 });
      const first = await page.evaluate(() => (window as any).__theatre.session.duel.player.characters[0]);
      await page.evaluate((id) => (window as any).__theatre.act({ type: 'character', id }), first);
      // A verse long enough that its panel must wrap it, with the punctuation the rules are about.
      const verse = {
        ja: '古池や蛙飛び込む水の音、お前の言葉は「風」のように消えていく。（舞台の上で）誰も聞いてはいない！\n月の光が落ちてくる、静かな夜の終わりに。',
        zh: '床前明月光，疑是地上霜。举头望明月，低头思故乡。（李白《静夜思》）你的诗句像风一样，吹过舞台就不见了！\n月光落在台上，没有人听你说话。',
        th: 'ดวงจันทร์ส่องฟ้าสว่างไสวในคืนที่เงียบเหงา เด็กๆ เล่นกันอยู่ริมฝั่งแม่น้ำ (ใต้แสงจันทร์) ลมพัดผ่านมาเบาๆ ใจข้าไม่หวั่นไหวเลยแม้แต่น้อย\nถ้อยคำของเจ้าหายไปกับสายลมยามค่ำคืน',
      }[lang];
      await page.fill('#typed-verse', verse);
      const read = () =>
        page.evaluate(() => {
          const t = (window as any).__theatre.theatre;
          return Object.entries(t.panels as Record<string, any>).map(([name, p]) => ({ name, text: String(p.text.text ?? ''), lines: ((p.text.lines ?? []) as Array<{ text: string }>).map((l) => l.text) }));
        });
      const drawn: Array<{ name: string; text: string; lines: string[] }> = [];
      await expect.poll(async () => (await read()).find((p) => p.name === 'round')?.lines.length ?? 0, { timeout: 20_000 }).toBeGreaterThan(1);
      await expect.poll(async () => (await read()).find((p) => p.name === 'verse')?.lines.length ?? 0, { timeout: 20_000 }).toBeGreaterThan(2);
      drawn.push(...(await read()));
      await page.evaluate(() => (window as any).__theatre.act({ type: 'submit' }));
      await page.waitForFunction(() => (window as any).__theatre.session.phase === 'verdict', undefined, { timeout: 60_000 });
      await expect.poll(async () => (await read()).find((p) => p.name === 'verdict')?.lines.length ?? 0, { timeout: 20_000 }).toBeGreaterThan(1);
      drawn.push(...(await read()).filter((p) => p.name === 'verdict'));
      let wraps = 0;
      const faults: string[] = [];
      for (const p of drawn) {
        for (let i = 0; i + 1 < p.lines.length; i++) {
          const [a, b] = [p.lines[i], p.lines[i + 1]];
          if (!a || !b || !p.text.includes(a + b)) continue;
          wraps++;
          const f = lineBreakFault(a, b);
          if (f) faults.push(`${p.name}: ${f} | ${a} | ${b}`);
        }
      }
      // The check can see something: the verse panel wraps the long verse in every one of the three languages.
      expect(wraps).toBeGreaterThan(0);
      expect(faults).toEqual([]);

      // Where a panel wraps depends on the font, so one text may never put its punctuation at a break.
      // A sweep does: text dense with punctuation, shifted one character at a time, so that every
      // character of it comes to stand at the panel's edge.
      const dense = { ja: 'お前の詩は、細い。舞台は「私」のものだ！', zh: '你的诗，很弱。舞台是《我的》！', th: 'เด็กๆ เล่นกัน ฯลฯ (ใต้แสงจันทร์) ' }[lang];
      const pad = { ja: 'あ', zh: '的', th: 'ก' }[lang];
      const swept = await page.evaluate(
        async ({ dense, pad }) => {
          const panel = (window as any).__theatre.theatre.panels.verse.text;
          const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const out: Array<{ text: string; lines: string[] }> = [];
          for (let k = 0; k < 24; k++) {
            const text = pad.repeat(k) + dense.repeat(4);
            panel.text = text;
            await frame();
            out.push({ text, lines: ((panel.lines ?? []) as Array<{ text: string }>).map((l) => l.text) });
          }
          return out;
        },
        { dense, pad },
      );
      let sweptWraps = 0;
      const sweptFaults: string[] = [];
      for (const p of swept) {
        for (let i = 0; i + 1 < p.lines.length; i++) {
          const [a, b] = [p.lines[i], p.lines[i + 1]];
          if (!a || !b || !p.text.includes(a + b)) continue;
          sweptWraps++;
          const f = lineBreakFault(a, b);
          if (f) sweptFaults.push(`${f} | ${a} | ${b}`);
        }
      }
      expect(sweptWraps).toBeGreaterThan(24);
      expect(sweptFaults.slice(0, 5)).toEqual([]);
    });
  }
});

/**
 * The theatre's judging line, which the verdict panel shows, follows the loaded model's lists for
 * the duel's language: "judged by" the model only where it judges, and where it does not, the
 * rules, with the reason. The model is the stand-in of stand-in-model.ts (it answers the judge's
 * reading and counts each one); the lists are set here, in the page's own brain module. The
 * theatre loads only a model the player already chose (brain.ts rememberedModel), and a choice of
 * a model it is not offered loads nothing.
 */
test.describe('Theatre: who judges', () => {
  test.use({ serviceWorkers: 'block' });

  test("the verdict panel's judging line follows the lists for the duel's language", async ({ page }) => {
    test.skip(!usedAnywhere(MODELS.grand), 'Gemma 4 E2B is used in no language (the measured lists), so the theatre loads no model at all');
    await standInModel(page);
    await page.addInitScript(() => {
      localStorage.setItem('inspired-mile-brain', 'grand');
      localStorage.setItem('inspired-mile-duel-lang', 'en');
    });
    await page.goto('/theatre?seed=11');
    await page.waitForFunction(() => (window as any).__theatre?.session?.phase === 'player-turn', undefined, { timeout: 60_000 });
    await expect(page.locator('#theatre-status')).toContainText('Gemma 4 E2B');
    const verses = ['Who dares to stand upon my stage?\nI put the question to thy rage', 'The night is cold and clear\nI sing of what was here'];
    const cases = [
      { judges: true, line: 'Judged by Gemma 4 E2B on this device.' },
      { judges: false, line: 'English: judged by rule, because Gemma 4 E2B has not shown it is a good judge of verse in this language.' },
    ];
    for (const [i, c] of cases.entries()) {
      await setLists(page, 'grand', [], c.judges ? ['en'] : []);
      const before = (await stubCount(page)).readings;
      const id = await page.evaluate((k) => (window as any).__theatre.session.duel.player.characters[k], i);
      await page.evaluate((x) => (window as any).__theatre.act({ type: 'character', id: x }), id);
      await page.fill('#typed-verse', verses[i]);
      await page.evaluate(() => (window as any).__theatre.act({ type: 'submit' }));
      await page.waitForFunction(() => (window as any).__theatre.session.phase === 'verdict', undefined, { timeout: 60_000 });
      const panel = await page.evaluate(() => (window as any).__theatre.theatre.panels.verdict.text.text as string);
      expect(panel, `round ${i + 1}`).toContain(c.line);
      expect((await stubCount(page)).readings - before, `round ${i + 1}: readings asked of the model`).toBe(c.judges ? 8 : 0);
      // After one round the match cannot be over; after the last case it may be, and nothing follows.
      if (i === cases.length - 1) break;
      await page.evaluate(() => (window as any).__theatre.act({ type: 'next' }));
      await page.waitForFunction(() => (window as any).__theatre.session.phase === 'player-turn', undefined, { timeout: 60_000 });
    }
  });

  test('a stored choice of a model this device is not offered loads nothing', async ({ page }) => {
    await standInModel(page);
    // A desktop with memory to spare is offered Gemma and LFM3, never LFM2.5.
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'deviceMemory', { configurable: true, get: () => 16 });
      localStorage.setItem('inspired-mile-brain', 'lite');
    });
    await page.goto('/theatre?seed=11');
    await page.waitForFunction(() => (window as any).__theatre?.session?.phase === 'player-turn', undefined, { timeout: 60_000 });
    expect((await stubCount(page)).loads).toEqual([]);
    await expect(page.locator('#theatre-status')).not.toContainText('LFM');
  });
});
