/**
 * Numbers, dates, lists and plurals in the interface language.
 *
 * Nothing here is translated by hand: the browser's Intl (ICU, which carries
 * Unicode CLDR) knows each language's digit grouping, date order, list
 * punctuation and which plural form a number takes. The only thing a locale
 * file supplies is one sentence per plural form its language has
 * ('x.one', 'x.few', … 'x.other'), and src/i18n/pages-rest.test.ts checks that
 * each language has exactly the forms CLDR says it uses.
 */
import { has, locale, t } from './index';
import type { Msg } from '../lib/verse/msg';

/**
 * The tag given to Intl. Arabic keeps Western digits: the interface writes its
 * other numbers that way ("الجولة 1 من 3"), and one page should not mix two
 * sets of digits.
 */
export function intlLocale(l: string = locale()): string {
  return l === 'ar' ? 'ar-u-nu-latn' : l;
}

export function num(n: number): string {
  return new Intl.NumberFormat(intlLocale()).format(n);
}

function asDate(d: string | number | Date): Date | null {
  // "2026-11-01" is a calendar day. new Date() would read it as midnight UTC, which is the
  // evening of 31 October for a reader in America.
  const day = typeof d === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(d) : null;
  const date = day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** A calendar date ("16 Nov 2026", "2026年11月16日"). An unreadable date gives ''. */
export function date(d: string | number | Date): string {
  const v = asDate(d);
  return v ? new Intl.DateTimeFormat(intlLocale(), { dateStyle: 'medium' }).format(v) : '';
}

/** A date with the time of day. */
export function dateTime(d: string | number | Date): string {
  const v = asDate(d);
  return v ? new Intl.DateTimeFormat(intlLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(v) : '';
}

/** From one date to another, written as the language writes a range. */
export function dateRange(from: string | number | Date, to: string | number | Date): string {
  const a = asDate(from);
  const b = asDate(to);
  if (!a || !b) return '';
  return new Intl.DateTimeFormat(intlLocale(), { dateStyle: 'medium' }).formatRange(a, b);
}

/** "A, B and C" as the language writes it. */
export function list(items: readonly string[]): string {
  return new Intl.ListFormat(intlLocale(), { style: 'long', type: 'conjunction' }).format(items);
}

/** The CLDR plural category of a number in a language: zero, one, two, few, many or other. */
export function pluralCategory(n: number, l: string = locale()): Intl.LDMLPluralRule {
  return new Intl.PluralRules(l).select(n);
}

/**
 * A counted message: picks `<key>.<category>` for `n` and fills {n} with the
 * number as the language writes it. Falls back to `<key>.other`.
 */
export function plural(key: string, n: number, vars?: Msg['vars']): string {
  const exact = `${key}.${pluralCategory(n)}`;
  return t(has(exact) ? exact : `${key}.other`, { ...vars, n: num(n) });
}

/** The suffixes a counted message can have. */
export const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'] as const;
