/**
 * The page areas of the classroom, marketplace, tournament, season, viewer and VR pages,
 * and what several pages share (src/i18n/pages/<area>/<locale>.ts).
 *
 * These are mechanical checks: they say that every language has every string, with the same
 * {placeholders} and the plural forms its grammar needs, that the pages ask only for keys
 * that exist, and that the two generated static files are up to date. They do not say the
 * translations read well: for that see docs/language/pages-rest.md.
 *
 * scripts/pages-rest/mutate.mjs breaks each thing this file looks at and expects it to go red.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { LOCALES, has, loadArea, loadMessages, setLocale, t, type Locale, type Messages } from './index';
import { PLURAL_CATEGORIES, date, dateRange, dateTime, intlLocale, list, num, plural, pluralCategory, signed } from './fmt';
import { initPage, onPageLocaleChange } from './page';
import en from './locales/en';
// @ts-ignore a plain .mjs script, shared with the command line
import { OFFLINE_KEYS, SHORTCUT_KEYS, localiseManifest, renderOffline } from '../../scripts/pages-rest/build-static.mjs';

// loadArea merges an area into the core messages of its language (English included), so
// what the core locale itself holds is noted before any test loads one.
const CORE_EN_KEYS = new Set(Object.keys(en));

const AREAS = ['classroom', 'marketplace', 'tournaments', 'season', 'viewer', 'shared', 'pwa'] as const;
type Area = (typeof AREAS)[number];

/** Which areas each page asks for, and so which keys its markup and script may use. */
const PAGES: Record<string, readonly Area[]> = {
  'src/pages/classroom.astro': ['classroom', 'shared'],
  'src/pages/marketplace.astro': ['marketplace', 'shared'],
  'src/pages/tournaments.astro': ['tournaments', 'shared'],
  'src/pages/season.astro': ['season', 'shared'],
  'src/pages/viewer.astro': ['viewer'],
  'src/pages/vr.astro': ['viewer'],
};

const modules = import.meta.glob<{ default: Messages }>('./pages/*/*.ts', { eager: true });
function area(name: Area, l: Locale): Messages {
  const found = modules[`./pages/${name}/${l}.ts`];
  if (!found) throw new Error(`no module for ${name}/${l}`);
  return found.default;
}

const placeholders = (s: string) => [...s.matchAll(/\{([a-zA-Z_]+)\}/g)].map((m) => m[1]).sort();

/** 'credits.one' -> ['credits', 'one']; an ordinary key -> [key, null]. */
function pluralParts(key: string): [string, string | null] {
  for (const c of PLURAL_CATEGORIES) if (key.endsWith(`.${c}`)) return [key.slice(0, -c.length - 1), c];
  return [key, null];
}
const plainKeys = (m: Messages) => Object.keys(m).filter((k) => pluralParts(k)[1] === null).sort();
const pluralBases = (m: Messages) => [...new Set(Object.keys(m).filter((k) => pluralParts(k)[1] !== null).map((k) => pluralParts(k)[0]))].sort();

/**
 * Values that are rightly the same as English: a pattern with no words of its own, an
 * abbreviation the language keeps, or a word the two languages share. Anything else that
 * reads the same as English is an untranslated string.
 */
const SAME_AS_ENGLISH: Record<string, readonly string[] | '*'> = {
  'tour.option': '*', // "{name} ({status})"
  'season.xp': '*', // "{n} XP"
  'season.xpGain': '*',
  'viewer.fps': ['es', 'de', 'it', 'pt', 'hi', 'ja', 'ko', 'id'], // "fps" is kept
  'classroom.list.code': ['de'],
  'market.status.active': ['fr'],
  'tour.match.live': ['de'],
  'tour.col.status': ['de', 'pl', 'id'],
  'tour.label.format': ['pl', 'id'],
  'tour.bye': ['it', 'id'], // Italian tennis and Indonesian sport both say "bye" (Wikidata Q1268659)
  'season.reward.premium': ['fr', 'de', 'it', 'pt', 'pl', 'id'],
  'season.level': ['id'],
  'season.reward.level': ['id'],
  'vr.card.desktop.title': ['de', 'it'],
  'offline.pageTitle': ['de', 'it', 'pt', 'pl'],
  'offline.link.collection': ['fr'],
  'offline.link.home': ['it'],
};

