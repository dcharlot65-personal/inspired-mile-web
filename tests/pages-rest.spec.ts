import { test, expect, type Page } from '@playwright/test';
// @ts-ignore a plain module, shared with scripts/pages-rest/shots.mjs
import { DATA, DATA_TEXT, LOCALES, PAGES, mayMatchEnglish, mockApi, startIn } from './pages-rest.fixtures.mjs';

/**
 * The classroom, marketplace, tournament, season, viewer and VR pages, and the offline
 * page, in all sixteen languages.
 *
 * Each page is loaded in each language with its lists filled (the API answers come from
 * tests/pages-rest.fixtures.mjs), and four things are looked for in everything the page
 * holds, shown or hidden:
 *
 *   - a message key shown as text ("classroom.join.title");
 *   - a {placeholder} nobody filled;
 *   - English left behind: every English string of the page's areas that the language says
 *     differently must be gone. The list is not kept by hand; it is read from the locale
 *     modules the dev server serves;
 *   - at phone width, anything of the page's own content that sticks out of the screen.
 *
 * textContent, not innerText: innerText returns text as styled, so an English label styled
 * in capitals would read "JOIN CODE" and slip past (scripts/mutate-i18n-browser.mjs found
 * that in the duel's tests). textContent also covers the panels hidden at the moment.
 *
 * What this does not say: that a translation is good. See docs/language/pages-rest.md.
 * scripts/pages-rest/mutate.mjs proves each of these checks can fail.
 */

// The site registers a service worker, and a request that a service worker makes is not
// seen by page.route: from the second page load on, the API answers of the fixtures were
// silently replaced by the real API's "401" (first run of this file: 8 passed, 11 failed,
// every failure after a second navigation). These tests are about the pages, not the cache.
test.use({ serviceWorkers: 'block' });

type Messages = Record<string, string>;
interface PageSpec { name: string; path: string; areas: string[]; titleKey: string; descriptionKey: string; ready: string }

const KEY_AS_TEXT = /\b(?:classroom|market|tour|season|viewer|vr|error|activity|credits|boundary|offline|app|pwa|nav|auth|footer)\.[a-zA-Z_]+(?:\.[a-zA-Z_]+)*\b/g;

/** The messages a page can show in one language: the core locale and the page's areas, read from the dev server. */
async function messagesFor(page: Page, areas: string[], locale: string): Promise<Messages> {
  return page.evaluate(async ([names, l]) => {
    const core = (await import(/* @vite-ignore */ `/src/i18n/locales/${l}.ts`)).default as Record<string, string>;
    const out: Record<string, string> = { ...core };
    for (const name of names as string[]) Object.assign(out, (await import(/* @vite-ignore */ `/src/i18n/pages/${name}/${l}.ts`)).default);
    return out;
  }, [areas, locale] as const);
}

/** The page's areas only (what this work added), in one language. */
async function areaMessages(page: Page, areas: string[], locale: string): Promise<Messages> {
  return page.evaluate(async ([names, l]) => {
    const out: Record<string, string> = {};
    for (const name of names as string[]) Object.assign(out, (await import(/* @vite-ignore */ `/src/i18n/pages/${name}/${l}.ts`)).default);
    return out;
  }, [areas, locale] as const);
}

/**
 * All the interface text of the page. Left out: what is data and not interface (card names
 * and numbers, product and format names, the languages' own names), each marked in the
 * markup with translate="no" or lang="en".
 */
async function interfaceText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('script, style, svg, #locale-switch, [translate="no"], option[lang="en"], model-viewer').forEach((n) => n.remove());
    // Text node by text node, with a space between: two sentences in neighbouring elements
    // ("…for a classroom." "I understand…") must not run together and look like a key.
    const pieces: string[] = [];
    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) pieces.push(n.nodeValue ?? '');
    return pieces.join(' ').replace(/\s+/g, ' ');
  });
}

/**
 * English strings that must not be on the page in `locale`: each English value of the
 * page's areas, when it is long enough to be unmistakable, it is not listed as rightly the
 * same in that language (SAME_AS_ENGLISH in tests/pages-rest.fixtures.mjs), and it does not
 * occur inside another of the language's own strings or in the fixture data (a word two
 * languages share is not a leak).
 *
 * The locale file is not trusted to say what is translated: a string its author forgot to
 * translate reads the same as English there, and was skipped here until 2026-11-16
 * (scripts/pages-rest/mutate.mjs, "English left in the Spanish marketplace": MISSED).
 */
