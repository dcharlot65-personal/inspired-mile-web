import { test, expect, type Page } from '@playwright/test';
import { MODELS, usedAnywhere } from '../src/lib/brain';
import { setLists, standInModel, stubCount } from './stand-in-model';

/**
 * The verse duel, played end to end against the written opponent.
 *
 * The test browser has no WebGPU, so no model loads: the opponent plays from
 * its written bank and the judging is by rule. With a fixed seed and deck the
 * whole match is deterministic, which is what lets these tests assert scores.
 * Playing against a real model is covered by tests/model/.
 */

const DECK = { name: 'Test deck', characters: ['DC-001', 'MO-001', 'CA-001'], relics: ['RL-001'], potions: ['PT-002'] };

/** A verse that keeps each form, asks a question (Hamlet's device) and echoes "question" (his signature). */
const VERSES: Record<string, string> = {
  Couplet: 'Who dares to stand upon my stage?\nI put the question to thy rage',
  'Paired Quatrain': 'Who dares to stand upon my stage?\nI put the question to thy rage\nThy candle gutters in the night\nAnd mine shall be the only light',
  'Crossed Quatrain': 'Who dares to stand upon my stage?\nThy candle gutters in the night\nI put the question to thy rage\nAnd mine shall be the only light',
  Tercet: 'Who dares to stand upon my stage?\nI put the question plainly now\nAnd wait in vain to hear thy rage',
  Anaphora: 'Who dares to stand upon my stage?\nWho brings a candle to the sun?\nWho answers when the question comes?',
  Crescendo: 'Who dares?\nI put the question\nAnd none of thy poor lines can answer it tonight',
  Haiku: 'Who dares to stand here?\nI put the question to thee\nThe night will not speak',
  'Heroic Couplet': 'Who dares to stand upon my midnight stage?\nI put the question to thy empty rage',
};
const ACROSTIC: Record<string, string> = { B: 'Bold?', A: 'A question waits', R: 'Rage on', D: 'Down thou goest', M: 'Mine?', O: 'Only a question', N: 'Never mind', K: 'Kneel?', I: 'I put the question', G: 'Go', S: 'Stand?', E: 'Every question waits', F: 'Fear?', T: 'This question stands', W: 'Who dares?', P: 'Pray, a question', L: 'Lost?', Y: 'Yield' };

/** A verse for whatever form the round drew. */
async function verseFor(page: Page): Promise<string> {
  const name = (await page.locator('#form-name').innerText()).trim();
  if (name === 'Acrostic') {
    const word = (await page.locator('#form-brief').innerText()).match(/spell ([A-Z]+)/)![1];
    return [...word].map((ch) => ACROSTIC[ch]).join('\n');
  }
  return VERSES[name];
}

async function open(page: Page, seed = 11) {
  await page.addInitScript((deck) => {
    localStorage.setItem('inspired-mile-decks', JSON.stringify([deck]));
    localStorage.setItem('inspired-mile-active-deck', deck.name);
  }, DECK);
  await page.goto(`/battle?seed=${seed}&brain=rules`);
  await expect(page.locator('#start-duel')).toBeEnabled();
}

async function start(page: Page) {
  await page.click('#start-duel');
  await expect(page.locator('#battle-arena')).toBeVisible();
  await expect(page.locator('#opponent-verse')).not.toHaveText('…');
}

