import { test, expect, type Page } from '@playwright/test';

/**
 * The pages a visitor sees first (home, about, collection, profile, world map) in all
 * sixteen interface languages.
 *
 * Each page is loaded in each language with a player who owns cards, variants, a saved deck
 * and achievements, so the text a script draws is there to be checked. Then:
 *   - <html> carries the language and its direction, and the document title and description
 *     are the language's own;
 *   - nothing untranslated shows: no {placeholder}, no message key, no <b> or <a> mark, and no
 *     English string of the page (taken from the English message files themselves, plus a list
 *     of what the pages said before they were translated);
 *   - nothing is wider than the phone screen it is on.
 *
 * textContent, not innerText (see tests/i18n.spec.ts): labels styled in capitals hid a leak
 * from innerText before, and hidden panels must be translated too.
 *
 * Left out of the comparison on purpose, each marked in the markup:
 *   [data-card-text]    card names, quotations and scene texts: the card data layer's
 *   [data-proper-name]  people's names, a place name in an address, a programme's name
 *   [data-style-name]   attire and hairstyle options of a city (English in the catalog)
 *   [data-user-text]    what the player typed (a deck's name)
 */

const LOCALES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ar', 'hi', 'zh', 'ja', 'ko', 'vi', 'th', 'id'] as const;
type L = (typeof LOCALES)[number];
type Messages = Record<string, string>;

const PAGES: { path: string; areas: string[]; titleKey: string; descriptionKey: string }[] = [
  { path: '/', areas: ['home', 'card-terms'], titleKey: 'nav.home', descriptionKey: 'home.meta.description' },
  { path: '/about', areas: ['about'], titleKey: 'nav.about', descriptionKey: 'about.meta.description' },
  { path: '/collection', areas: ['collection', 'card-terms', 'variants', 'achievements', 'rules'], titleKey: 'collection.meta.title', descriptionKey: 'collection.meta.description' },
  { path: '/profile', areas: ['profile', 'card-terms', 'achievements'], titleKey: 'nav.profile', descriptionKey: 'profile.meta.description' },
  { path: '/world-map', areas: ['world-map', 'variants', 'card-terms'], titleKey: 'nav.worldMap', descriptionKey: 'world-map.meta.description' },
];

/** What these pages said in English before this work, whether or not a message file still says it. */
const ENGLISH_BEFORE = [
  'Where Cards', 'Come Alive', 'Enter the Playground', 'View Collection', 'Cards to Collect', 'Servers Reading Your Verse', 'Master Thespian',
  'Digital Cards', 'The Verse Duel', 'Private by Design', 'Choose your allegiance', 'Enter the Arena', 'Earn Cards', 'cards owned',
  'Meet the team', 'The Vision', 'Why Shakespeare', 'Creative Director', 'Our creative partner', 'Team formed', 'Platform goes live', 'Digital Collectibles',
  'Free Forever', 'Earn Credits', 'Safe for Students', 'Daily free card packs', 'No ads', 'Try the Battle Arena', 'Founded',
  'My Collection', 'Locked', 'World Cards', 'variants unlocked', 'cities discovered', 'Deck Builder', 'Save Deck', 'Click owned', 'Active Synergies',
  'Saved Decks', 'No saved decks', 'Activate', 'Passive:', 'Uses per battle', 'Add to Deck', 'Achievements', 'Unlocked', 'Enter a deck name',
  'Player Profile', 'Guest Player', 'Playing locally', 'Battle Wins', 'Total Battles', 'Win Rate', 'Highest Score', 'Trivia Correct', 'Cards by House',
  'Cards by Rarity', 'Global Leaderboard', 'Loading leaderboard', 'Recent Activity', 'Latest Cards', 'Latest Achievements', 'No cards acquired',
  'World Map', 'possible combinations', 'Attire Styles', 'Hairstyles', 'Your Variants', 'No variants', 'Neon Precision', 'First Blood', 'Win your first battle',
  'Danish Court', 'Forest of Arden', 'Character', 'Relic', 'Potion', 'Legendary', 'bronze', 'silver', 'West Africa', 'North America', 'battle streak',
  'Lends power words', 'Costs 1 ink', 'Need at least', 'Curses your opponent',
];