function englishThatMustBeGone(english: Messages, mine: Messages, locale: string): string[] {
  const own = Object.entries(mine).filter(([k, v]) => v !== english[k]).map(([, v]) => v).join('\n') + '\n' + DATA_TEXT;
  const out = new Set<string>();
  for (const [key, value] of Object.entries(english)) {
    const text = value.trim();
    if (mine[key] === value && mayMatchEnglish(key, locale)) continue;
    if (text.length < 9 && !/\s/.test(text)) continue;
    if (/^[^a-zA-Z]*$/.test(text.replace(/\{[a-zA-Z_]+\}/g, ''))) continue;
    // A sentence with a variable is looked for by its longest fixed piece.
    const piece = text.split(/\{[a-zA-Z_]+\}/).map((s) => s.trim()).sort((a, b) => b.length - a.length)[0];
    if (piece.length < 9 || own.includes(piece)) continue;
    out.add(piece);
  }
  return [...out];
}

/** Elements of the page's own content that reach past the edge of the screen. Scrolling boxes are meant to. */
async function stickingOut(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const out: string[] = [];
    document.querySelectorAll<HTMLElement>('main *').forEach((el) => {
      if (el.closest('.overflow-x-auto, .overflow-y-auto, .hidden, canvas, model-viewer')) return;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.position === 'fixed') return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (r.right > width + 1 || r.left < -1) out.push(`${el.tagName.toLowerCase()}#${el.id}.${String(el.className).slice(0, 40)} [${Math.round(r.left)}..${Math.round(r.right)} of ${width}] "${(el.textContent ?? '').trim().slice(0, 40)}"`);
    });
    return out.slice(0, 8);
  });
}

async function open(page: Page, spec: PageSpec, locale: string, opts: { fail?: boolean } = {}): Promise<Messages> {
  await startIn(page, locale);
  await mockApi(page, opts);
  await page.goto(spec.path);
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
  const messages = await messagesFor(page, spec.areas, locale);
  // The title is set when the language and the page's areas are in: the page is ready to be read.
  await expect(page).toHaveTitle(`${messages[spec.titleKey]} | Inspired Mile`);
  return messages;
}

async function expectNoLeaks(page: Page, spec: PageSpec, locale: string) {
  const text = await interfaceText(page);
  expect(text.length, 'the page has text').toBeGreaterThan(300);
  expect(text.match(/\{[a-zA-Z_]+\}/g), `${spec.name}/${locale}: unfilled placeholders`).toBeNull();
  expect(text.match(KEY_AS_TEXT), `${spec.name}/${locale}: message keys shown as text`).toBeNull();
  if (locale === 'en') return;
  const english = await areaMessages(page, spec.areas, 'en');
  const mine = await areaMessages(page, spec.areas, locale);
  const gone = englishThatMustBeGone(english, mine, locale);
  // The list is long enough to mean something (a page area holds dozens of sentences).
  expect(gone.length, `${spec.name}/${locale}: English strings to look for`).toBeGreaterThan(15);
  const left = gone.filter((s) => text.includes(s));
  expect(left, `${spec.name}/${locale}: English still on the page`).toEqual([]);
}

test.describe('The remaining pages in sixteen languages', () => {
  // Phone width: the narrowest the pages are used at, where long words overflow first.
  test.use({ viewport: { width: 390, height: 844 } });

  for (const spec of PAGES as PageSpec[]) {
    test(`${spec.name}: every language fills the page, with no key, placeholder, English or overflow`, async ({ page }) => {
      test.setTimeout(240_000);
      for (const locale of LOCALES as string[]) {
        const messages = await open(page, spec, locale);
        await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
        await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', messages[spec.descriptionKey]);
        await expect(page.locator(spec.ready).first()).toBeAttached();
        await expectNoLeaks(page, spec, locale);
        expect(await stickingOut(page), `${spec.name}/${locale}: content wider than the screen`).toEqual([]);
      }
    });
  }
});

/**
 * Where the lines of the page's Japanese or Korean text break, as pairs "last character of a line |
 * first character of the next". Flagged in Japanese: a line that opens with ー or a small kana
 * (Japanese line-breaking rules forbid it), and a break between two katakana, which is inside a word
 * (カ|ード). In Korean, which spaces its words: a break between two syllables with no space
 * between them (셰익스|피어). Read from the rendered text, character by character, within each block.
 */
