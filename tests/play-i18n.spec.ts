import { test, expect, type Page } from '@playwright/test';
import { TRIVIA_BANK } from '../src/lib/trivia';
import arTrivia from '../src/i18n/pages/trivia/ar';
import arStory from '../src/i18n/pages/story/ar';
import arPlayground from '../src/i18n/pages/playground/ar';
import arChallenges from '../src/i18n/pages/challenges/ar';

/**
 * The playground and the story page in all sixteen languages.
 *
 * For each language: the page is opened in it, the onboarding overlay is read and
 * dismissed, the trivia and quote-challenge modals are opened, and the page is
 * searched for what must never be shown: a raw message key, an unfilled
 * {placeholder}, or English interface text left behind.
 *
 * textContent, not innerText (see tests/i18n.spec.ts): innerText returns text as
 * styled, so a label in capitals hides from a mixed-case list, and it skips what
 * is hidden at the moment, which must be translated just the same.
 * scripts/lang-content/mutate-play.mjs proves these tests go red.
 */

const LOCALES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ar', 'hi', 'zh', 'ja', 'ko', 'vi', 'th', 'id'];

/** English interface strings of these two pages that must not be on screen in another language. */
const ENGLISH = [
  'Digital Playground', 'The Playground', 'Cards Owned', 'Battle Wins', 'Trivia Score', 'View Collection', 'Card Packs', 'Open packs',
  'Starter Pack', 'Daily Pack', 'CLAIMED', 'Drop Rates', 'Pack Tiers', 'Standard Pack', 'guaranteed', 'real money', 'Enter the Arena',
  'Shakespeare Trivia', 'Test your knowledge', 'Start Trivia', 'Quote Challenge', 'Complete the famous', 'Start Challenge', 'Check Answer',
  'Missing word', 'Blank 1', 'Hint:', 'Claim Your', 'Got it', 'Story Mode', 'Your Journey', 'encounters completed',
  'The Streets of Verona', 'Street Brawl', 'Easy', 'Medium', 'Hard', 'The Enchanted Forest', 'Tempest Island', 'The Final Bow',
];

async function open(page: Page, path: string, locale: string) {
  await page.addInitScript((l) => localStorage.setItem('inspired-mile-locale', l), locale);
  await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
  // The page's own strings are a page area, fetched after the core locale: until it is applied the
  // markup's English shows. Read the page only once it says the area is in (a busy dev server compiles
  // each language's chunk on first request).
  await expect(page.locator('html')).toHaveAttribute('data-page-area', locale);
}

/** The tooltip is placed beside what it points at, which can be outside a headless viewport: click it from the page. */
async function skipOnboarding(page: Page) {
  await page.evaluate(() => (document.getElementById('onboarding-skip') as HTMLElement).click());
  await expect(page.locator('#onboarding-overlay')).toBeHidden();
}

/**
 * The interface text of the page, shown or hidden, without what is content by design:
 * the questions and quotations themselves (they quote Shakespeare in English), the
 * language switcher, and anything marked as being in English.
 */
async function interfaceText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('#locale-switch, #trivia-question, .trivia-option, #challenge-quote, [lang="en"], script, style, svg').forEach((n) => n.remove());
    return (clone.textContent ?? '').replace(/\s+/g, ' ');
  });
}

