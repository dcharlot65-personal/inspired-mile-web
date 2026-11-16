/**
 * Language packs: the game data that has to be written in each language.
 *
 * A pack holds the words an acrostic can spell, the letters a curse can forbid,
 * each relic's power words, and the verses the written opponent plays when no
 * model can run. English is always present; the others are separate modules
 * loaded on demand, so a player downloads one language, not sixteen.
 *
 * The duel engine is synchronous, so a pack must be loaded (loadPack) before a
 * duel is created in its language. getPack() throws for a known language that
 * has not been loaded rather than quietly playing English verses.
 */
import { baseLang } from '../lang';
import en from './en';

export interface LanguagePack {
  lang: string;
  /**
   * Words an acrostic can be asked to spell. A phrase with spaces is spelled
   * word by word (Thai); anything else letter by letter (see acrosticUnits).
   */
  acrostic: string[];
  /** Letters a Forbidden Letter curse can name: common enough to bite, never impossible. */
  forbidden: string[];
  /** Each relic's power words, from its own story. Keyed by card id. */
  relics: Record<string, string[]>;
  /** Verses that keep each form, keyed by form id. Every form offered in the language has at least two. */
  written: Record<string, string[]>;
  /**
   * Verses held back for a cursed opponent, keyed by form id: short lines, short
   * words, nothing said twice, so each holds Short Breath, Tongue-Tied and No
   * Echoes. Optional: a language without them answers a curse from `written` alone.
   */
  spare?: Record<string, string[]>;
  /** Lines for acrostics, keyed by the unit each opens on. Every unit of every acrostic word has at least two. */
  acrosticLines: Record<string, string[]>;
}

export const PACK_LANGS = ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ar', 'hi', 'zh', 'ja', 'ko', 'vi', 'th', 'id'] as const;
export type PackLang = (typeof PACK_LANGS)[number];

const LOADERS: Record<Exclude<PackLang, 'en'>, () => Promise<{ default: LanguagePack }>> = {
  es: () => import('./es'),
  fr: () => import('./fr'),
  de: () => import('./de'),
  it: () => import('./it'),
  pt: () => import('./pt'),
  pl: () => import('./pl'),
  ru: () => import('./ru'),
  ar: () => import('./ar'),
  hi: () => import('./hi'),
  zh: () => import('./zh'),
  ja: () => import('./ja'),
  ko: () => import('./ko'),
  vi: () => import('./vi'),
  th: () => import('./th'),
  id: () => import('./id'),
};

const loaded = new Map<string, LanguagePack>([['en', en]]);

export function hasPack(lang: string): boolean {
  return (PACK_LANGS as readonly string[]).includes(baseLang(lang));
}

/** Load a language's pack. A language with no pack resolves to English. */
export async function loadPack(lang: string): Promise<LanguagePack> {
  const b = baseLang(lang);
  const have = loaded.get(b);
  if (have) return have;
  const loader = (LOADERS as Record<string, (() => Promise<{ default: LanguagePack }>) | undefined>)[b];
  if (!loader) return en;
  const pack = (await loader()).default;
  loaded.set(b, pack);
  return pack;
}

export async function loadAllPacks(): Promise<LanguagePack[]> {
  return Promise.all(PACK_LANGS.map((l) => loadPack(l)));
}

/** The pack for a language. English for a language that has none; an error for one that has not been loaded yet. */
export function getPack(lang: string): LanguagePack {
  const b = baseLang(lang);
  const have = loaded.get(b);
  if (have) return have;
  if (hasPack(b)) throw new Error(`Language pack "${b}" is not loaded; await loadPack("${b}") first`);
  return en;
}