describe('page areas: every language has every string', () => {
  it('has a module for each of the sixteen languages in each area, and no other file in them', () => {
    // Other branches add areas of their own beside these; only this branch's are looked at.
    const mine = Object.keys(modules).filter((k) => (AREAS as readonly string[]).includes(k.split('/')[2]));
    expect(mine.sort()).toEqual(AREAS.flatMap((a) => LOCALES.map((l) => `./pages/${a}/${l}.ts`)).sort());
  });

  it('gives every locale exactly the keys of English, no empty value, and the same placeholders', () => {
    const problems: string[] = [];
    for (const a of AREAS) {
      const ref = area(a, 'en');
      for (const l of LOCALES) {
        const m = area(a, l);
        for (const k of plainKeys(ref)) if (!(k in m)) problems.push(`${a}/${l}: missing ${k}`);
        for (const k of plainKeys(m)) if (!(k in ref)) problems.push(`${a}/${l}: extra ${k}`);
        if (pluralBases(m).join() !== pluralBases(ref).join()) problems.push(`${a}/${l}: counted messages are {${pluralBases(m)}} but English has {${pluralBases(ref)}}`);
        for (const [k, v] of Object.entries(m)) {
          if (typeof v !== 'string' || v.trim().length === 0) {
            problems.push(`${a}/${l}: empty ${k}`);
            continue;
          }
          const [base, category] = pluralParts(k);
          const english = category === null ? ref[k] : ref[`${base}.other`];
          if (english !== undefined) {
            const mine = placeholders(v);
            const theirs = placeholders(english);
            // "one credit" may be written out, without the number; nothing else may drop or add a variable.
            const writtenOut = category !== null && ['zero', 'one', 'two'].includes(category) && mine.every((p) => theirs.includes(p));
            if (mine.join() !== theirs.join() && !writtenOut) problems.push(`${a}/${l}: ${k} has {${mine}} but English has {${theirs}}`);
          }
          // A brace that is not a placeholder is a typo that would be shown to the player.
          if (/[{}]/.test(v.replace(/\{[a-zA-Z_]+\}/g, ''))) problems.push(`${a}/${l}: stray brace in ${k}`);
          // Markup in a message would be shown as text (or, worse, not).
          if (/[<>]/.test(v)) problems.push(`${a}/${l}: angle bracket in ${k}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('has, for every counted message, each plural form the language uses (Unicode CLDR, through Intl.PluralRules)', () => {
    const problems: string[] = [];
    for (const a of AREAS) {
      for (const l of LOCALES) {
        const m = area(a, l);
        const needed = new Intl.PluralRules(l).resolvedOptions().pluralCategories;
        for (const base of pluralBases(m)) {
          if (!(`${base}.other` in m)) problems.push(`${a}/${l}: ${base} has no "other" form`);
          for (const c of needed) if (!(`${base}.${c}` in m)) problems.push(`${a}/${l}: ${base} lacks the "${c}" form`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('is actually translated: nothing reads the same as English unless it is listed as shared', () => {
    const problems: string[] = [];
    for (const a of AREAS) {
      const ref = area(a, 'en');
      for (const l of LOCALES) {
        if (l === 'en') continue;
        const m = area(a, l);
        for (const [k, v] of Object.entries(m)) {
          if (ref[k] === undefined || v !== ref[k]) continue;
          const allowed = SAME_AS_ENGLISH[k];
          if (allowed !== '*' && !allowed?.includes(l)) problems.push(`${a}/${l}: ${k} is still English ("${v}")`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('is clean text: normal form C, no hidden or directional characters, and each language’s own punctuation', () => {
    // The rules of branch lang/qa-pipeline (scripts/lang/lib/mechanical.mjs) that a short test
    // can hold; the whole set was run once over these areas (docs/language/pages-rest.md).
    const problems: string[] = [];
    const CJK = '\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}';
    for (const a of AREAS) {
      for (const l of LOCALES) {
        for (const [k, v] of Object.entries(area(a, l))) {
          const bad = (what: string) => problems.push(`${a}/${l}: ${k}: ${what}`);
          if (v.normalize('NFC') !== v) bad('not in Unicode normal form C');
          for (const ch of v) {
            const cp = ch.codePointAt(0)!;
            if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0) || cp === 0xfffd) bad(`control or replacement character U+${cp.toString(16)}`);
            if ((cp >= 0x200e && cp <= 0x200f) || (cp >= 0x202a && cp <= 0x202e) || (cp >= 0x2066 && cp <= 0x2069) || cp === 0x061c) bad(`directional control U+${cp.toString(16)}`);
            if (cp === 0x200b || cp === 0xfeff || cp === 0x00ad || cp === 0x2060 || ((cp === 0x200c || cp === 0x200d) && l !== 'hi')) bad(`invisible character U+${cp.toString(16)}`);
          }
          if (/ {2,}/.test(v)) bad('two spaces in a row');
          if (v.includes('"')) bad('a typewriter quotation mark; use the language’s own');
          if (/([,;:!?،؛؟。、，；：！？])\1/u.test(v)) bad('doubled punctuation');
          if (l === 'fr') {
            // French sets a no-break space before ; : ! ? and inside « ».
            for (const m of v.matchAll(/(.)([;:!?»])/gu)) {
              if (m[1] === '\u00a0' || m[1] === '\u202f' || (m[2] === ':' && /\d/.test(m[1]))) continue;
              bad(`"${m[1]}${m[2]}" needs a no-break space before ${m[2]}`);
            }
            if (/«[^\u00a0\u202f]/u.test(v)) bad('a no-break space is needed after «');
          } else if (/[\u00a0\u202f]/.test(l === 'de' ? v.replace(/\u00a0…/g, '…') : v)) {
            // German sets one before an ellipsis that stands for omitted words (as branch
            // lang/qa-pipeline writes the core locale); nowhere else.
            bad('a no-break space outside French, and outside German before …');
          }
          if (l === 'de' && /[^\s\u00a0]…/.test(v)) bad('German puts a no-break space before …');
          if (l === 'es') {
            if (v.split('?').length !== v.split('¿').length || v.split('!').length !== v.split('¡').length) bad('¿…? or ¡…! do not pair');
          } else if (/[¿¡]/.test(v)) bad('¿ or ¡ outside Spanish');
          if (l === 'zh' || l === 'ja') {
            if (new RegExp(`[${CJK}][,;:!?]|[,;:!?][${CJK}]|[${CJK}]\\.(?:\\s|$)`, 'u').test(v)) bad('half-width punctuation in Chinese or Japanese text');
            if (new RegExp(`[${CJK}] [${CJK}]`, 'u').test(v)) bad('a space between two characters');
          } else if (/[，。；：！？、（）「」『』]/u.test(v) && l !== 'ko') bad('full-width punctuation outside Chinese and Japanese');
          if (l === 'ar') {
            if (/\p{Script=Arabic}\s?[,;?]|[,;?]\s?\p{Script=Arabic}/u.test(v)) bad('Arabic writes ، ؛ ؟');
            if (/ـ/.test(v)) bad('tatweel in text');
          } else if (/[،؛؟]/.test(v)) bad('Arabic punctuation outside Arabic');
          if (l === 'hi') {
            if (/\p{Script=Devanagari}\.(?:\s|$)/u.test(v)) bad('a Hindi sentence ends with the danda (।)');
          } else if (/[।॥]/.test(v)) bad('danda outside Hindi');
          if (l === 'th' && /\p{Script=Thai}\.(?:\s|$)/u.test(v)) bad('Thai does not end a sentence with a full stop');
          // A word that mixes Latin with Cyrillic letters is a look-alike typo.
          for (const w of v.split(/[^\p{L}]+/u)) if (/\p{Script=Latin}/u.test(w) && /\p{Script=Cyrillic}/u.test(w)) bad(`"${w}" mixes Latin and Cyrillic letters`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('never reuses a key of the core locale, which would hide the area’s string', () => {
    for (const a of AREAS) for (const k of Object.keys(area(a, 'en'))) expect([a, k, CORE_EN_KEYS.has(k)]).toEqual([a, k, false]);
  });

  it('keeps one word for a thing: what an area repeats from the core locale is the core’s wording', async () => {
    for (const l of LOCALES) {
      const core = await loadMessages(l);
      const shared = area('shared', l);
      expect([l, shared['offline.link.home']]).toEqual([l, core['nav.home']]);
      expect([l, shared['offline.link.collection']]).toEqual([l, core['nav.collection']]);
      expect([l, shared['offline.link.battle']]).toEqual([l, core['nav.battle']]);
      // The manifest's shortcuts are named as the site names those places.
      expect([l, shared['app.shortcut.battle']]).toEqual([l, core['nav.battle']]);
      const gap = ['zh', 'ja', 'th'].includes(l) ? '' : ' '; // the Theatre's heading, as two pieces
      expect([l, shared['app.shortcut.theatre']]).toEqual([l, `${core['theatre.titleA']}${gap}${core['theatre.titleB']}`]);
      // The two sentences every page can show for a failed request are said one way.
      expect([l, shared['error.network']]).toEqual([l, core['auth.error.network']]);
      expect([l, shared['error.generic']]).toEqual([l, core['auth.error.generic']]);
    }
  });
});

describe('pages ask only for strings that exist', () => {
  for (const [file, areas] of Object.entries(PAGES)) {
    it(`${file}: every key in the markup and in the script is in the core locale or in [${areas}]`, () => {
      const source = readFileSync(file, 'utf8');
      const known = new Set<string>([...CORE_EN_KEYS, ...areas.flatMap((a) => Object.keys(area(a, 'en')))]);
      const asked = new Set<string>();
      for (const m of source.matchAll(/data-i18n(?:-placeholder|-title|-aria-label)?="([^"{}]+)"/g)) asked.add(m[1]);
      // t('key'…), tm({ key: 'key' …}), msg('key'…), { title: 'key', description: 'key' }
      for (const m of source.matchAll(/\b(?:t|msg)\(\s*'([a-zA-Z0-9_.-]+)'/g)) asked.add(m[1]);
      for (const m of source.matchAll(/\b(?:key|title|description):\s*'([a-z][a-zA-Z0-9_]*\.[a-zA-Z0-9_.-]+)'/g)) asked.add(m[1]);
      // t(cond ? 'a' : 'b')
      for (const m of source.matchAll(/'((?:classroom|market|tour|season|viewer|vr|error|activity|boundary|offline|app|nav|auth|footer)\.[a-zA-Z0-9_.-]+)'/g)) asked.add(m[1]);
      // plural('credits', n) asks for credits.<category>
      for (const m of source.matchAll(/\bplural\(\s*'([a-zA-Z0-9_.-]+)'/g)) {
        asked.delete(m[1]);
        asked.add(`${m[1]}.other`);
      }
      expect(asked.size).toBeGreaterThan(8);
      const unknown = [...asked].filter((k) => !known.has(k) && !k.endsWith('.')).sort();
      expect(unknown).toEqual([]);
      // Built keys (`activity.${type}`) are checked by their family having at least one member.
      for (const m of source.matchAll(/`((?:[a-z]+\.)+)\$\{/g)) {
        expect([file, m[1], [...known].some((k) => k.startsWith(m[1]))]).toEqual([file, m[1], true]);
      }
    });
  }

  it('every sentence src/lib/pwa.ts says is in the pwa area, and it says nothing else', () => {
    const source = readFileSync('src/lib/pwa.ts', 'utf8');
    const said = [...source.matchAll(/\bsay\(\s*'([a-zA-Z0-9_.]+)'/g)].map((m) => m[1]);
    const pwa = area('pwa', 'en');
    expect(new Set(said)).toEqual(new Set(Object.keys(pwa)));
    // No sentence is put on the page except through say().
    expect(source).not.toMatch(/el\([^)]*,\s*'[A-Z][a-z]+ /);
  });

  it('the messages the viewer libraries report are all in the viewer area', () => {
    const viewer = area('viewer', 'en');
    for (const file of ['src/lib/splat-viewer.ts', 'src/lib/vr-engine.ts']) {
      const keys = [...readFileSync(file, 'utf8').matchAll(/'((?:viewer|vr)\.[a-zA-Z0-9_.]+)'/g)].map((m) => m[1]);
      expect(keys.length).toBeGreaterThan(3);
      for (const k of keys) expect([file, k, k in viewer]).toEqual([file, k, true]);
      // No sentence is handed to the page: every report goes through msg().
      expect(readFileSync(file, 'utf8')).not.toMatch(/on(?:StatusChange|Error)\?\.\(\s*[`'"]/);
    }
  });
});

describe('loadArea', () => {
  it('makes an area’s strings available to t() in the language asked for, with English for what that language lacks', async () => {
    // A string the Japanese module lacks, taken out before anyone has loaded it.
    const ja = area('classroom', 'ja');
    const saved = ja['classroom.join.submit'];
    delete ja['classroom.join.submit'];
    try {
      expect(has('classroom.title')).toBe(false);
      expect(t('classroom.title')).toBe('classroom.title');
      await loadArea('classroom');
      expect(t('classroom.title')).toBe('Classroom Mode');
      expect(has('classroom.title')).toBe(true);

      await setLocale('es', { persist: false });
      await loadArea('classroom');
      expect(t('classroom.title')).toBe('Modo Clase');
      expect(t('classroom.wizard.step', { n: 2, total: 4 })).toBe('Paso 2 de 4');
      // The core locale still answers, and an area asked for later arrives in the current language.
      expect(t('round.label', { n: 1, total: 3 })).toBe('Ronda 1 de 3');
      await loadArea('shared');
      expect(t('error.tournament_full')).toBe('Este torneo está completo.');
      await loadArea('shared'); // asking twice is harmless
      expect(t('activity.challenge')).toBe('Desafío');

      // Shown in English, never as a key.
      await setLocale('ja', { persist: false });
      await loadArea('classroom');
      expect(t('classroom.join.submit')).toBe('Join');
      expect(t('classroom.create.submit')).toBe('作成');
    } finally {
      ja['classroom.join.submit'] = saved;
    }
    await setLocale('en', { persist: false });
    expect(t('classroom.title')).toBe('Classroom Mode');
  });

  it('a page redraws only once its areas are in the new language', async () => {
    await setLocale('en', { persist: false });
    await initPage(['season']);
    expect(t('season.claim')).toBe('Claim');
    const de = area('season', 'de')['season.claim'];
    const ru = area('season', 'ru')['season.claim'];
    expect(de).not.toBe('Claim');
    const seen: string[] = [];
    const stop = onPageLocaleChange((l) => seen.push(`${l}: ${t('season.claim')}`));
    try {
      await setLocale('de', { persist: false });
      await vi.waitFor(() => expect(seen).toEqual([`de: ${de}`]));
      // Two changes in a row: the page is drawn in the one that stays, in its own words.
      void setLocale('pl', { persist: false });
      await setLocale('ru', { persist: false });
      await vi.waitFor(() => expect(seen.at(-1)).toBe(`ru: ${ru}`));
      expect(seen.every((s) => !s.includes('season.claim'))).toBe(true);
    } finally {
      stop();
      await setLocale('en', { persist: false });
    }
  });

  it('an area that does not exist is reported, and t() then shows the key rather than a wrong text', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await loadArea('no-such-area');
      expect(errors.mock.calls.some((c) => String(c[0]).includes('no such area'))).toBe(true);
    } finally {
      errors.mockRestore();
    }
  });
});

describe('numbers, dates and counts come from Intl', () => {
  it('picks the plural form the language’s grammar asks for', async () => {
    const cases: Array<[Locale, number, string, string]> = [
      ['en', 1, 'credits', '1 credit'],
      ['en', 2, 'credits', '2 credits'],
      ['fr', 0, 'credits', '0 crédit'], // French counts zero as singular
      ['fr', 2, 'credits', '2 crédits'],
      ['pl', 1, 'credits', '1 kredyt'],
      ['pl', 3, 'credits', '3 kredyty'],
      ['pl', 5, 'credits', '5 kredytów'],
      ['pl', 22, 'credits', '22 kredyty'],
      ['ru', 1, 'classroom.members', '1 участник'],
      ['ru', 3, 'classroom.members', '3 участника'],
      ['ru', 11, 'classroom.members', '11 участников'],
      ['ru', 21, 'classroom.members', '21 участник'],
      ['ar', 0, 'classroom.members', 'لا أعضاء'],
      ['ar', 1, 'classroom.members', 'عضو واحد'],
      ['ar', 2, 'classroom.members', 'عضوان'],
      ['ar', 5, 'classroom.members', '5 أعضاء'],
      ['ar', 11, 'classroom.members', '11 عضوًا'],
      ['ar', 100, 'classroom.members', '100 عضو'],
      ['ja', 3, 'classroom.members', 'メンバー 3人'],
    ];
    for (const [l, n, key, want] of cases) {
      await setLocale(l, { persist: false });
      await loadArea('shared');
      await loadArea('classroom');
      expect([l, n, plural(key, n)]).toEqual([l, n, want]);
    }
    await setLocale('en', { persist: false });
  });

  it('groups digits, orders dates and joins lists as each language does', async () => {
    const when = '2026-11-16T12:00:00Z'; // the 16th in every time zone a build host is likely to be in
    await setLocale('de', { persist: false });
    expect(num(100000)).toBe('100.000');
    expect(list(['A', 'B', 'C'])).toBe('A, B und C');
    expect(date(when)).toMatch(/16\.11\.2026/);
    await setLocale('en', { persist: false });
    expect(num(100000)).toBe('100,000');
    expect(signed(50)).toBe('+50');
    expect(list(['A', 'B', 'C'])).toBe('A, B, and C');
    expect(date(when)).toMatch(/Nov 16, 2026/);
    await setLocale('ja', { persist: false });
    expect(date(when)).toMatch(/2026\/11\/16|2026年11月16日/);
    expect(list(['A', 'B'])).toBe('A、B');
    // Arabic keeps the digits the rest of the interface uses.
    await setLocale('ar', { persist: false });
    expect(intlLocale()).toBe('ar-u-nu-latn');
    // A gain keeps its sign beside its digits in a right-to-left line: CLDR's left-to-right mark.
    expect(signed(50)).toBe(`${String.fromCodePoint(0x200e)}+50`);
    expect(num(2026)).toMatch(/^2[,٬]?026$/);
    expect(date(when)).toMatch(/2026/);
    expect(dateTime(when)).toMatch(/\d/);
    // A date without a time is that calendar day wherever the reader is, not the evening before.
    expect(dateRange('2026-11-01', '2026-11-30')).toMatch(/1.*30/);
    await setLocale('en', { persist: false });
    expect(date('2026-11-01')).toBe('Nov 1, 2026');
    expect(dateRange('2026-11-01', '2026-11-30')).toMatch(/^Nov 1\s*[–-]\s*30, 2026$/);
    // An unreadable date is shown as nothing rather than "Invalid Date".
    expect(date('not a date')).toBe('');
    expect(dateRange('x', 'y')).toBe('');
    await setLocale('en', { persist: false });
    expect(pluralCategory(1, 'pl')).toBe('one');
    expect(pluralCategory(3, 'pl')).toBe('few');
  });
});

describe('the install guidance and the storage note (src/lib/pwa.ts)', () => {
  it('speak the interface language once the pwa area is in, with sizes as the language writes them', async () => {
    const { formatBytes, storageNote } = await import('../lib/pwa');
    await setLocale('en', { persist: false });
    expect(formatBytes(1.09e9)).toBe('1.1 GB');
    await setLocale('fr', { persist: false });
    await loadArea('pwa');
    const fr = area('pwa', 'fr');
    // French writes gigaoctets and a decimal comma (CLDR, through Intl).
    expect(formatBytes(1.09e9)).toMatch(/^1,1\sGo$/);
    expect(storageNote(true, 1.09e9).text).toBe(fr['pwa.storage.kept'].replace('{size}', formatBytes(1.09e9)));
    expect(storageNote(false, 295e6, true).text).toBe(`${fr['pwa.storage.atRisk'].replace('{size}', formatBytes(295e6))} ${fr['pwa.storage.installHint']}`);
    const oneMb = new Intl.NumberFormat('fr', { style: 'unit', unit: 'megabyte', unitDisplay: 'short' }).format(1);
    expect(oneMb).toMatch(/^1\sMo$/);
    expect(formatBytes(10)).toBe(fr['pwa.storage.lessThan'].replace('{size}', oneMb));
    await setLocale('ru', { persist: false });
    await loadArea('pwa');
    expect(formatBytes(3.1e9)).toMatch(/^3,1\sГБ$/);
    expect(storageNote(true, null).text).toBe(area('pwa', 'ru')['pwa.storage.keptNoSize']);
    await setLocale('en', { persist: false });
    expect(storageNote(true, null).text).toBe(area('pwa', 'en')['pwa.storage.keptNoSize']);
  });
});

describe('the generated static files', () => {
  const shared = Object.fromEntries(LOCALES.map((l) => [l, area('shared', l)]));

  it('public/offline.html is what the shared area says, in all sixteen languages', () => {
    const onDisk = readFileSync('public/offline.html', 'utf8');
    expect(onDisk === renderOffline(shared), 'public/offline.html is out of date: run node scripts/pages-rest/build-static.mjs').toBe(true);
    for (const l of LOCALES) for (const key of Object.values(OFFLINE_KEYS) as string[]) {
      // Inside the page's script the strings are JSON; they hold no character JSON would escape.
      expect([l, key, onDisk.includes(JSON.stringify(shared[l][key]))]).toEqual([l, key, true]);
    }
    expect(onDisk).toContain("'inspired-mile-locale'");
    // No piece of the page is left without its English.
    expect(onDisk).not.toMatch(/data-k="[a-z]+">\s*</);
  });

  it('public/manifest.json carries the name, the description and the shortcuts in every language', () => {
    const onDisk = readFileSync('public/manifest.json', 'utf8');
    expect(onDisk === localiseManifest(onDisk, shared), 'public/manifest.json is out of date: run node scripts/pages-rest/build-static.mjs').toBe(true);
    const manifest = JSON.parse(onDisk);
    expect(manifest.lang).toBe('en');
    for (const l of LOCALES) {
      if (l === 'en') continue;
      expect([l, manifest.name_localized[l]]).toEqual([l, shared[l]['app.name']]);
      expect([l, manifest.description_localized[l]]).toEqual([l, shared[l]['app.description']]);
    }
    expect(Object.keys(manifest.name_localized).sort()).toEqual(LOCALES.filter((l) => l !== 'en').sort());
    // The product name is not translated.
    for (const l of LOCALES) expect([l, shared[l]['app.name'].startsWith('Sonnet Man')]).toEqual([l, true]);
    // Each shortcut has its name in every language, from the key its url names.
    expect(manifest.shortcuts.length).toBeGreaterThan(0);
    for (const shortcut of manifest.shortcuts) {
      const key = SHORTCUT_KEYS[shortcut.url as keyof typeof SHORTCUT_KEYS];
      expect([shortcut.url, shortcut.name]).toEqual([shortcut.url, shared.en[key]]);
      for (const l of LOCALES.filter((x) => x !== 'en')) expect([shortcut.url, l, shortcut.name_localized[l]]).toEqual([shortcut.url, l, shared[l][key]]);
    }
  });

  it('refuses to write translations of English the manifest no longer has', () => {
    const onDisk = JSON.parse(readFileSync('public/manifest.json', 'utf8'));
    const renamed = JSON.stringify({ ...onDisk, name: 'Sonnet Man: a new name' });
    expect(() => localiseManifest(renamed, shared)).toThrow(/translate the new English/);
    const newShortcut = JSON.stringify({ ...onDisk, shortcuts: [...onDisk.shortcuts, { name: 'Story', url: '/story' }] });
    expect(() => localiseManifest(newShortcut, shared)).toThrow(/\/story has no key/);
  });
});