async function cjkBreaks(page: Page, lang: 'ja' | 'ko'): Promise<string[]> {
  return page.evaluate((lang) => {
    const OPENS_NOT = /[ーぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶㇰ-ㇿ]/u;
    const KATAKANA = /[\u30a1-\u30fa\u30fc]/u;
    const HANGUL = /\p{Script=Hangul}/u;
    const out: string[] = [];
    const range = document.createRange();
    const walker = document.createTreeWalker(document.querySelector('main')!, NodeFilter.SHOW_TEXT);
    let prev: { ch: string; top: number; height: number; block: Element } | null = null;
    let spaced = false;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const block = node.parentElement?.closest('p, li, h1, h2, h3, h4, label, button, a, td, th, dd, dt, div');
      if (!block) continue;
      const text = node.textContent ?? '';
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (/\s/.test(ch)) {
          spaced = true;
          continue;
        }
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const r = range.getClientRects()[0];
        if (!r || r.width === 0) continue;
        if (prev && prev.block === block && r.top > prev.top + prev.height * 0.6) {
          const bad = lang === 'ja'
            ? OPENS_NOT.test(ch) || (KATAKANA.test(prev.ch) && KATAKANA.test(ch))
            : !spaced && HANGUL.test(prev.ch) && HANGUL.test(ch);
          if (bad) out.push(`${(block.textContent ?? '').trim().slice(0, 30)}…: ${prev.ch}|${ch}`);
        }
        prev = { ch, top: r.top, height: r.height, block };
        spaced = false;
      }
    }
    return out;
  }, lang);
}

test.describe('Japanese text breaks between words', () => {
  for (const width of [390, 1280]) {
    test(`at ${width} px, no line opens with ー or a small kana, and none breaks inside a katakana word`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width, height: 900 });
      const found: string[] = [];
      for (const spec of PAGES as PageSpec[]) {
        await open(page, spec, 'ja');
        await expect(page.locator(spec.ready).first()).toBeAttached();
        for (const b of await cjkBreaks(page, 'ja')) found.push(`${spec.name}: ${b}`);
      }
      expect(found, found.join('\n')).toEqual([]);
    });
  }
});

test.describe('Korean text breaks at spaces', () => {
  for (const width of [390, 1280]) {
    test(`at ${width} px, no line breaks between two syllables of one word`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width, height: 900 });
      const found: string[] = [];
      for (const spec of PAGES as PageSpec[]) {
        await open(page, spec, 'ko');
        await expect(page.locator(spec.ready).first()).toBeAttached();
        for (const b of await cjkBreaks(page, 'ko')) found.push(`${spec.name}: ${b}`);
      }
      expect(found, found.join('\n')).toEqual([]);
    });
  }
});