async function expectNoLeaks(page: Page, locale: string) {
  const text = await interfaceText(page);
  expect(text.length).toBeGreaterThan(200);
  expect(text.match(/\{[a-z_]+\}/gi), 'unfilled placeholders').toBeNull();
  expect(text.match(/\b(?:pg|story|trivia|challenge|challenges|streak|event|countdown|rarity|nav|footer)\.[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\b/g), 'message keys shown as text').toBeNull();
  if (locale !== 'en') for (const s of ENGLISH) expect(text.includes(s), `English "${s}" is still on screen in ${locale}`).toBe(false);
}

for (const locale of LOCALES) {
  test(`playground in ${locale}: onboarding, trivia and the quote challenge`, async ({ page }) => {
    await open(page, '/playground', locale);

    // Onboarding: shown on a first visit, in the language, then dismissed.
    const overlay = page.locator('#onboarding-overlay');
    await expect(overlay).toBeVisible();
    await expect(page.locator('#onboarding-title')).not.toBeEmpty();
    await expect(page.locator('#onboarding-desc')).not.toBeEmpty();
    await expectNoLeaks(page, locale);
    await skipOnboarding(page);

    // Trivia: a question and as many options as English has, in the language.
    await page.click('#trivia-start-btn');
    await expect(page.locator('#trivia-modal')).toBeVisible();
    await expect(page.locator('.trivia-option')).toHaveCount(4);
    await expect(page.locator('#trivia-question')).toHaveAttribute('lang', locale);
    await expect(page.locator('#trivia-question')).not.toBeEmpty();
    await expect(page.locator('#trivia-progress')).not.toBeEmpty();
    for (const option of await page.locator('.trivia-option').allTextContents()) expect(option.trim().length).toBeGreaterThan(0);
    // The question comes from the language's bank, not the English one (which the leak check does not read).
    const asked = ((await page.locator('#trivia-question').textContent()) ?? '').trim();
    if (locale !== 'en') expect(TRIVIA_BANK.some((q) => asked.startsWith(q.question)), `an English trivia question is shown in ${locale}: ${asked}`).toBe(false);
    await expectNoLeaks(page, locale);
    await page.click('#trivia-close');

    // The quote challenge: a line with its blanks, in the language or marked as the English original.
    await page.click('#challenge-start-btn');
    await expect(page.locator('#challenge-modal')).toBeVisible();
    const quote = page.locator('#challenge-quote');
    await expect(quote).toContainText('___');
    const quoteLang = await quote.getAttribute('lang');
    expect([locale, 'en']).toContain(quoteLang);
    const blanks = ((await quote.textContent()) ?? '').split('___').length - 1;
    await expect(page.locator('.challenge-input')).toHaveCount(blanks);
    if (locale !== 'en' && quoteLang === 'en') await expect(page.locator('#challenge-content [data-i18n="pg.challenge.original"]')).toBeVisible();
    if (quoteLang !== 'en') await expect(page.locator('#challenge-content [data-challenge-credit]')).toBeVisible();
    await expectNoLeaks(page, locale);
  });

  test(`story page in ${locale}: acts, encounters and an opened scene`, async ({ page }) => {
    await open(page, '/story', locale);
    await expect(page.locator('.encounter-card')).toHaveCount(19);
    await expect(page.locator('#progress-text')).toContainText('19');
    await page.click('.encounter-card[data-encounter="1-1"]');
    await expect(page.locator('#encounter-scene')).toBeVisible();
    await expect(page.locator('#scene-narrative')).toContainText('Do you bite your thumb at me, sir?');
    // More than the quotation alone (35 characters): the scene around it is there, in a script that may be compact.
    expect(((await page.locator('#scene-narrative').textContent()) ?? '').length).toBeGreaterThan(50);
    await expectNoLeaks(page, locale);
  });
}

/**
 * In Arabic the page runs right to left, and the bidirectional algorithm gives the "?" closing an English
 * line the direction of the Arabic around it, so it is drawn at the line's other end: "?Do you bite your
 * thumb at me, sir". The line is an isolate (scripts/lang-content/bidi.mjs); this measures where the
 * browser actually draws the question mark: on the same line as the "r" of "sir", and just to its right.
 */
test('Arabic: an English line in a story scene keeps its question mark at its end', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, '/story', 'ar');
  await page.click('.encounter-card[data-encounter="1-1"]');
  await expect(page.locator('#scene-narrative')).toContainText('sir?');
  const at = await page.evaluate(() => {
    const node = document.getElementById('scene-narrative')!.firstChild as Text;
    const q = node.data.indexOf('sir?') + 3;
    const box = (i: number) => { const r = document.createRange(); r.setStart(node, i); r.setEnd(node, i + 1); const b = r.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top }; };
    return { mark: box(q), r: box(q - 1) };
  });
  expect(Math.abs(at.mark.top - at.r.top), 'the question mark is on the line of "sir"').toBeLessThan(3);
  expect(at.mark.left, 'the question mark is drawn right after "sir", not at the far end of the line').toBeGreaterThanOrEqual(at.r.right - 1);
  expect(at.mark.left - at.r.right).toBeLessThan(6);
  // And a count out of a total reads left to right: "0/19", the count left of the total (with spaces round the
  // slash the two numbers were laid out right to left and read 19 / 0).
  const order = await page.evaluate(() => {
    const node = document.getElementById('progress-text')!.firstChild as Text;
    const box = (i: number, n: number) => { const r = document.createRange(); r.setStart(node, i); r.setEnd(node, i + n); return r.getBoundingClientRect().left; };
    const m = node.data.match(/(\d+)\s*\/\s*(\d+)/)!;
    return { count: box(m.index!, m[1].length), total: box(node.data.indexOf(m[2], m.index! + m[1].length), m[2].length) };
  });
  expect(order.count, 'the count stands left of the total').toBeLessThan(order.total);
});

