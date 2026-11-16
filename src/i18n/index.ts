/**
 * The interface language: a small runtime, no library.
 *
 *   t('round.label', { n: 1, total: 3 })   a message, with {name} filled in
 *   setLocale('ja')                        load a language and switch to it
 *   onLocaleChange(render)                 redraw what was built with t()
 *
 * The locale is the one stored under 'inspired-mile-locale', else the browser's
 * first language that we have, else English. Each language is its own module
 * (./locales/<code>.ts), fetched only when chosen; English is always present
 * and fills in for any key a language lacks.
 *
 * Static markup carries keys, not sentences: data-i18n="key" for an element's
 * text, data-i18n-placeholder / -title / -aria-label for attributes. They are
 * filled when the locale is set. <html> gets lang, and dir="rtl" for Arabic.
 *
 * This is the interface language only. The language a duel is fought in is a
 * separate choice (the verse packs in src/lib/verse/packs).
 */
import { interpolate, type Msg } from '../lib/verse/msg';
import en from './locales/en';

export type Messages = Record<string, string>;

export const LOCALES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ar', 'hi', 'zh', 'ja', 'ko', 'vi', 'th', 'id'] as const;
export type Locale = (typeof LOCALES)[number];

/** Each language's own name for itself, for the switcher. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
  pt: 'Português',
  pl: 'Polski',
  ru: 'Русский',
  ar: 'العربية',
  hi: 'हिन्दी',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
  vi: 'Tiếng Việt',
  th: 'ไทย',
  id: 'Bahasa Indonesia',
};

const RTL: ReadonlySet<string> = new Set(['ar']);

export const LOCALE_STORAGE_KEY = 'inspired-mile-locale';

const LOADERS: Record<Exclude<Locale, 'en'>, () => Promise<{ default: Messages }>> = {
  es: () => import('./locales/es'),
  fr: () => import('./locales/fr'),
  de: () => import('./locales/de'),
  it: () => import('./locales/it'),
  pt: () => import('./locales/pt'),
  pl: () => import('./locales/pl'),
  ru: () => import('./locales/ru'),
  ar: () => import('./locales/ar'),
  hi: () => import('./locales/hi'),
  zh: () => import('./locales/zh'),
  ja: () => import('./locales/ja'),
  ko: () => import('./locales/ko'),
  vi: () => import('./locales/vi'),
  th: () => import('./locales/th'),
  id: () => import('./locales/id'),
};

let current: Locale = 'en';
let messages: Messages = en;
const cache = new Map<Locale, Messages>([['en', en]]);
const listeners = new Set<(locale: Locale) => void>();

export function isLocale(code: string | null | undefined): code is Locale {
  return !!code && (LOCALES as readonly string[]).includes(code);
}

export function isRtl(locale: string): boolean {
  return RTL.has(locale.toLowerCase().split('-')[0]);
}

/** The locale to use, given what is stored and what the browser asks for. */
export function pickLocale(stored: string | null | undefined, browser: readonly string[] = []): Locale {
  if (isLocale(stored)) return stored;
  for (const tag of browser) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLocale(base)) return base;
  }
  return 'en';
}

export function detectLocale(): Locale {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    /* storage unavailable: fall through to the browser's language */
  }
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  return pickLocale(stored, nav?.languages?.length ? nav.languages : nav?.language ? [nav.language] : []);
}

export function locale(): Locale {
  return current;
}

/** Is there a message for this key, in the current language or in English? */
export function has(key: string): boolean {
  return key in messages || key in en;
}

/** A message in the current language; English if the language lacks it; the key itself if nobody has it. */
export function t(key: string, vars?: Msg['vars']): string {
  return interpolate(messages[key] ?? en[key] ?? key, vars);
}

/** An engine message (a form's name, a check's label) in the current language. */
export function tm(m: Msg): string {
  return t(m.key, m.vars);
}

export async function loadMessages(l: Locale): Promise<Messages> {
  const have = cache.get(l);
  if (have) return have;
  const loaded = (await LOADERS[l as Exclude<Locale, 'en'>]()).default;
  cache.set(l, loaded);
  return loaded;
}

/** Fill every element under `root` that carries a data-i18n key. */
export function applyTranslations(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n!);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-placeholder]').forEach((el) => {
    el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder!));
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
    el.setAttribute('title', t(el.dataset.i18nTitle!));
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-aria-label]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel!));
  });
}

/**
 * Switch the interface to a language: load it, mark <html>, fill the static
 * markup and tell everyone who draws text. `persist: false` is for start-up,
 * where the choice came from storage or the browser and need not be written.
 */
export async function setLocale(l: Locale, opts: { persist?: boolean } = {}): Promise<Locale> {
  let next = l;
  let loaded: Messages;
  try {
    loaded = await loadMessages(l);
  } catch (err) {
    // A language file that will not load (offline, a stale cache) must not leave the page without text.
    console.error(`[i18n] could not load "${l}"; staying in English`, err);
    next = 'en';
    loaded = en;
  }
  current = next;
  messages = loaded;
  if (opts.persist !== false && next === l) {
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      /* not stored; the choice lasts for this page */
    }
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next;
    document.documentElement.dir = isRtl(next) ? 'rtl' : 'ltr';
    applyTranslations();
  }
  for (const fn of [...listeners]) fn(next);
  return next;
}

let started: Promise<Locale> | null = null;

/** Start the interface in the detected language. Safe to call from every script on a page: it runs once. */
export function initI18n(): Promise<Locale> {
  started ??= setLocale(detectLocale(), { persist: false });
  return started;
}

/** Be told when the language changes (and once the first language has loaded). Returns a function that stops it. */
export function onLocaleChange(fn: (locale: Locale) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** A language's name in the interface language ("Japanese", "japonés"), or its own name where the browser cannot say. */
export function languageName(code: string): string {
  try {
    const name = new Intl.DisplayNames([current], { type: 'language' }).of(code);
    if (name && name !== code) return name.charAt(0).toLocaleUpperCase(current) + name.slice(1);
  } catch {
    /* fall through */
  }
  return isLocale(code) ? LOCALE_NAMES[code] : code;
}

/** Fill a <select> with the interface languages, each under its own name, and switch when one is chosen. */
export function bindLocaleSwitch(select: HTMLSelectElement): void {
  select.replaceChildren();
  for (const code of LOCALES) {
    const o = document.createElement('option');
    o.value = code;
    o.textContent = LOCALE_NAMES[code];
    o.lang = code;
    select.appendChild(o);
  }
  select.value = current;
  select.addEventListener('change', () => {
    if (isLocale(select.value)) void setLocale(select.value);
  });
  onLocaleChange((l) => {
    select.value = l;
  });
}