const cache = new Map<string, Messages>();
async function messages(kind: 'area' | 'core', name: string, l: L): Promise<Messages> {
  const id = `${kind}/${name}/${l}`;
  if (!cache.has(id)) cache.set(id, (await import(kind === 'area' ? `../src/i18n/pages/${name}/${l}.ts` : `../src/i18n/locales/${l}.ts`)).default);
  return cache.get(id)!;
}

/** A player with something of everything, so every list on these pages has rows. */
async function seed(page: Page) {
  await page.addInitScript(() => {
    const now = Date.now();
    const owned = ['SM-001', 'MO-001', 'MO-002', 'CA-001', 'DC-001', 'DC-002', 'RL-001', 'RL-002', 'PT-001', 'PT-002', 'PT-003', 'MO-001'];
    localStorage.setItem('inspired-mile-inventory', JSON.stringify({ cards: owned.map((cardId, i) => ({ cardId, acquiredAt: now - i * 86400000, source: 'starter' })), starterClaimed: true, lastDailyPack: 0, battleWins: 3, triviaCorrect: 5, challengesCompleted: 1 }));
    localStorage.setItem('inspired-mile-variants', JSON.stringify([
      { variantId: 'MO-001-TKY-00-01-02', baseCardId: 'MO-001', acquiredAt: now, source: 'battle-streak' },
      { variantId: 'DC-001-CAI-01-00-03', baseCardId: 'DC-001', acquiredAt: now, source: 'trivia-mastery' },
    ]));
    localStorage.setItem('inspired-mile-decks', JSON.stringify([{ name: 'Elsinore', characters: ['DC-001', 'DC-002', 'MO-001'], relics: ['RL-001'], potions: ['PT-002'] }, { name: 'Verona', characters: ['MO-001', 'MO-002', 'CA-001'], relics: [], potions: [] }]));
    localStorage.setItem('inspired-mile-active-deck', 'Elsinore');
    localStorage.setItem('inspired-mile-achievements', JSON.stringify([{ id: 'first-blood', unlockedAt: now - 86400000 }, { id: 'card-collector', unlockedAt: now }]));
    localStorage.setItem('inspired-mile-player-stats', JSON.stringify({ battleWins: 3, totalBattles: 7, totalRounds: 21, highestScore: 38, triviaCorrect: 5, triviaPerfect: 0, challengesCompleted: 1, uniqueCards: 11, totalCards: 12, packsOpened: 2 }));
  });
}

async function show(page: Page, path: string, l: L) {
  await page.evaluate((code) => localStorage.setItem('inspired-mile-locale', code), l);
  await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('data-i18n-ready', l);
  await expect(page.locator('html')).toHaveAttribute('data-title-locale', l);
  await expect(page.locator('html')).toHaveAttribute('lang', l);
  await expect(page.locator('html')).toHaveAttribute('dir', l === 'ar' ? 'rtl' : 'ltr');
}

/** Bring out what a click or a mistake would show: the modals, a deck with a synergy, an error. */
async function reveal(page: Page, path: string) {
  if (path === '/collection') {
    await page.evaluate(() => {
      (document.querySelector('.deck-load[data-deck-name="Verona"]') as HTMLElement).click();
      (document.getElementById('deck-name') as HTMLInputElement).value = '';
      (document.getElementById('save-deck-btn') as HTMLElement).click();
    });
    await expect(page.locator('#deck-errors')).toBeVisible();
    await expect(page.locator('#synergy-preview')).toBeVisible();
  }
  if (path === '/world-map') {
    await page.click('#world-grid [data-city="Tokyo"]');
    await expect(page.locator('#city-modal')).not.toHaveClass(/hidden/);
  }
}