test.describe('Verse duel', () => {
  test('set-up shows the saved deck and says no model is running', async ({ page }) => {
    await open(page);
    await expect(page.locator('#deck-name')).toHaveText('Test deck');
    await expect(page.locator('#deck-cards > div')).toHaveCount(5);
    await expect(page.locator('#brain-status')).toContainText(/written/i);
  });

  test('without a model every language is offered, each against the written opponent, with nothing to explain', async ({ page }) => {
    await open(page);
    const options = page.locator('#language option');
    await expect(options).toHaveCount(16);
    // No model is loaded, so no language is marked: the status line already says the opponent is written.
    expect(await options.evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).dataset.opponent))).toEqual(Array(16).fill('written'));
    expect(await options.evaluateAll((os) => os.filter((o) => o.textContent!.includes('·')).length)).toBe(0);
    await expect(page.locator('#language-note')).toBeHidden();
    await page.selectOption('#language', 'th');
    await expect(page.locator('#language-note')).toBeHidden();
    await expect(page.locator('#language-note')).toHaveAttribute('data-writer', 'written');
    await expect(page.locator('#language-note')).toHaveAttribute('data-judge', 'rules');
  });

  test('a round shows the form, the opponent, its verse and a live checklist', async ({ page }) => {
    await open(page);
    await start(page);
    await expect(page.locator('#round-label')).toHaveText('Round 1 of 3');
    await expect(page.locator('#form-name')).not.toBeEmpty();
    await expect(page.locator('#opponent-name')).not.toBeEmpty();
    expect((await page.locator('#opponent-verse').innerText()).trim().split('\n').length).toBeGreaterThanOrEqual(2);
    await expect(page.locator('#ink')).toHaveText('2');
    await expect(page.locator('#submit-verse')).toBeDisabled();

    await page.click('[data-char-id="DC-001"]');
    await expect(page.locator('#live-checks li')).not.toHaveCount(1);
    await expect(page.locator('#live-craft')).toHaveText('0');
    await page.fill('#verse-input', await verseFor(page));
    await expect(page.locator('#submit-verse')).toBeEnabled();
    // Hamlet's house device is the question, and "question" echoes his line.
    await expect(page.locator('#live-checks')).toContainText('The Question');
    await expect(page.locator('#live-checks li', { hasText: 'The Question' }).locator('span').first()).toHaveText('✓');
    await expect(page.locator('#live-checks li', { hasText: 'Signature' }).locator('span').first()).toHaveText('✓');
    // Form kept (20) with the device and the signature both landed. Seed 11 opens with an acrostic,
    // and this one says little beyond them: four words of its own ("pray", "lost", "waits", "yield")
    // for four lines, where a multiplier applies in full from 1.5 a line (duel.ts OWN_WORDS_PER_LINE),
    // so ×1.67, not ×2.
    await expect(page.locator('#live-craft')).toHaveText('33');
  });

  test('spending ink on a relic and a potion empties the well and shows the power words', async ({ page }) => {
    await open(page);
    await start(page);
    await page.click('[data-char-id="DC-001"]');
    await page.click('[data-item-id="RL-001"]');
    await expect(page.locator('#ink')).toHaveText('1');
    await expect(page.locator('#live-checks')).toContainText('Power words');
    await page.click('[data-item-id="PT-002"]');
    await expect(page.locator('#ink')).toHaveText('0');
    await page.click('[data-item-id="RL-001"]');
    await expect(page.locator('#ink')).toHaveText('1');
    await expect(page.locator('#live-checks')).not.toContainText('Power words');
  });

  test('a full match: three rounds, a verdict each, a result, and stats that move', async ({ page }) => {
    await open(page);
    await start(page);
    const chars = ['DC-001', 'MO-001', 'CA-001'];
    const winsStored = () => page.evaluate(() => JSON.parse(localStorage.getItem('inspired-mile-player-stats') ?? '{}').battleWins ?? 0);
    let roundsWon = 0;
    for (let round = 0; round < 3; round++) {
      await expect(page.locator('#round-label')).toHaveText(`Round ${round + 1} of 3`);
      // A character already played cannot be played again.
      if (round > 0) await expect(page.locator(`[data-char-id="${chars[round - 1]}"]`)).toHaveClass(/pointer-events-none/);
      await page.click(`[data-char-id="${chars[round]}"]`);
      await page.fill('#verse-input', await verseFor(page));
      await page.click('#submit-verse');
      const verdict = page.locator('#verdict');
      await expect(verdict).toBeVisible();
      await expect(verdict).toHaveAttribute('data-winner', /player|opponent/);
      await expect(verdict).toContainText('Round score');
      await expect(verdict).toContainText('Judged by rule');
      if ((await verdict.getAttribute('data-winner')) === 'player') roundsWon += 1;
      // A round won is not a battle won (until 2026-11-19 every round won was counted as one).
      expect(await winsStored(), 'battle wins after a round').toBe(0);
      if (await page.locator('#next-round').innerText() === 'See the result') break;
      await page.click('#next-round');
      await expect(page.locator('#opponent-verse')).not.toHaveText('…');
    }
    await page.click('#next-round');
    await expect(page.locator('#verdict')).toHaveAttribute('data-match', /player|opponent/);
    await expect(page.locator('#duel-again')).toBeVisible();
    expect(Number(await page.locator('#rounds-played').innerText())).toBeGreaterThanOrEqual(2);
    await expect(page.locator('#battles-total')).toHaveText('1');
    // A win is a match: one battle won, or none, whatever the rounds.
    const won = (await page.locator('#verdict').getAttribute('data-match')) === 'player';
    expect(roundsWon, 'the player takes a round in this duel, so rounds and matches can be told apart').toBeGreaterThan(0);
    expect(await winsStored()).toBe(won ? 1 : 0);
    // Signed out, a match won pays a card for this device's own collection.
    await expect(page.locator('#battle-reward')).toHaveCount(won ? 1 : 0);
  });

  test('the same seed draws the same forms and the same opening verse', async ({ page }) => {
    await open(page, 2024);
    await start(page);
    const first = [await page.locator('#form-name').innerText(), await page.locator('#opponent-name').innerText(), await page.locator('#opponent-verse').innerText()];
    await open(page, 2024);
    await start(page);
    expect([await page.locator('#form-name').innerText(), await page.locator('#opponent-name').innerText(), await page.locator('#opponent-verse').innerText()]).toEqual(first);
  });

  test('an empty verse cannot be submitted and markup in a verse is shown as text', async ({ page }) => {
    await open(page);
    await start(page);
    await page.click('[data-char-id="DC-001"]');
    await page.fill('#verse-input', '   \n  ');
    await expect(page.locator('#submit-verse')).toBeDisabled();
    await page.fill('#verse-input', '<img src=x onerror="window.__pwned=1">\n<b>bold</b> rage');
    await page.click('#submit-verse');
    await expect(page.locator('#verdict')).toContainText('<b>bold</b> rage');
    expect(await page.evaluate(() => (window as any).__pwned)).toBeUndefined();
    await expect(page.locator('#verdict img')).toHaveCount(0);
  });

  test('without a saved deck a starter deck is dealt', async ({ page }) => {
    await page.goto('/battle?seed=3&brain=rules');
    await expect(page.locator('#deck-name')).toHaveText('Starter deck');
    await expect(page.locator('#deck-cards > div')).toHaveCount(5);
    await expect(page.locator('#start-duel')).toBeEnabled();
  });
});