test.describe('What the pages build in script', () => {
  test('classroom: the list counts members with the language’s plural forms and opens a classroom', async ({ page }) => {
    const spec = (PAGES as PageSpec[])[0];
    // Polish has three forms on show here: 3 osoby, 1 osoba, 11 osób.
    const pl = await open(page, spec, 'pl');
    const rows = page.locator('#classrooms-list [data-id]');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('3 osoby');
    await expect(rows.nth(1)).toContainText('1 osoba');
    await expect(rows.nth(2)).toContainText('11 osób');
    await expect(rows.nth(0)).toContainText(pl['classroom.list.code']);

    await rows.nth(0).click();
    await expect(page.locator('#detail-name')).toHaveText('Class 9B');
    await expect(page.locator('#detail-code')).toHaveText('QWERTY');
    await expect(page.locator('#members-list')).toContainText(pl['classroom.badge.teacher']);
    await expect(page.locator('#members-list')).toContainText(pl['classroom.badge.student']);
    // The kinds of activity are named in the language, and the date is written its way.
    await expect(page.locator('#assignments-list')).toContainText(pl['activity.trivia']);
    await expect(page.locator('#assignments-list')).toContainText(pl['activity.battle']);
    await expect(page.locator('#assignments-list')).toContainText('10 lis 2026');
    await expect(page.locator('#assignments-list')).not.toContainText('trivia');
    await expectNoLeaks(page, spec, 'pl');

    // Changing the language redraws what is open, without a reload.
    await page.selectOption('#locale-switch', 'ja');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    const ja = await messagesFor(page, spec.areas, 'ja');
    await expect(page.locator('#members-list')).toContainText(ja['classroom.badge.teacher']);
    await expect(page.locator('#copy-code')).toHaveText(ja['classroom.detail.copy']);
    await expect(page.locator('#assignments-list')).toContainText(ja['activity.challenge']);
    await page.click('#back-btn');
    await expect(rows.nth(2)).toContainText('メンバー 11人');
    await expectNoLeaks(page, spec, 'ja');
  });

  test('classroom: the consent steps and the teacher’s tour are in the language', async ({ page }) => {
    const spec = (PAGES as PageSpec[])[0];
    const de = await open(page, spec, 'de');
    await page.click('#role-teacher');
    await expect(page.locator('#teacher-consent h3')).toHaveText(de['classroom.teacher.title']);
    // The sentence around the two links reads as one German sentence, links included.
    await expect(page.locator('#teacher-consent label').nth(2)).toHaveText(
      `${de['classroom.teacher.check3Before']}${de['footer.terms']}${de['classroom.teacher.check3And']}${de['footer.privacy']}${de['classroom.teacher.check3After']}`,
      { useInnerText: false },
    );
    for (const box of await page.locator('.teacher-check').all()) await box.check();
    await page.click('#teacher-continue');
    await expect(page.locator('#teacher-wizard')).toBeVisible();
    // Three steps: the tour no longer promises to follow each student's progress (Classroom Mode records none; D-03).
    await expect(page.locator('#wizard-step')).toHaveText('Schritt 1 von 3');
    await expect(page.locator('#wizard-next')).toHaveText(de['classroom.wizard.next']);
    await page.click('#wizard-next');
    await page.click('#wizard-next');
    await expect(page.locator('#wizard-step')).toHaveText('Schritt 3 von 3');
    await expect(page.locator('#wizard-next')).toHaveText(de['classroom.wizard.start']);
    await expect(page.locator('#wizard-prev')).toHaveText(de['auth.back']);
    expect(await stickingOut(page)).toEqual([]);
    await page.selectOption('#locale-switch', 'ar');
    await expect(page.locator('#wizard-step')).toHaveText('الخطوة 3 من 3');
    await page.click('#wizard-next');
    await expect(page.locator('#teacher-wizard')).toBeHidden();
  });

  test('marketplace: prices, wanted cards and dates are written as the language writes them', async ({ page }) => {
    const spec = (PAGES as PageSpec[])[1];
    const de = await open(page, spec, 'de');
    const cards = page.locator('#listings-grid > div');
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0)).toContainText('1 Credit');
    await expect(cards.nth(1)).toContainText('100.000 Credits');
    await expect(cards.nth(2)).toContainText('RL-001, PT-002 und MO-002');
    await expect(cards.nth(0)).toContainText('12.11.2026');
    await expect(cards.nth(0).locator('.buy-btn')).toHaveText(de['market.buy']);
    await expect(cards.nth(2).locator('.buy-btn')).toHaveText(de['market.offer']);

    // Not signed in: buying asks for sign-in, in the language.
    await cards.nth(0).locator('.buy-btn').click();
    await expect(page.locator('#achievement-toasts')).toContainText(de['market.toast.signInBuy']);

    await page.selectOption('#locale-switch', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    // Arabic: one, two and many are different words; 100000 takes the form for hundreds.
    await expect(cards.nth(0)).toContainText('نقطة واحدة');
    await expect(cards.nth(1)).toContainText('100,000 نقطة');
    await page.click('#tab-sell');
    const ar = await messagesFor(page, spec.areas, 'ar');
    await page.click('#create-listing-btn');
    await expect(page.locator('#achievement-toasts')).toContainText(ar['market.toast.signInSell']);
    await expectNoLeaks(page, spec, 'ar');
  });

  test('tournaments: states, formats, the bracket and the standings follow the language', async ({ page }) => {
    const spec = (PAGES as PageSpec[])[2];
    const es = await open(page, spec, 'es');
    const rows = page.locator('#tournament-list > div');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText(es['tour.status.registration']);
    await expect(rows.nth(0)).toContainText(es['tour.format.single_elimination']);
    await expect(rows.nth(0)).toContainText('5 de 8');
    await expect(rows.nth(1)).toContainText(es['tour.format.round_robin']);
    await expect(rows.nth(1)).toContainText('1000 de 1000');
    await expect(rows.nth(2)).toContainText(es['tour.status.completed']);
    // The server's own spelling of a state never reaches the page.
    await expect(page.locator('#tournament-list')).not.toContainText('in progress');
    await expect(page.locator('#tournament-list')).not.toContainText('single elimination');

    await rows.nth(0).locator('.view-bracket-btn').click();
    await expect(page.locator('#bracket-container')).toContainText('Ronda 1');
    await expect(page.locator('#bracket-container')).toContainText('Ronda 3');
    await expect(page.locator('#bracket-container')).toContainText(es['tour.bye']);
    await expect(page.locator('#bracket-container')).toContainText(es['tour.match.live']);
    await expect(page.locator('#leaderboard-table th').nth(1)).toHaveText(es['tour.col.player']);
    await expect(page.locator('#leaderboard-table')).toContainText(es['tour.entry.eliminated']);
    await expect(page.locator('#bracket-tournament-select option').nth(1)).toHaveText(`Verona Open (${es['tour.status.registration']})`);
    await expectNoLeaks(page, spec, 'es');

    await page.selectOption('#locale-switch', 'ja');
    const ja = await messagesFor(page, spec.areas, 'ja');
    await expect(page.locator('#bracket-container')).toContainText('1回戦');
    await expect(page.locator('#bracket-container')).toContainText(ja['tour.bye']);
    await expect(page.locator('#leaderboard-table th').nth(1)).toHaveText(ja['tour.col.player']);
    await expect(page.locator('#bracket-tournament-select option').nth(1)).toHaveText(`Verona Open（${ja['tour.status.registration']}）`);
    await expectNoLeaks(page, spec, 'ja');
  });

  test('season: level, XP, dates and each kind of reward are in the language', async ({ page }) => {
    const spec = (PAGES as PageSpec[])[3];
    const fr = await open(page, spec, 'fr');
    await expect(page.locator('#season-name')).toHaveText('Midsummer');
    await expect(page.locator('#season-badge')).toHaveText('Saison 2');
    await expect(page.locator('#season-level')).toHaveText('3');
    // French groups thousands with a narrow no-break space.
    await expect(page.locator('#xp-current')).toHaveText(/^1\s250 XP$/);
    await expect(page.locator('#xp-next')).toHaveText(/150 XP/);
    // The season runs from 1 November to 31 December wherever the reader is.
    await expect(page.locator('#season-dates')).toHaveText(/1.*nov.*31.*déc.*2026/);
    const track = page.locator('#reward-track');
    await expect(track).toContainText('100 crédits');
    await expect(track).toContainText(/2\s500 crédits/);
    await expect(track).toContainText(fr['season.claimed']);
    await expect(track).toContainText(fr['season.reward.premium']);
    await expect(track.locator('.claim-btn')).toHaveCount(2);
    await expect(track.locator('.claim-btn').first()).toHaveText(fr['season.claim']);
    await expect(track).toContainText(/Atteignez le niveau 20/);
    for (const kind of ['pack', 'title', 'card', 'unknown']) {
      await expect(track).toContainText(fr[`season.reward.${kind}`].split('{')[0].trim());
    }
    // The server's word for a kind of reward never reaches the page.
    await expect(track).not.toContainText('relic');
    await expectNoLeaks(page, spec, 'fr');
  });

  test('season: signed out, the page asks for sign-in; with no season running it says so', async ({ page }) => {
    const spec = (PAGES as PageSpec[])[3];
    await startIn(page, 'it');
    await page.route(/\/api\/v1\/seasons\/current$/, (route) => route.fulfill({ status: 401, body: '' }));
    await page.goto(spec.path);
    const it = await messagesFor(page, spec.areas, 'it');
    await expect(page.locator('#season-signin')).toBeVisible();
    await expect(page.locator('#season-signin p')).toHaveText(it['season.signIn']);
    await expect(page.locator('#season-signin-btn')).toHaveText(it['auth.signIn']);
    await page.unroute(/\/api\/v1\/seasons\/current$/);
    await page.route(/\/api\/v1\/seasons\/current$/, (route) => route.fulfill({ status: 404, contentType: 'text/plain', body: 'No active season' }));
    await page.reload();
    await expect(page.locator('#season-name')).toHaveText(it['error.no_active_season']);
    await expect(page.locator('body')).not.toContainText('No active season');
  });

  test('viewer and VR gallery: what the 3D engine reports is said in the language', async ({ page }) => {
    const viewer = (PAGES as PageSpec[])[4];
    const ko = await open(page, viewer, 'ko');
    // Whatever the engine managed on this machine, its report is a Korean sentence from the viewer area.
    const viewerSays = Object.entries(ko).filter(([k]) => k.startsWith('viewer.status.') || k.startsWith('viewer.error.')).map(([, v]) => v.split('{')[0].trim());
    await expect.poll(async () => {
      const text = ((await page.locator('#viewer-status').textContent()) ?? '').trim();
      return viewerSays.some((s) => s.length > 0 && text.startsWith(s));
    }).toBe(true);
    await expect(page.locator('#reset-camera-btn')).toHaveText(ko['viewer.reset']);

    const vr = (PAGES as PageSpec[])[5];
    await page.goto(vr.path);
    await expect(page).toHaveTitle(`${ko['nav.vr']} | Inspired Mile`);
    const vrSays = Object.entries(ko).filter(([k]) => k.startsWith('vr.status.') || k.startsWith('vr.error.')).map(([, v]) => v.split('{')[0].trim());
    await expect.poll(async () => {
      const text = ((await page.locator('#vr-status').textContent()) ?? '').trim();
      return vrSays.some((s) => s.length > 0 && text.startsWith(s));
    }).toBe(true);
    await expect(page.locator('p a[href="/theatre"]')).toHaveText(ko['vr.play.link']);
    await expectNoLeaks(page, vr, 'ko');
  });
});