async function interfaceText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('[data-card-text], [data-proper-name], [data-style-name], [data-user-text], #locale-switch, #age-gate, script, style, svg, model-viewer').forEach((n) => n.remove());
    return (clone.textContent ?? '').replace(/\s+/g, ' ');
  });
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** The pieces of a message a reader would see: between its {placeholders}, without its marks. */
const pieces = (s: string) => s.replace(/<\/?[ab]>/g, '').split(/\{[a-zA-Z_]+\}/).map((p) => p.trim().replace(/^[:·/()\s]+|[:·/()\s]+$/g, '')).filter((p) => p.replace(/\s/g, '').length >= 4);

/** English pieces of these areas that this language says differently, and never uses inside its own text. */
async function englishOf(areas: string[], l: L): Promise<string[]> {
  const mine: string[] = Object.values(await messages('core', '', l));
  const out = new Set<string>();
  const pairs: [Messages, Messages][] = [];
  for (const a of areas) pairs.push([await messages('area', a, 'en'), await messages('area', a, l)]);
  for (const [, m] of pairs) mine.push(...Object.values(m));
  for (const [en, m] of pairs) {
    for (const k of Object.keys(en)) {
      if (en[k] === m[k]) continue;
      for (const p of pieces(en[k])) if (!mine.some((v) => v.includes(p))) out.add(p);
    }
  }
  return [...out];
}

const KEY_SHOWN = /\b(?:home|about|collection|profile|world-map|variants|card-terms|rules|achievements|nav|footer|auth|rarity|criterion|variant|device|curse|house)\.[a-zA-Z][a-zA-Z0-9-]*(?:\.[a-zA-Z0-9-]+)*\b/g;

async function expectTranslated(page: Page, areas: string[], l: L, where: string) {
  const text = await interfaceText(page);
  expect(text.length, `${where}: the page has text`).toBeGreaterThan(300);
  expect(text.match(/\{[a-zA-Z_]+\}/g), `${where}: unfilled placeholders`).toBeNull();
  expect(text.match(/<\/?[ab]>|@@var:/g), `${where}: marks shown as text`).toBeNull();
  // A host name is not a key ("davidjcharlot.com").
  expect((text.match(KEY_SHOWN) ?? []).filter((k) => !/\.(com|org)$/.test(k)), `${where}: message keys shown as text`).toEqual([]);
  if (l === 'en') return;
  const english = [...(await englishOf(areas, l)), ...ENGLISH_BEFORE];
  const mine: string[] = Object.values(await messages('core', '', l));
  for (const a of areas) mine.push(...Object.values(await messages('area', a, l)));
  const leaked = english.filter((s) => !mine.some((v) => v.includes(s)) && new RegExp(`(^|[^\\p{L}])${escapeRe(s)}($|[^\\p{L}])`, 'u').test(text));
  expect(leaked, `${where}: English still on the page`).toEqual([]);
}