/**
 * With a model loaded, the language picker says where it is not used: beside a language the
 * model does not write in, "Written opponent"; under the picker, why, for writing and for
 * judging. The model is a stand-in (this browser has no WebGPU): navigator.gpu and the
 * Transformers.js module are stubbed as in pwa.spec.ts, so loadBrain's own success path runs
 * and brainInfo() is the real MODELS entry with its measured lists.
 */
test.describe('Language picker with a model loaded', () => {
  test.use({ serviceWorkers: 'block' });
  const STUB = `
export async function pipeline() { const g = async () => [{ generated_text: [{ role: 'assistant', content: 'stub verse' }] }]; g.tokenizer = {}; g.dispose = async () => {}; return g; }
export class TextStreamer {}
export const env = { backends: { onnx: { wasm: { wasmPaths: {
  mjs: 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs',
  wasm: 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm',
} } } } };`;

  test('marks each language the loaded model does not write in, and says why under the picker', async ({ page }) => {
    const m = MODELS.grand;
    const all = ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ar', 'hi', 'zh', 'ja', 'ko', 'vi', 'th', 'id'];
    const both = all.find((l) => m.writesIn.includes(l) && m.judgesIn.includes(l));
    const writesOnly = all.find((l) => m.writesIn.includes(l) && !m.judgesIn.includes(l));
    const neither = all.find((l) => !m.writesIn.includes(l) && !m.judgesIn.includes(l));
    // With the measured lists each kind exists; a test that met none of them would prove nothing.
    expect([both, writesOnly, neither].filter(Boolean).length, 'languages of each kind in the measured lists').toBeGreaterThanOrEqual(2);

    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'gpu', { configurable: true, get: () => ({ requestAdapter: async () => ({ features: new Set(['shader-f16']) }) }) });
    });
    await page.route(/huggingface[_/]transformers/, (route) => route.fulfill({ contentType: 'text/javascript', body: STUB }));
    await page.goto('/battle?brain=grand&seed=11');
    await expect(page.locator('#brain-status')).toContainText(`${m.label} is loaded`);

    const options = page.locator('#language option');
    await expect(options).toHaveCount(16);
    // Each language sits under the heading of who writes there; the option itself is the language's
    // name alone, so the chosen one is never cut short on a phone ("Thailändisch · Gegner mit…").
    const marks = await options.evaluateAll((os) => os.map((o) => [(o as HTMLOptionElement).value, (o as HTMLOptionElement).dataset.opponent, (o.parentElement as HTMLOptGroupElement).label ?? null, o.textContent]));
    for (const [code, opponent, heading, text] of marks) {
      const writes = m.writesIn.includes(code as string);
      expect(opponent, `${code}: who writes`).toBe(writes ? 'model' : 'written');
      expect(heading, `${code}: the group it is listed under`).toBe(writes ? `${m.label} · on this device` : 'Written opponent');
      expect(text, `${code}: the option is the language's name alone`).not.toContain('·');
    }
    // The note describes the picker; inside its label it would become part of the picker's name.
    await expect(page.locator('label #language-note')).toHaveCount(0);
    await expect(page.locator('#language')).toHaveAttribute('aria-describedby', 'language-note');

    const note = page.locator('#language-note');
    if (both) {
      await page.selectOption('#language', both);
      await expect(note).toBeHidden();
      await expect(note).toHaveAttribute('data-writer', 'model');
      await expect(note).toHaveAttribute('data-judge', 'model');
    }
    if (writesOnly) {
      await page.selectOption('#language', writesOnly);
      await expect(note).toBeVisible();
      await expect(note).toHaveAttribute('data-writer', 'model');
      await expect(note).toHaveAttribute('data-judge', 'rules');
      await expect(note).toContainText(`judged by rule, because ${m.label} has not shown it is a good judge of verse`);
      await expect(note).not.toContainText('written opponent');
    }
    if (neither) {
      await page.selectOption('#language', neither);
      await expect(note).toBeVisible();
      await expect(note).toHaveAttribute('data-writer', 'written');
      await expect(note).toHaveAttribute('data-judge', 'rules');
      await expect(note).toContainText(`you face the written opponent, because ${m.label} has not shown it can write verse well`);
      await expect(note).toContainText('judged by rule');
      // Two facts, two lines: nothing joins them, so Chinese and Japanese get no space after 。
      await expect(note.locator(':scope > span')).toHaveCount(2);
    }
  });

  test('in a Chinese or Japanese interface the two lines of the note carry no space after the full stop', async ({ page }) => {
    // A model and a language it neither writes nor judges in, so the note has both lines. ?brain= loads
    // any model, used anywhere or not; the lists decide which pair there is.
    const all = ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ar', 'hi', 'zh', 'ja', 'ko', 'vi', 'th', 'id'];
    const pick = (['grand', 'standard', 'lite'] as const).flatMap((tier) => all.filter((l) => !MODELS[tier].writesIn.includes(l) && !MODELS[tier].judgesIn.includes(l)).map((l) => ({ tier, l })))[0];
    expect(pick, 'a model and a language with a two-line note').toBeTruthy();
    const { tier, l: neither } = pick!;
    const m = MODELS[tier];
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'gpu', { configurable: true, get: () => ({ requestAdapter: async () => ({ features: new Set(['shader-f16']) }) }) });
    });
    await page.route(/huggingface[_/]transformers/, (route) => route.fulfill({ contentType: 'text/javascript', body: STUB }));
    for (const ui of ['ja', 'zh']) {
      await page.addInitScript((l) => localStorage.setItem('inspired-mile-locale', l), ui);
      await page.goto(`/battle?brain=${tier}&seed=11`);
      await expect(page.locator('html')).toHaveAttribute('lang', ui);
      await expect(page.locator('#brain-status')).toContainText(m.label);
      await page.selectOption('#language', neither!);
      const note = page.locator('#language-note');
      await expect(note.locator(':scope > span')).toHaveCount(2);
      const text = await note.evaluate((n) => n.textContent ?? '');
      expect(text, `${ui}: the note as read`).toContain('。');
      expect(text, `${ui}: no space after a full stop`).not.toMatch(/。\s/);
    }
  });
});