/**
 * The onboarding tooltip lives in a fixed overlay, so it must be placed in the viewport, after the page
 * has scrolled its target into view. At phone width the second target is far below the fold.
 */
for (const locale of ['en', 'ar']) {
  test(`onboarding at phone width in ${locale}: every step's tooltip is on screen beside its target`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, '/playground', locale);
    const tip = page.locator('#onboarding-tooltip');
    const targets = ['#starter-pack-btn', '#trivia-start-btn', 'a[href="/battle"].btn-danger'];
    for (let step = 1; step <= 3; step++) {
      await expect(page.locator('#onboarding-step')).toHaveText(`${step} / 3`);
      await expect.poll(async () => {
        const b = await tip.boundingBox();
        return !!b && b.y >= 0 && b.y + b.height <= 844 && b.x >= 0 && b.x + b.width <= 390;
      }, { message: `step ${step}: the tooltip is inside the 390 x 844 viewport` }).toBe(true);
      // Beside its target: not over it (a tooltip over its target hid it, and the target, raised above the overlay,
      // took the click meant for "Next"), and no further from it than the arrow's reach.
      const [b, t] = [await tip.boundingBox(), await page.locator(targets[step - 1]).first().boundingBox()];
      const gap = Math.max(t!.y - (b!.y + b!.height), b!.y - (t!.y + t!.height));
      expect(gap, `step ${step}: the tooltip does not cover its target`).toBeGreaterThanOrEqual(0);
      expect(gap, `step ${step}: the tooltip stands next to its target`).toBeLessThan(40);
      await page.locator('#onboarding-next').click({ timeout: 10_000 });
    }
    await expect(page.locator('#onboarding-overlay')).toBeHidden();
  });
}

test('a change of language relabels the open playground', async ({ page }) => {
  await open(page, '/playground', 'en');
  await expect(page.locator('#onboarding-overlay')).toBeVisible();
  await skipOnboarding(page);
  await expect(page.locator('#trivia-start-btn')).toHaveText('Start Trivia');
  await page.selectOption('#locale-switch', 'de');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.locator('#trivia-start-btn')).toHaveText('Quiz starten');
  await page.click('#trivia-start-btn');
  await expect(page.locator('#trivia-question')).toHaveAttribute('lang', 'de');
  await expect(page.locator('#trivia-progress')).toContainText('Frage 1 / 5');
  // The question itself comes from the German bank, not only the labels around it.
  const asked = ((await page.locator('#trivia-question').textContent()) ?? '').trim();
  expect(asked.length).toBeGreaterThan(0);
  expect(TRIVIA_BANK.some((q) => asked.startsWith(q.question)), `an English trivia question after switching to German: ${asked}`).toBe(false);
  await page.selectOption('#locale-switch', 'ja');
  await expect(page.locator('#trivia-progress')).toContainText('第1問');
  // Arabic turns the page right to left.
  await page.selectOption('#locale-switch', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});