async function expectFits(page: Page, where: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${where}: the page is wider than the screen`).toBeLessThanOrEqual(1);
  // The navigation bar is fixed, so what does not fit in it is cut off without widening the page:
  // German's "Anmelden" once pushed the menu button off a phone's screen.
  const cut = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    return ['#mobile-menu-btn', '#auth-btn', '#locale-switch', '#audio-toggle', '#planted']
      .map((sel) => [sel, document.querySelector(sel)?.getBoundingClientRect()] as const)
      .filter(([, r]) => r && r.width > 0 && (r.left < 0 || r.right > vw + 0.5))
      .map(([sel]) => sel);
  });
  expect(cut, `${where}: cut off by the edge of the screen`).toEqual([]);
}

for (const p of PAGES) {
  test.describe(`${p.path} in every language`, () => {
    test.use({ viewport: { width: 390, height: 844 } });
    test.setTimeout(240000);

    test('title, description and text are the language’s own, and the page fits a phone', async ({ page }) => {
      await seed(page);
      await page.goto(p.path);
      for (const l of LOCALES) {
        const where = `${p.path} [${l}]`;
        await show(page, p.path, l);

        const title = p.titleKey.startsWith('nav.') ? (await messages('core', '', l))[p.titleKey] : (await messages('area', p.titleKey.split('.')[0], l))[p.titleKey];
        const description = (await messages('area', p.descriptionKey.split('.')[0], l))[p.descriptionKey];
        expect(title, where).toBeTruthy();
        await expect(page, where).toHaveTitle(`${title} | Inspired Mile`);
        await expect(page.locator('meta[name="description"]'), where).toHaveAttribute('content', description);
        await expect(page.locator('meta[property="og:title"]'), where).toHaveAttribute('content', `${title} | Inspired Mile`);
        await expect(page.locator('meta[property="og:description"]'), where).toHaveAttribute('content', description);

        await expectFits(page, where);
        await reveal(page, p.path);
        await expectTranslated(page, p.areas, l, where);
      }
    });
  });
}

test.describe('The checks can fail', () => {
  test('English put back on a translated page is caught, and so is a bare key, a placeholder and a mark', async ({ page }) => {
    await seed(page);
    await page.goto('/collection');
    await show(page, '/collection', 'ja');
    const areas = PAGES[2].areas;
    await expectTranslated(page, areas, 'ja', 'clean');
    const plant = async (text: string, upper = false) => {
      await page.evaluate(([s, u]) => {
        document.getElementById('planted')?.remove();
        const el = document.createElement('p');
        el.id = 'planted';
        el.textContent = s as string;
        // Styled in capitals and hidden: what innerText would have missed.
        if (u) el.style.cssText = 'text-transform: uppercase; display: none';
        document.querySelector('main, body')!.appendChild(el);
      }, [text, upper] as const);
    };
    for (const [bad, upper] of [['Save Deck', true], ['Characters in a deck: at least 3.', false], ['collection.deck.save', false], ['Cards owned: {owned}', false], ['My <b>Collection</b>', false]] as const) {
      await plant(bad, upper);
      await expect(expectTranslated(page, areas, 'ja', `planted "${bad}"`), `"${bad}" should have been caught`).rejects.toThrow();
    }
    await plant('デッキを保存');
    await expectTranslated(page, areas, 'ja', 'Japanese planted');

    // And the width check: something wider than the screen is noticed.
    await expectFits(page, 'clean');
    await page.evaluate(() => {
      document.getElementById('planted')!.style.cssText = 'width: 200vw; height: 1px';
    });
    await expect(expectFits(page, 'planted')).rejects.toThrow();
  });
});

test.describe('Translated pages: what a script draws', () => {
  test('collection: cards, the deck builder, the card detail view and achievements follow the language without a reload', async ({ page }) => {
    await seed(page);
    await page.goto('/collection');
    await expect(page.locator('html')).toHaveAttribute('data-i18n-ready', 'en');
    await expect(page.locator('#owned-count')).toHaveText('11');
    await expect(page.locator('#achievement-total')).toHaveText('30');
    await expect(page.locator('#variant-count')).toHaveText('2');
    await expect(page.locator('#city-count')).toHaveText('2');
    await expect(page.locator('.card-item[data-id="MO-001"]')).toContainText('Montague · Passion');
    await expect(page.locator('#saved-decks-list')).toContainText('Characters: 3 · Relics: 1 · Potions: 1 · Total: 5');

    await page.selectOption('#locale-switch', 'es');
    await expect(page.locator('html')).toHaveAttribute('data-i18n-ready', 'es');
    await expect(page.locator('main h1')).toHaveText('Mi colección');
    await expect(page.locator('.card-item[data-id="MO-001"]')).toContainText('Montesco · Pasión');
    await expect(page.locator('.card-item[data-id="MO-001"] [data-term-rarity]')).toHaveText('Rara');
    await expect(page.locator('[data-filter="Relic"]')).toHaveText('Reliquias');
    await expect(page.locator('#saved-decks-list')).toContainText('Personajes: 3 · Reliquias: 1 · Pociones: 1 · Total: 5');
    await expect(page.locator('#city-grid')).toContainText('Tokio');
    await expect(page.locator('#city-grid')).toContainText('África occidental');
    await expect(page.locator('#variant-list')).toContainText('Racha de batallas');
    await expect(page.locator('#achievement-grid')).toContainText('Primera sangre');
    await expect(page.locator('#achievement-grid')).toContainText('Cartas distintas conseguidas: 5');
    await expect(page.locator('#deck-name')).toHaveAttribute('placeholder', 'Nombre del mazo…');

    // The card detail view: a character's device, a relic's power words in Spanish, a potion's curse.
    await page.evaluate(() => (window as any).__collection.openCardModal('DC-001'));
    await expect(page.locator('#modal-content')).toContainText('Pasiva: La Pregunta');
    await expect(page.locator('#modal-content')).toContainText('Corte danesa · Sombra · Épica');
    await expect(page.locator('#modal-content')).toContainText('Lógralo para sumar la mitad más a tu oficio.');
    await page.evaluate(() => (window as any).__collection.openCardModal('RL-001'));
    await expect(page.locator('#modal-content')).toContainText('Presta palabras de poder:');
    await expect(page.locator('#modal-content')).toContainText('Coste de tinta: 1.');
    await expect(page.locator('#modal-content')).toContainText('Usos por batalla: 1');
    // Open in one language, read in the next: the view is drawn again.
    await page.selectOption('#locale-switch', 'de');
    await expect(page.locator('html')).toHaveAttribute('data-i18n-ready', 'de');
    await expect(page.locator('#modal-content')).toContainText('Leiht Machtworte:');
    await page.evaluate(() => (window as any).__collection.openCardModal('PT-002'));
    await expect(page.locator('#modal-content')).toContainText('Verflucht die nächste Strophe deines Gegners');
    // The quotation in German marks (CLDR), the line itself as the card data gives it.
    await expect(page.locator('#modal-content [data-qo]')).toHaveText('„');
    await expect(page.locator('#modal-content [data-qc]')).toHaveText('“');
    await page.evaluate(() => (window as any).__collection.closeModal());

    // A deck that cannot be saved says why in the language, and says it again in the next one.
    await page.fill('#deck-name', 'Zu klein');
    await page.click('#clear-deck-btn');
    await page.fill('#deck-name', 'Zu klein');
    await page.click('#save-deck-btn');
    await expect(page.locator('#deck-errors')).toHaveText('Figuren in einem Deck: mindestens 3.');
    await page.selectOption('#locale-switch', 'fr');
    await expect(page.locator('html')).toHaveAttribute('data-i18n-ready', 'fr');
    await expect(page.locator('#deck-errors')).toHaveText('Personnages dans un jeu : au moins 3.');
    await expect(page.locator('#deck-characters')).toContainText('Cliquez sur vos personnages pour les ajouter');
    await expect(page.locator('.card-item[data-id="MO-001"] [data-qo]')).toHaveText('«');
    await expect(page.locator('.card-item[data-id="MO-001"] [data-qc]')).toHaveText('»');
  });

  test('numbers, dates and regions come from the browser in the language', async ({ page }) => {
    await seed(page);
    await page.goto('/world-map');
    await show(page, '/world-map', 'de');
    await expect(page.locator('#world-grid [data-city="Lagos"]')).toContainText('Westafrika');
    await expect(page.locator('#world-grid [data-city="Cairo"]')).toContainText('Kairo');
    await expect(page.locator('#world-grid [data-city="Tokyo"]')).toContainText('+2 Wortspiel');
    await expect(page.locator('section p', { hasText: 'Mögliche Kombinationen' })).toContainText('101.760');
    await show(page, '/world-map', 'ar');
    await expect(page.locator('#modal-city-name')).toBeEmpty();
    await page.click('#world-grid [data-city="Cairo"]');
    await expect(page.locator('#modal-city-name')).toHaveText('القاهرة');
    await expect(page.locator('#modal-region')).toHaveText('شمال أفريقيا');
    await expect(page.locator('#modal-variants')).toContainText('Hamlet');

    await show(page, '/about', 'ja');
    await expect(page.locator('[data-when-month="2025-3"]')).toHaveText('2025年3月');
    await expect(page.locator('[data-when-key="about.journey.quarter1"]')).toHaveText('2026年第1四半期');
    await show(page, '/about', 'pl');
    await expect(page.locator('[data-when-month="2025-3"]')).toHaveText('mar 2025');

    await show(page, '/profile', 'fr');
    await expect(page.locator('#stat-winrate')).toHaveText(/^43\s%$/);
    await expect(page.locator('#recent-achievements')).toContainText('Premier sang');
    await expect(page.locator('#house-bars')).toContainText('Montaigu');
    await expect(page.locator('#rarity-bars')).toContainText('Légendaire');
  });

  test('a count out of a total reads left to right on the Arabic pages, as numbers do', async ({ page }) => {
    // "Cards owned: 11 / 71": with spaces round the slash, the bidirectional algorithm laid the two
    // numbers out right to left on an Arabic page, and the screen said 71 / 11 (screenshots, 2026-11-16).
    // Read where the two numbers really are: the count must stand left of the total.
    const countLeftOfTotal = (id: string, plantSpaced = false) =>
      page.evaluate(([numId, spaced]) => {
        const n = document.getElementById(numId as string)!;
        const after = n.parentElement!.nextSibling as Text; // the text after the accent span: "/71", or "/" then the total's own span
        if (spaced) after.data = after.data.replace(/^\s*\/\s*/, ' / ');
        const m = after.data.match(/[\d٠-٩][\d٠-٩.,٬]*/);
        let total: DOMRect;
        if (m) {
          const r = document.createRange();
          r.setStart(after, m.index!);
          r.setEnd(after, m.index! + m[0].length);
          total = r.getBoundingClientRect();
        } else total = (after.nextSibling as Element).getBoundingClientRect();
        return n.getBoundingClientRect().left < total.left;
      }, [id, plantSpaced] as const);
    await seed(page);
    await page.goto('/collection');
    for (const l of ['ar', 'en'] as const) {
      await show(page, '/collection', l);
      expect([l, 'owned', await countLeftOfTotal('owned-count')]).toEqual([l, 'owned', true]);
      expect([l, 'achievements', await countLeftOfTotal('achievement-count')]).toEqual([l, 'achievements', true]);
      expect([l, 'cities', await countLeftOfTotal('city-count')]).toEqual([l, 'cities', true]);
      await show(page, '/world-map', l);
      expect([l, 'world map', await countLeftOfTotal('total-cities')]).toEqual([l, 'world map', true]);
    }
    // The check can fail: put the spaces back on the Arabic page and the numbers swap sides.
    await show(page, '/world-map', 'ar');
    expect(await countLeftOfTotal('total-cities', true)).toBe(false);
  });

  test('a signed number reads +50 on the Arabic pages, not 50+', async ({ page }) => {
    // Where the "+" really stands against its digits, in the first element matching `selector`.
    // With `strip`, the isolate characters signedLtr() adds are taken out first: the old rendering.
    const plusLeftOfDigits = (selector: string, strip = false) =>
      page.evaluate(([sel, s]) => {
        const el = document.querySelector(sel as string)!;
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
          if (s) n.data = n.data.replace(/[\u2066\u2069]/g, '');
          const m = n.data.match(/\+(\d+)/);
          if (!m) continue;
          const at = (from: number, to: number) => {
            const r = document.createRange();
            r.setStart(n!, from);
            r.setEnd(n!, to);
            return r.getBoundingClientRect();
          };
          const plus = at(m.index!, m.index! + 1);
          const digits = at(m.index! + 1, m.index! + m[0].length);
          return plus.left < digits.left;
        }
        return null;
      }, [selector, strip] as const);
    await seed(page);
    await page.goto('/about');
    for (const l of ['ar', 'en'] as const) {
      await show(page, '/about', l);
      expect([l, await plusLeftOfDigits('[data-i18n-html="about.free.earn.l1"]')]).toEqual([l, true]);
      await show(page, '/world-map', l);
      expect([l, await plusLeftOfDigits('#world-grid [data-city="Tokyo"]')]).toEqual([l, true]);
    }
    // The check can fail: without the isolate the Arabic page puts the sign after the number.
    await show(page, '/about', 'ar');
    expect(await plusLeftOfDigits('[data-i18n-html="about.free.earn.l2"]', true)).toBe(false);
  });

  test('an unlocked achievement is announced in the language', async ({ page }) => {
    await seed(page);
    await page.goto('/');
    await show(page, '/', 'it');
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('achievement-unlocked', { detail: { id: 'battle-master', name: 'Battle Master', description: 'Win 10 battles', tier: 'silver', goal: 10, icon: '⚔' } })));
    await expect(page.locator('#achievement-toasts')).toContainText('Maestro di battaglia');
    await expect(page.locator('#achievement-toasts')).toContainText('Battaglie vinte: 10');
    await expect(page.locator('#achievement-toasts')).toContainText('Obiettivo sbloccato');
  });

  test('a page with no title key of its own is named from the navigation', async ({ page }) => {
    await page.goto('/battle?brain=rules');
    await page.evaluate(() => localStorage.setItem('inspired-mile-locale', 'es'));
    await page.goto('/battle?brain=rules');
    await expect(page.locator('html')).toHaveAttribute('data-title-locale', 'es');
    await expect(page).toHaveTitle('Arena de batalla | Inspired Mile');
    await page.selectOption('#locale-switch', 'ko');
    await expect(page).toHaveTitle('배틀 아레나 | Inspired Mile');
  });

  test('the battle page and the theatre: title and description in every language', async ({ page }) => {
    test.setTimeout(240000);
    // Both pages' descriptions are their own introductions (core keys); the theatre's name is the about page's.
    const PAGES_ELSEWHERE = [
      { path: '/battle?brain=rules', title: async (l: L) => (await messages('core', '', l))['nav.battle'], descriptionKey: 'battle.intro' },
      { path: '/theatre', title: async (l: L) => (await messages('area', 'about', l))['about.tech.theatre.title'], descriptionKey: 'theatre.intro' },
    ];
    await page.goto('/battle?brain=rules');
    for (const p of PAGES_ELSEWHERE) {
      for (const l of LOCALES) {
        const where = `${p.path} [${l}]`;
        // Not show(): data-i18n-ready belongs to the page areas' runtime, which these two pages do not use.
        await page.evaluate((code) => localStorage.setItem('inspired-mile-locale', code), l);
        await page.goto(p.path);
        await expect(page.locator('html'), where).toHaveAttribute('data-title-locale', l);
        await expect(page.locator('html'), where).toHaveAttribute('lang', l);
        const title = `${await p.title(l)} | Inspired Mile`;
        const description = (await messages('core', '', l))[p.descriptionKey];
        expect([where, title.length > 16, (description ?? '').length > 20]).toEqual([where, true, true]);
        await expect(page, where).toHaveTitle(title);
        await expect(page.locator('meta[name="description"]'), where).toHaveAttribute('content', description);
        await expect(page.locator('meta[property="og:description"]'), where).toHaveAttribute('content', description);
        await expect(page.locator('meta[name="twitter:title"]'), where).toHaveAttribute('content', title);
      }
    }
  });
});
