import { beforeAll, describe, expect, it } from 'vitest';
import { LOCALES, LOCALE_NAMES, has, isRtl, loadMessages, locale, pickLocale, setLocale, t, tm, type Locale } from './index';
import en from './locales/en';
import { ENGINE_EN, HOUSE_QUOTES } from '../lib/verse/english';
import { PACK_LANGS } from '../lib/verse/packs';
import { argumentNames } from '../lib/verse/msg';

// The names a template takes, plural counts included; a template that does not parse has none it can be trusted on.
const placeholders = (s: string): string[] => {
  try {
    return argumentNames(s);
  } catch {
    return ['<malformed>'];
  }
};

// Every locale module is loaded once, before the tests that read them: on a loaded build host the
// first import of fifteen modules took over vitest's 5 s default inside one test (seen at 5,006 and
// 5,066 ms). Loading is not what these tests measure; a minute is room for any host rb accepts.
const LOAD_ALL_MS = 60_000;
beforeAll(async () => {
  await Promise.all(LOCALES.map((l) => loadMessages(l)));
}, LOAD_ALL_MS);

describe('locales', () => {
  it('covers the sixteen languages the duel can be fought in', () => {
    expect([...LOCALES].sort()).toEqual([...PACK_LANGS].sort());
    for (const l of LOCALES) expect([l, LOCALE_NAMES[l].length > 0]).toEqual([l, true]);
  });

  it('English holds every engine message and a healthy number of interface ones', () => {
    for (const key of Object.keys(ENGINE_EN)) expect([key, en[key]]).toEqual([key, ENGINE_EN[key]]);
    expect(Object.keys(en).length).toBeGreaterThan(400);
  });

  it('every locale has exactly the keys of English, no empty value, and the same placeholders', async () => {
    const keys = Object.keys(en).sort();
    const problems: string[] = [];
    for (const l of LOCALES) {
      const m = await loadMessages(l);
      const mine = Object.keys(m).sort();
      for (const k of keys) if (!(k in m)) problems.push(`${l}: missing ${k}`);
      for (const k of mine) if (!(k in en)) problems.push(`${l}: extra ${k}`);
      for (const k of mine) {
        const v = m[k];
        if (typeof v !== 'string' || v.trim().length === 0) problems.push(`${l}: empty ${k}`);
        else if (k in en && placeholders(v).join(',') !== placeholders(en[k]).join(',')) {
          problems.push(`${l}: ${k} has {${placeholders(v)}} but English has {${placeholders(en[k])}}`);
        }
        // A brace that is not part of a placeholder or a plural is a typo that would be shown to the player.
        if (typeof v === 'string' && placeholders(v)[0] === '<malformed>') problems.push(`${l}: stray brace in ${k}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('every locale is actually translated: almost nothing reads the same as English', async () => {
    // What may stay the same: the quotations, product and model names, a few international words.
    for (const l of LOCALES) {
      if (l === 'en') continue;
      const m = await loadMessages(l);
      // The exact list of what may read the same, each with its reason, is docs/language/allow/untranslated.json,
      // and quality.test.ts holds every locale to it; this is the coarse guard that a whole file was not left in English.
      const same = Object.keys(en).filter((k) => !(k in HOUSE_QUOTES) && m[k] === en[k]);
      expect([l, same.length < 25, same.slice(0, 30)]).toEqual([l, true, same.slice(0, 30)]);
      // The quotations are English in every language, on purpose.
      for (const k of Object.keys(HOUSE_QUOTES)) expect([l, k, m[k]]).toEqual([l, k, HOUSE_QUOTES[k]]);
    }
  });

  it('keeps one word for a thing within a language', async () => {
    // The name of a curse or a device is said the same way wherever it appears.
    for (const l of LOCALES) {
      const m = await loadMessages(l);
      expect([l, m['verdict.powerWords']]).toEqual([l, m['chip.powerWords']]);
      expect([l, m['footer.aboutUs'].length > 0 && m['nav.about'].length > 0]).toEqual([l, true]);
      expect([l, m['auth.emailSend']]).toEqual([l, m['auth.emailButton']]);
    }
  });
});

describe('runtime', () => {
  it('chooses the stored locale, else the first browser language it has, else English', () => {
    expect(pickLocale('ja', ['fr-FR'])).toBe('ja');
    expect(pickLocale(null, ['fr-FR', 'en'])).toBe('fr');
    expect(pickLocale(undefined, ['sv-SE', 'pt-BR'])).toBe('pt');
    expect(pickLocale('xx', ['zh-Hant-TW'])).toBe('zh');
    expect(pickLocale(null, ['sv-SE'])).toBe('en');
    expect(pickLocale(null, [])).toBe('en');
  });

  it('marks Arabic, and only Arabic, as right to left', () => {
    expect(LOCALES.filter((l) => isRtl(l))).toEqual(['ar']);
    expect(isRtl('ar-EG')).toBe(true);
  });

  it('translates, interpolates, and falls back to English and then to the key', async () => {
    expect(locale()).toBe('en');
    expect(t('round.label', { n: 2, total: 3 })).toBe('Round 2 of 3');
    await setLocale('es', { persist: false });
    expect(locale()).toBe('es');
    expect(t('round.label', { n: 2, total: 3 })).toBe('Ronda 2 de 3');
    expect(tm({ key: 'check.lines', vars: { n: 4 } })).toBe('Exactamente 4 versos');
    // A variable that was not supplied stays visible rather than vanishing.
    expect(t('round.label', { n: 2 })).toBe('Ronda 2 de {total}');
    expect(t('no.such.key')).toBe('no.such.key');
    expect(has('no.such.key')).toBe(false);
    expect(has('round.label')).toBe(true);
    await setLocale('en', { persist: false });
    expect(t('round.label', { n: 1, total: 3 })).toBe('Round 1 of 3');
  });

  it('falls back to English for a key a language lacks', async () => {
    const ja = await loadMessages('ja' as Locale);
    const saved = ja['end.victory'];
    delete ja['end.victory'];
    try {
      await setLocale('ja', { persist: false });
      expect(t('end.victory')).toBe('Victory');
      expect(t('end.defeat')).toBe('敗北');
    } finally {
      ja['end.victory'] = saved;
      await setLocale('en', { persist: false });
    }
  });
});