test.describe('When the API says no', () => {
  test('a broken server is reported in the language, and none of its own text is shown', async ({ page }) => {
    for (const locale of ['en', 'ar', 'ja', 'ru']) {
      for (const spec of (PAGES as PageSpec[]).slice(0, 4)) {
        const messages = await open(page, spec, locale, { fail: true });
        const body = page.locator('main');
        await expect(body, `${spec.name}/${locale}`).toContainText(messages['error.server_error']);
        const text = await interfaceText(page);
        for (const leak of ['DB error', 'relation', 'does not exist', 'classrooms"']) {
          expect(text.includes(leak), `${spec.name}/${locale}: the server's "${leak}" is on the page`).toBe(false);
        }
        await expectNoLeaks(page, spec, locale);
      }
    }
  });

  test('a refused join code is explained in the language, and again when the language changes', async ({ page }) => {
    const spec = (PAGES as PageSpec[])[0];
    await page.route(/\/api\/v1\/classroom\/join$/, (route) => route.fulfill({ status: 404, contentType: 'text/plain', body: 'Classroom not found' }));
    const hi = await open(page, spec, 'hi');
    await page.evaluate(() => localStorage.setItem('inspired-mile-classroom-consent', 'student'));
    await page.reload();
    await expect(page.locator('#join-form')).toBeVisible();

    await page.click('#join-submit');
    await expect(page.locator('#join-msg')).toHaveText(hi['classroom.join.needCode']);
    await page.fill('#join-code', 'NOSUCH');
    await page.click('#join-submit');
    await expect(page.locator('#join-msg')).toHaveText(hi['error.classroom_not_found']);
    await expect(page.locator('main')).not.toContainText('Classroom not found');

    await page.selectOption('#locale-switch', 'th');
    const th = await messagesFor(page, spec.areas, 'th');
    await expect(page.locator('#join-msg')).toHaveText(th['error.classroom_not_found']);

    // And a join that works names the classroom, whatever script its name is in.
    await page.unroute(/\/api\/v1\/classroom\/join$/);
    await page.route(/\/api\/v1\/classroom\/join$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ joined: true, classroom: DATA.classrooms[1].name }) }));
    await page.click('#join-submit');
    await expect(page.locator('#join-msg')).toHaveText(th['classroom.join.done'].replace('{name}', DATA.classrooms[1].name));
  });

  test('a classroom name is shown as text, never run as markup', async ({ page }) => {
    const spec = (PAGES as PageSpec[])[0];
    await startIn(page, 'en');
    await mockApi(page);
    await page.route(/\/api\/v1\/classroom$/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 9, name: '<img src=x onerror="window.__pwned=1">', join_code: 'AAAAAA', member_count: 2, created_at: '2026-11-02T08:00:00Z' }]) }),
    );
    await page.goto(spec.path);
    await expect(page.locator('#classrooms-list [data-id] h3')).toHaveText('<img src=x onerror="window.__pwned=1">');
    expect(await page.evaluate(() => (window as any).__pwned)).toBeUndefined();
    expect(await page.locator('#classrooms-list img').count()).toBe(0);
  });
});