/**
 * Who writes and who judges, as the page shows it and plays it, in the duel's language. The model
 * is a stand-in that answers the judge's next-token reading (so the page's own referee runs and a
 * round is judged "by the model") and counts every verse it is asked to write. The lists are set
 * here, in the page's own brain module, so the page's gates are tested whatever the measured lists
 * hold: the badge, the note under the picker, whether the model is asked to write, and the line
 * under the verdict.
 */
test.describe('Who writes and who judges, in the duel\'s language', () => {
  test.use({ serviceWorkers: 'block' });
  const VERSE: Record<string, string> = {
    en: 'The night is cold and clear\nI sing of what was here',
    de: 'Die Nacht ist kalt und klar\nich singe, was einst war',
    fr: 'La nuit descend sur la mer\net je chante dans les airs',
  };
  // Gemma writes English only and judges German only, here.
  const CASES = [
    { lang: 'en', writes: true, judges: false, badge: 'Gemma 4 E2B · on this device', verdict: 'English: judged by rule, because Gemma 4 E2B has not shown it is a good judge of verse in this language.' },
    { lang: 'de', writes: false, judges: true, badge: 'Written opponent · judged by Gemma 4 E2B', verdict: 'Judged by Gemma 4 E2B on this device, reading the verses in both orders.' },
    { lang: 'fr', writes: false, judges: false, badge: 'Written opponent', verdict: 'French: judged by rule, because Gemma 4 E2B has not shown it is a good judge of verse in this language.' },
  ];
  for (const c of CASES) {
    test(`${c.lang}: the model ${c.writes ? 'writes' : 'does not write'} and ${c.judges ? 'judges' : 'does not judge'}, and the page says so`, async ({ page }) => {
      await standInModel(page);
      await page.goto('/battle?brain=grand&seed=11');
      await expect(page.locator('#brain-status')).toContainText('Gemma 4 E2B is loaded');
      await setLists(page, 'grand', ['en'], ['de']);
      await page.selectOption('#language', c.lang);
      await expect(page.locator('#ai-model-badge')).toHaveText(c.badge);
      await expect(page.locator('#language-note')).toHaveAttribute('data-writer', c.writes ? 'model' : 'written');
      await expect(page.locator('#language-note')).toHaveAttribute('data-judge', c.judges ? 'model' : 'rules');

      await page.click('#start-duel');
      await expect(page.locator('#battle-arena')).toBeVisible();
      await expect(page.locator('#opponent-verse')).toHaveAttribute('data-source', /written|model/, { timeout: 60_000 });
      const wrote = (await stubCount(page)).generations;
      if (c.writes) expect(wrote, 'drafts the model was asked to write').toBeGreaterThan(0);
      else expect(wrote, 'drafts the model was asked to write').toBe(0);
      await expect(page.locator('#ai-model-badge')).toHaveText(c.badge);

      await page.click('[data-char-id]:not(.pointer-events-none)');
      await page.fill('#verse-input', VERSE[c.lang]);
      await page.click('#submit-verse');
      const verdict = page.locator('#verdict');
      await expect(verdict).toBeVisible({ timeout: 60_000 });
      await expect(verdict).toContainText(c.verdict);
      const read = (await stubCount(page)).readings;
      if (c.judges) expect(read, 'readings asked of the model').toBe(8);
      else expect(read, 'readings asked of the model').toBe(0);
    });
  }
});