/**
 * Every Arabic string that holds English, drawn by the browser and measured: what the reader sees, whatever
 * marks the text carries. This does not use scripts/lang-content/bidi.mjs, which writes the isolates: the
 * checker of 2026-11-16 found that the unit test held the strings to that same function, so it passed the
 * fault it shared ("King's Men))", a full stop between the Arabic and a name).
 *  - a pair of brackets or quotation marks encloses the letters between them;
 *  - a full stop, question or exclamation mark that ends the string, outside any pair, is drawn at the end of
 *    the right-to-left line, the far left;
 *  - English reads left to right, and the punctuation that ends a quoted English line ("…, sir?") is drawn
 *    after its last letter, to its right.
 */
test('Arabic: every string with English in it is drawn in reading order (brackets, quotations, full stops)', async ({ page }) => {
  const all = { ...arPlayground, ...arStory, ...arTrivia, ...arChallenges } as Record<string, string>;
  const rows = Object.entries(all).filter(([, v]) => /[A-Za-z]/.test(v));
  expect(rows.length).toBeGreaterThan(300);
  await page.setContent('<!doctype html><html dir="rtl" lang="ar"><meta charset="utf-8"><body style="margin:16px;font:18px sans-serif"></body></html>');
  const problems = await page.evaluate((rows) => {
    const out: string[] = [];
    const OPEN: Record<string, string> = { '(': ')', '[': ']', '«': '»', '“': '”' };
    const CLOSE = new Set(Object.values(OPEN));
    const latin = (c: string) => /[A-Za-z\u00C0-\u024F]/u.test(c);
    for (const [k, v] of rows) {
      const p = document.createElement('p');
      p.style.whiteSpace = 'nowrap';
      p.textContent = v;
      document.body.append(p);
      const t = p.firstChild as Text;
      const x = (i: number) => { const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + 1); const b = r.getBoundingClientRect(); return (b.left + b.right) / 2; };
      const pairs: [number, number][] = [];
      const stack: number[] = [];
      let straight = -1;
      for (let i = 0; i < v.length; i++) {
        if (v[i] in OPEN) stack.push(i);
        else if (CLOSE.has(v[i])) { const j = stack.pop(); if (j !== undefined && OPEN[v[j]] === v[i]) pairs.push([j, i]); else out.push(`${k}: "${v[i]}" at ${i} closes nothing`); }
        else if (v[i] === '"') { if (straight < 0) straight = i; else { pairs.push([straight, i]); straight = -1; } }
      }
      for (const [i, j] of pairs) {
        const lo = Math.min(x(i), x(j)), hi = Math.max(x(i), x(j));
        const outside = [...v.slice(i + 1, j)].findIndex((c, d) => /\p{L}/u.test(c) && (x(i + 1 + d) < lo || x(i + 1 + d) > hi));
        if (outside >= 0) out.push(`${k}: "${v[i + 1 + outside]}" is drawn outside its pair ${v[i]}…${v[j]}`);
        // A quoted English line: the punctuation after its last letter is drawn to that letter's right.
        const inner = v.slice(i + 1, j);
        const first = [...inner].findIndex((c) => /\p{L}/u.test(c));
        if (first >= 0 && latin(inner[first])) {
          let last = -1;
          for (let d = inner.length - 1; d >= 0; d--) if (/[\p{L}\p{N}]/u.test(inner[d])) { last = d; break; }
          for (let d = last + 1; d < inner.length; d++) if (/[.,;:!?…]/u.test(inner[d]) && x(i + 1 + d) < x(i + 1 + last)) out.push(`${k}: the "${inner[d]}" closing the English line is drawn before its last letter`);
        }
      }
      // English reads left to right: within a run of Latin letters and what joins them, each letter right of the one before.
      for (const run of v.matchAll(/[A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F'’ ,.\-]*[A-Za-z\u00C0-\u024F]/gu)) {
        const at = run.index!;
        const letters = [...run[0]].map((c, d) => [c, at + d] as const).filter(([c]) => latin(c));
        for (let d = 1; d < letters.length; d++) if (x(letters[d][1]) < x(letters[d - 1][1])) { out.push(`${k}: "${run[0]}" is not drawn left to right`); break; }
      }
      // The sentence's own last mark.
      let end = v.length - 1;
      while (end >= 0 && /[\s\u2066-\u2069]/u.test(v[end])) end--;
      if (end >= 0 && /[.!?؟]/u.test(v[end]) && !pairs.some(([i, j]) => i < end && end < j)) {
        const letters = [...v].map((c, i) => [c, i] as const).filter(([c]) => /\p{L}/u.test(c)).map(([, i]) => x(i));
        if (letters.length && x(end) > Math.min(...letters)) out.push(`${k}: the closing "${v[end]}" is not at the end of the line (its left end)`);
      }
      p.remove();
    }
    return out;
  }, rows);
  expect(problems, 'Arabic strings drawn out of reading order').toEqual([]);
});

/**
 * dir="auto" takes its direction from the first letter, so an Arabic option that opens with a name in Latin
 * letters ("Portia في تاجر البندقية", trivia 125 and 151) was laid out left to right (measured in Chromium by the
 * checker of 2026-11-16). The question and its options take the direction of the language they are in.
 */
test('Arabic: a trivia question or option that opens with English is still laid out right to left', async ({ page }) => {
  await open(page, '/playground', 'ar');
  await skipOnboarding(page);
  await page.click('#trivia-start-btn');
  await expect(page.locator('.trivia-option')).toHaveCount(4);
  const opensWithEnglish = (arTrivia as Record<string, string>)['trivia.151.o0'];
  expect(opensWithEnglish.replace(/[\u2066-\u2069]/gu, '')).toMatch(/^[A-Za-z]/);
  const rtl = await page.evaluate((s) => [...document.querySelectorAll('#trivia-question, .trivia-option')].map((el) => {
    el.textContent = s;
    return el.matches(':dir(rtl)');
  }), opensWithEnglish);
  expect(rtl, 'the question and every option are laid out right to left').toEqual([true, true, true, true, true]);
});

/** On a right-to-left page, every "count / total" on screen is drawn count first, on the left, as numbers are read. */
async function reversedCounts(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const rx = /(\d+)\s*\/\s*(\d+)/u;
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      if (el.matches('script, style') || !el.getClientRects().length) continue;
      const m = (el.textContent ?? '').match(rx);
      // The innermost element that holds the whole of it.
      if (!m || [...el.children].some((c) => rx.test(c.textContent ?? ''))) continue;
      const nodes: Text[] = [];
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      while (walk.nextNode()) nodes.push(walk.currentNode as Text);
      const at = (offset: number) => {
        for (const n of nodes) { if (offset < n.data.length) { const r = document.createRange(); r.setStart(n, offset); r.setEnd(n, offset + 1); return r.getBoundingClientRect().left; } offset -= n.data.length; }
        return NaN;
      };
      const count = m.index!, total = m.index! + m[0].lastIndexOf(m[2]);
      if (!(at(count) < at(total))) out.push(`"${m[0]}" in <${el.tagName.toLowerCase()}${el.id ? ' id=' + el.id : ''}> is drawn total first`);
    }
    return out;
  });
}

test('Arabic: a count out of a total on the playground reads count first (cards, spending, the trivia score)', async ({ page }) => {
  await open(page, '/playground', 'ar');
  await skipOnboarding(page);
  // The spending line is shown to teen accounts only: shown here to be measured.
  await page.evaluate(() => document.getElementById('spending-limit-banner')!.classList.remove('hidden'));
  await expect(page.locator('#stat-cards')).toBeVisible();
  expect(await reversedCounts(page), 'counts out of a total drawn total first').toEqual([]);
  // A whole trivia round: at its end the header shows the score out of five.
  await page.click('#trivia-start-btn');
  for (let n = 1; n <= 5; n++) {
    await expect(page.locator('#trivia-progress')).toContainText(`${n}/5`);
    await page.locator('.trivia-option').first().click();
  }
  await expect(page.locator('#trivia-score-display')).toContainText('/ 5');
  expect(await reversedCounts(page), 'counts out of a total drawn total first').toEqual([]);
});