test.describe('The offline page', () => {
  test('speaks the language the player chose, in all sixteen', async ({ page }) => {
    for (const locale of LOCALES as string[]) {
      await startIn(page, locale);
      await page.goto('/offline.html');
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
      // The same strings the site uses, read from the dev server.
      const shared = await page.evaluate(async (l) => (await import(/* @vite-ignore */ `/src/i18n/pages/shared/${l}.ts`)).default as Record<string, string>, locale);
      await expect(page.locator('h1')).toHaveText(shared['offline.title']);
      await expect(page.locator('p').first()).toHaveText(shared['offline.body']);
      await expect(page.locator('#retry')).toHaveText(shared['offline.retry']);
      await expect(page.locator('a[href="/collection"]')).toHaveText(shared['offline.link.collection']);
      await expect(page).toHaveTitle(`${shared['offline.pageTitle']} — Inspired Mile`);
      if (locale !== 'en') {
        const text = (await page.locator('body').evaluate((b) => {
          const clone = b.cloneNode(true) as HTMLElement;
          clone.querySelectorAll('script, style').forEach((n) => n.remove());
          return clone.textContent ?? '';
        })).replace(/\s+/g, ' ');
        for (const english of ['You are offline', 'Still available offline', 'internet connection', 'Try again']) {
          expect(text.includes(english), `offline/${locale}: "${english}"`).toBe(false);
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    }
  });
});

test.describe('The offline page for a new visitor', () => {
  test.use({ locale: 'ja-JP' });
  test('follows the browser’s language when none was chosen', async ({ page }) => {
    await page.goto('/offline.html');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    await expect(page.locator('h1')).toHaveText('オフラインです');
  });
});

test.describe('The offline page in a language we do not have', () => {
  test.use({ locale: 'sv-SE' });
  test('falls back to English', async ({ page }) => {
    await page.goto('/offline.html');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('h1')).toHaveText('You are offline');
  });
});

test.describe('The install guidance in the player’s language', () => {
  // The same iPhone as tests/pwa.spec.ts: Safari has no install dialog, so the box gives two steps.
  test.use({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1',
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });

  test('names Apple’s own buttons in the language, and is drawn again when the language changes', async ({ page }) => {
    const pwa = (l: string) => page.evaluate(async (code) => (await import(/* @vite-ignore */ `/src/i18n/pages/pwa/${code}.ts`)).default as Record<string, string>, l);
    await startIn(page, 'ja');
    await page.goto('/season');
    const box = page.locator('#pwa-install');
    await expect(box).toHaveAttribute('data-mode', 'ios');
    const ja = await pwa('ja');
    await expect(box.locator('ol li')).toHaveText([ja['pwa.install.iosStep1'], ja['pwa.install.iosStep2']]);
    await expect(box).toHaveAttribute('aria-label', ja['pwa.install.regionLabel']);
    await expect(page.locator('#pwa-install-dismiss')).toHaveText(ja['pwa.install.dismiss']);
    const en = await pwa('en');
    const text = (await box.evaluate((b) => b.textContent ?? '')).replace(/\s+/g, ' ');
    for (const english of Object.values(en)) expect(text.includes(english), `English "${english}" in the Japanese box`).toBe(false);

    await page.selectOption('#locale-switch', 'ar');
    const ar = await pwa('ar');
    await expect(box.locator('ol li')).toHaveText([ar['pwa.install.iosStep1'], ar['pwa.install.iosStep2']]);
    await expect(page.locator('#pwa-install-dismiss')).toHaveText(ar['pwa.install.dismiss']);
    // Still one box, inside the screen.
    await expect(box).toHaveCount(1);
    const r = (await box.boundingBox())!;
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(390 + 1);
  });
});