/**
 * The model panel offers only models measured to write or judge in some language
 * (docs/language/MODEL-EVAL.md). The browser is made to report a GPU; no model is
 * downloaded, because nothing is clicked and no earlier choice is stored.
 */
test.describe('Model panel', () => {
  // The stand-in model library is served by page.route, which a service worker would go round.
  test.use({ serviceWorkers: 'block' });
  const fakeDevice = (page: Page, handheld: boolean) =>
    page.addInitScript((h) => {
      Object.defineProperty(Navigator.prototype, 'gpu', { configurable: true, get: () => ({ requestAdapter: async () => ({ features: new Set(['shader-f16']) }) }) });
      Object.defineProperty(Navigator.prototype, 'deviceMemory', { configurable: true, get: () => (h ? 4 : 16) });
      if (h) Object.defineProperty(Navigator.prototype, 'userAgent', { configurable: true, get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' });
    }, handheld);

  for (const [name, handheld, runnable] of [['a desktop', false, ['grand', 'standard']], ['a phone', true, ['lite']]] as const) {
    test(`${name} is offered the models it can run that are used in some language, and no others`, async ({ page }) => {
      await fakeDevice(page, handheld);
      const offers = runnable.map((t) => MODELS[t]).filter(usedAnywhere);
      await page.goto('/battle?seed=11');
      if (!offers.length) {
        await expect(page.locator('#brain-status')).toContainText('No model this device can run has shown');
        await expect(page.locator('#brain-choices')).toBeHidden();
        await expect(page.locator('#start-duel')).toBeEnabled();
      } else {
        await expect(page.locator('#brain-choices')).toBeVisible();
        await expect(page.locator('#brain-model-btn')).toContainText(offers[0].label);
        if (offers[1]) await expect(page.locator('#brain-other-btn')).toContainText(offers[1].label);
        else await expect(page.locator('#brain-other-btn')).toBeHidden();
      }
      // A model used in no language is named nowhere in the panel.
      for (const t of runnable) if (!usedAnywhere(MODELS[t])) await expect(page.locator('#brain-choices')).not.toContainText(MODELS[t].label);
    });
  }

  // brain.ts rememberedModel: a page loads on its own only the model the visitor chose before, and
  // only while this device is offered it; never another download in its place.
  test('a stored choice reloads that same model, and a choice this device is not offered loads nothing', async ({ page, context }) => {
    const desktop = async (p: Page, stored: string) => {
      await standInModel(p);
      await p.addInitScript((c) => {
        Object.defineProperty(Navigator.prototype, 'deviceMemory', { configurable: true, get: () => 16 });
        localStorage.setItem('inspired-mile-brain', c);
      }, stored);
      await p.goto('/battle?seed=11');
    };
    // LFM2.5 is never offered to a desktop with memory to spare: nothing loads, the visitor is asked.
    await desktop(page, 'lite');
    await expect(page.locator('#brain-status')).not.toHaveText(/Checking/);
    await page.waitForTimeout(1500);
    expect((await stubCount(page)).loads).toEqual([]);
    await expect(page.locator('#brain-status')).not.toContainText('is loaded');
    for (const m of [MODELS.grand, MODELS.standard].filter(usedAnywhere)) {
      const p = await context.newPage();
      await desktop(p, m.tier);
      await expect(p.locator('#brain-status')).toContainText(`${m.label} is loaded`);
      expect((await stubCount(p)).loads, `stored ${m.tier}`).toEqual([m.id]);
      await p.close();
    }
  });
});

/**
 * The rules as the page plays them after the 2026-11-16 review: the battle page draws a
 * DuelSession, so what is asserted here is scored by the same code as the theatre.
 */
test.describe('Verse duel: the rules on the page', () => {
  /** The rows of one side's score box in the verdict, as label -> value. */
  async function scoreRows(page: Page, box: number): Promise<Record<string, string>> {
    return page.locator('#verdict .grid > div').nth(box).evaluate((el) => {
      const rows: Record<string, string> = {};
      el.querySelectorAll(':scope > div').forEach((row) => {
        const [k, v] = Array.from(row.querySelectorAll('span')).map((s) => s.textContent ?? '');
        rows[k] = v;
      });
      return rows;
    });
  }

  test('English is measured by sound: rhymes and syllables that spelling gets wrong are kept', async ({ page }) => {
    // Verses that keep each form only if "know" rhymes with "snow" and "poem" has two syllables.
    const bySound: Record<string, string> = {
      Couplet: 'I told thee once and now I let thee know\nThy verse is melting faster than the snow',
      'Paired Quatrain': 'I told thee once and now I let thee know\nThy verse is melting faster than the snow\nThe time has come to end thy little rhyme\nI do it gladly, one line at a time',
      'Crossed Quatrain': 'I told thee once and now I let thee know\nThe sky is not the limit of my art\nThy verse is melting faster than the snow\nAnd mine flies high, an arrow to the heart',
      Tercet: 'I told thee once and now I let thee know\nThy little candle gutters in the wind\nThy verse is melting faster than the snow',
      Haiku: 'Romeo is gone\nJuliet is crying now\nA quiet poem',
      'Heroic Couplet': 'I told thee once and now I let thee know\nThy verse is melting faster than the snow',
    };
    let form = '';
    for (const seed of [11, 2024, 3, 7, 5, 1, 2, 4, 6, 8]) {
      await open(page, seed);
      await start(page);
      form = (await page.locator('#form-name').innerText()).trim();
      if (bySound[form]) break;
    }
    expect(Object.keys(bySound), 'a seed that draws a rhyming or syllable form first').toContain(form);
    await page.click('[data-char-id="MO-001"]');
    await page.fill('#verse-input', bySound[form]);
    // Every requirement of the form is ticked: the first rows of the checklist are the form's.
    const formRows = page.locator('#live-checks li').filter({ hasText: /\(\+\d+\)/ }).filter({ hasNotText: /craft|Power/ });
    const marks = await formRows.evaluateAll((rows) => rows.map((r) => r.querySelector('span')?.textContent));
    expect(marks.length).toBeGreaterThanOrEqual(2);
    expect(marks.every((m) => m === '✓'), `${form}: ${marks.join(' ')}`).toBe(true);
  });

  test("pasting the opponent's verse back loses the round and says why", async ({ page }) => {
    await open(page);
    await start(page);
    const theirs = await page.locator('#opponent-verse').innerText();
    await page.click('[data-char-id="DC-001"]');
    await page.fill('#verse-input', theirs);
    await expect(page.locator('#live-checks')).toContainText('Scores nothing');
    await expect(page.locator('#live-craft')).toHaveText('0');
    await page.click('#submit-verse');
    const verdict = page.locator('#verdict');
    await expect(verdict).toHaveAttribute('data-winner', 'opponent');
    await expect(verdict).toContainText('A copied verse forfeits the judge.');
    const mine = await scoreRows(page, 0);
    expect(mine.Craft).toBe('0');
    expect(mine.Judge).toBe('0 / 24');
    expect(mine['Round score']).toBe('0');
  });

  test('a world card adds its bonus once, on its own row, and the round score is the sum shown', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('inspired-mile-variants', JSON.stringify([{ variantId: 'DC-001-LDN-00-00-02', baseCardId: 'DC-001', acquiredAt: 1, source: 'battle-streak' }]));
    });
    await open(page);
    // London: +2 when the judge gives you allusion.
    await page.evaluate(() => (document.querySelector('.variant-pick[data-variant-id="DC-001-LDN-00-00-02"]') as HTMLElement).click());
    await expect(page.locator('#equipped-variant-label')).toContainText('London');
    await start(page);
    await page.click('[data-char-id="DC-001"]');
    // Five characters called on by name: the rule judge gives this verse allusion.
    await page.fill('#verse-input', 'Hamlet and Macbeth, Romeo and Puck agree\nThe question, Juliet, is not for thee');
    await page.click('#submit-verse');
    await expect(page.locator('#verdict')).toBeVisible();
    const mine = await scoreRows(page, 0);
    expect(mine['World card: London']).toBe('+2 allusion');
    expect(Number(mine['Round score'])).toBe(Number(mine.Craft) + Number(mine.Judge.split(' / ')[0]) + 2);
    // The opponent has no world card and no such row.
    const theirs = await scoreRows(page, 1);
    expect(Object.keys(theirs).some((k) => k.startsWith('World card'))).toBe(false);
    expect(Number(theirs['Round score'])).toBe(Number(theirs.Craft) + Number(theirs.Judge.split(' / ')[0]));
    // The winner shown is the one the totals give.
    const winner = await page.locator('#verdict').getAttribute('data-winner');
    if (Number(mine['Round score']) !== Number(theirs['Round score'])) {
      expect(winner).toBe(Number(mine['Round score']) > Number(theirs['Round score']) ? 'player' : 'opponent');
    }
  });

  test('a verse of punctuation or invisible characters cannot be submitted', async ({ page }) => {
    await open(page);
    await start(page);
    await page.click('[data-char-id="DC-001"]');
    await page.fill('#verse-input', '?\n?');
    await expect(page.locator('#submit-verse')).toBeDisabled();
    await page.fill('#verse-input', `${String.fromCodePoint(0x3164, 0x3164)}\n${String.fromCodePoint(0x3164, 0x3164, 0x3164)}`);
    await expect(page.locator('#submit-verse')).toBeDisabled();
    await page.fill('#verse-input', 'Bold?\nOr merely old?');
    await expect(page.locator('#submit-verse')).toBeEnabled();
  });

  test('the seed shown is the seed played', async ({ page }) => {
    await open(page, 4294967297);
    await start(page);
    await expect(page.locator('#seed-label')).toHaveText('1');
    const first = [await page.locator('#form-name').innerText(), await page.locator('#opponent-verse').innerText()];
    await open(page, 1);
    await start(page);
    expect([await page.locator('#form-name').innerText(), await page.locator('#opponent-verse').innerText()]).toEqual(first);
  });

  test('in the last round a potion is out of reach, and the page says why', async ({ page }) => {
    await open(page);
    await start(page);
    // Round 1: a verse that keeps the form and lands Hamlet's device and signature.
    await page.click('[data-char-id="DC-001"]');
    await page.fill('#verse-input', await verseFor(page));
    await page.click('#submit-verse');
    await expect(page.locator('#verdict')).toBeVisible();
    const first = await page.locator('#verdict').getAttribute('data-winner');
    await page.click('#next-round');
    await expect(page.locator('#round-label')).toHaveText('Round 2 of 3');
    await expect(page.locator('#opponent-verse')).not.toHaveText('…');

    // Round 2: make it one round each, so a third is played. A copy always loses; after a
    // lost first round, a kept form with Romeo's signature has to win this one.
    await page.click('[data-char-id="MO-001"]');
    const theirs = await page.locator('#opponent-verse').innerText();
    await page.fill('#verse-input', first === 'player' ? theirs : await verseFor(page));
    await page.click('#submit-verse');
    await expect(page.locator('#verdict')).toBeVisible();
    await expect(page.locator('#verdict')).toHaveAttribute('data-winner', first === 'player' ? 'opponent' : 'player');
    await expect(page.locator('#next-round')).toHaveText('Next round');
    await page.click('#next-round');

    // Round 3: no verse is left to curse.
    await expect(page.locator('#round-label')).toHaveText('Round 3 of 3');
    await expect(page.locator('#opponent-verse')).not.toHaveText('…');
    await expect(page.locator('[data-item-id="PT-002"]')).toHaveClass(/pointer-events-none/);
    await expect(page.locator('#item-note')).toContainText('this is the last round');
    // The relic is still playable, and ink is what is left: 2 to start, +1 a round, nothing spent.
    await expect(page.locator('[data-item-id="RL-001"]')).not.toHaveClass(/opacity-30/);
    await expect(page.locator('#ink')).toHaveText('4');
  });
});
