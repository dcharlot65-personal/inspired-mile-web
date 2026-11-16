/**
 * What a translated page needs beyond t(): its own message areas, and numbers,
 * dates, lists and place names that come from the browser's Intl (Unicode CLDR)
 * rather than from strings of ours.
 *
 *   initPage(['collection', 'card-terms'], render)
 *
 * loads the areas for the current language (src/i18n/pages/<area>/<locale>.ts),
 * fills the static markup, calls `render` for whatever a script draws, and does
 * all of it again whenever the language changes. When it is done it writes the
 * language to <html data-i18n-ready>, which is what the browser tests wait for.
 *
 * Static markup for a page's own keys. It is not the core data-i18n attribute on
 * purpose: the core fills data-i18n the moment a language is chosen, which is
 * before that language's areas have arrived, and would show the bare key.
 *   data-i18n-html="key"   a message, which may carry marks: <b>…</b> becomes the
 *                          accent span (class from data-b-class, default
 *                          "text-gradient"), <a>…</a> a link (data-a-href,
 *                          data-a-class, data-a-external).
 *                          data-i18n-vars='{"n":3}' fills {n}; numbers go through num().
 *                          data-var-ids='{"n":"count"}' wraps {n} in <span id="count">.
 *   data-i18n-attr="placeholder:key aria-label:key"   attributes
 *   data-num="75"          a number, written the way the language writes it
 *   data-qo / data-qc      the opening and closing quotation marks of the language (quoted())
 *
 * This file sits beside the area folders, not in one: the loader only reads
 * ./pages/<area>/<locale>.ts.
 */
import { applyTranslations, initI18n, isRtl, loadArea, locale, onLocaleChange, t } from '../index';

type Vars = Record<string, string | number>;

/** A number as the interface language writes it (digits, grouping). */
export function num(n: number): string {
  return new Intl.NumberFormat(locale()).format(n);
}

/** A share between 0 and 1 as a percentage. */
export function percent(ratio: number): string {
  return new Intl.NumberFormat(locale(), { style: 'percent', maximumFractionDigits: 0 }).format(ratio);
}

/** A day, from a timestamp. */
export function day(ts: number | Date): string {
  return new Intl.DateTimeFormat(locale(), { dateStyle: 'medium' }).format(ts);
}

/** A month of a year ("Mar 2025"). `month` counts from 1. */
export function monthOfYear(year: number, month: number): string {
  return new Intl.DateTimeFormat(locale(), { year: 'numeric', month: 'short' }).format(new Date(year, month - 1, 15));
}

/** A year on its own, in the language's digits and without a grouping mark. */
export function yearOnly(year: number): string {
  return new Intl.NumberFormat(locale(), { useGrouping: false }).format(year);
}

/**
 * "a, b and c" as the language joins a list of words. Not Intl's "unit" lists: those are for
 * measurements ("5 ft 2 in"), and Chinese and Japanese write them with nothing between the items,
 * so a relic's power words showed as one run of characters (髑髏冗談墓笑い塵).
 */
export function list(items: string[]): string {
  return new Intl.ListFormat(locale(), { style: 'long', type: 'conjunction' }).format(items);
}

/**
 * Quotation marks, by language: Unicode CLDR 49.0.0, cldr-misc-full/main/<lang>/delimiters.json
 * (quotationStart, quotationEnd), Unicode License v3, read 2026-11-16 (the values lang/qa-pipeline
 * records in docs/language/sources/cldr.json). Arabic opens with ” and closes with “, as CLDR has
 * it. French adds the no-break space French typography sets inside « » (CLDR gives the marks only).
 */
const QUOTES: Record<string, readonly [string, string]> = {
  en: ['“', '”'], es: ['“', '”'], fr: ['«\u00a0', '\u00a0»'], de: ['„', '“'], it: ['«', '»'], pt: ['“', '”'],
  pl: ['„', '”'], ru: ['«', '»'], ar: ['”', '“'], hi: ['“', '”'], zh: ['“', '”'], ja: ['「', '」'],
  ko: ['“', '”'], vi: ['“', '”'], th: ['“', '”'], id: ['“', '”'],
};

/**
 * Text that may be in another script than the page's, as HTML. On a right-to-left page, text with
 * no right-to-left letter in it (an English line from the card data, a name) goes in <bdi>, so the
 * bidirectional algorithm keeps its punctuation at its own end ("question." not ".question").
 */
export function isolated(text: string, l: string = locale()): string {
  return isRtl(l) && !/[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(text) ? `<bdi>${escapeHtml(text)}</bdi>` : escapeHtml(text);
}

/** The opening and closing quotation marks of a language. */
export function quoteMarks(l: string = locale()): readonly [string, string] {
  return QUOTES[l] ?? QUOTES.en;
}

/**
 * A quotation in the language's marks, as HTML. The quoted text sits in <bdi>: an English line
 * on an Arabic page keeps its own direction, so its closing "?" or "!" stays at its end.
 */
export function quoted(text: string, l: string = locale()): string {
  const [open, close] = quoteMarks(l);
  return `<span data-qo>${open}</span><bdi>${escapeHtml(text)}</bdi><span data-qc>${close}</span>`;
}

/**
 * A signed number ("+50") reads the same on a right-to-left page as on any other. Left alone, the
 * bidirectional algorithm attaches a lone "+" to the right-to-left text around it, and the Arabic
 * about page showed 50+ (screenshots, 2026-11-16). On a right-to-left page each signed number is put
 * in a left-to-right isolate, U+2066 ... U+2069, added here at run time and never kept in a message.
 */
export function signedLtr(s: string, l: string = locale()): string {
  return isRtl(l) ? s.replace(/(^|[^\p{L}\p{N}])([+\u2212]\p{Nd}[\p{Nd}.,\u066B\u066C]*)/gu, '$1\u2066$2\u2069') : s;
}

/** t(), with every number among the variables written through num(). */
export function tn(key: string, vars: Vars = {}): string {
  const shown: Vars = {};
  for (const [k, v] of Object.entries(vars)) shown[k] = typeof v === 'number' ? num(v) : v;
  return signedLtr(t(key, shown));
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export interface RichOptions {
  /** Class of the span that <b>…</b> becomes. Default: the accent gradient. */
  bClass?: string;
  /** Where <a>…</a> leads. Without it the mark is dropped and its text kept. */
  aHref?: string;
  aClass?: string;
  aExternal?: boolean;
  /** Wrap a variable's value in <span id="…">, for a script (or a test) that reads the number back. */
  varIds?: Record<string, string>;
}

/**
 * A message with marks, as HTML. Everything is escaped first, so a translation
 * can only ever produce the two marks named here.
 */
export function rich(key: string, vars: Vars = {}, opts: RichOptions = {}): string {
  const a = opts.aHref
    ? `<a href="${escapeHtml(opts.aHref)}"${opts.aClass ? ` class="${escapeHtml(opts.aClass)}"` : ''}${opts.aExternal ? ' target="_blank" rel="noopener noreferrer"' : ''}>`
    : '<span>';
  // A variable that is to be wrapped goes in as a token and is swapped for its span after escaping.
  const ids = opts.varIds ?? {};
  const token = (name: string) => `@@var:${name}@@`;
  const shown: Vars = {};
  for (const [k, v] of Object.entries(vars)) shown[k] = k in ids ? token(k) : typeof v === 'number' ? num(v) : v;
  let html = escapeHtml(signedLtr(t(key, shown)))
    .replaceAll('&lt;b&gt;', `<span class="${escapeHtml(opts.bClass ?? 'text-gradient')}">`)
    .replaceAll('&lt;/b&gt;', '</span>')
    .replaceAll('&lt;a&gt;', a)
    .replaceAll('&lt;/a&gt;', opts.aHref ? '</a>' : '</span>');
  for (const [k, id] of Object.entries(ids)) {
    const v = vars[k];
    html = html.replaceAll(token(k), `<span id="${escapeHtml(id)}">${escapeHtml(typeof v === 'number' ? num(v) : String(v ?? ''))}</span>`);
  }
  return html;
}

function parse<T>(json: string | undefined, fallback: T): T {
  try {
    return json ? (JSON.parse(json) as T) : fallback;
  } catch {
    return fallback; // a malformed attribute leaves the placeholders visible, which the tests catch
  }
}

function fill(el: HTMLElement): void {
  el.innerHTML = rich(el.dataset.i18nHtml!, parse<Vars>(el.dataset.i18nVars, {}), {
    bClass: el.dataset.bClass,
    aHref: el.dataset.aHref,
    aClass: el.dataset.aClass,
    aExternal: el.dataset.aExternal !== undefined,
    varIds: parse<Record<string, string>>(el.dataset.varIds, {}),
  });
}

/** Give a data-i18n-html element new values for its variables, and redraw it. */
export function setVars(el: HTMLElement | null, vars: Vars): void {
  if (!el) return;
  el.dataset.i18nVars = JSON.stringify(vars);
  fill(el);
}

/** Fill the data-i18n-html, data-i18n-attr and data-num markup under `root`. */
export function applyRich(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach(fill);
  root.querySelectorAll<HTMLElement>('[data-i18n-attr]').forEach((el) => {
    for (const pair of el.dataset.i18nAttr!.split(/\s+/).filter(Boolean)) {
      const at = pair.indexOf(':');
      if (at > 0) el.setAttribute(pair.slice(0, at), t(pair.slice(at + 1)));
    }
  });
  root.querySelectorAll<HTMLElement>('[data-num]').forEach((el) => {
    const n = Number(el.dataset.num);
    if (Number.isFinite(n)) el.textContent = num(n);
  });
  const [open, close] = quoteMarks();
  root.querySelectorAll<HTMLElement>('[data-qo]').forEach((el) => (el.textContent = open));
  root.querySelectorAll<HTMLElement>('[data-qc]').forEach((el) => (el.textContent = close));
}

/**
 * Translate this page: load its areas, fill the markup, draw, and keep doing so
 * as the language changes. Resolves after the first drawing.
 */
export async function initPage(areas: string[], render?: () => void | Promise<void>): Promise<void> {
  const apply = async () => {
    const l = locale();
    await Promise.all(areas.map((a) => loadArea(a, l)));
    if (locale() !== l) return; // the language changed while this one was loading; its own pass will draw
    applyTranslations();
    applyRich();
    await render?.();
    if (locale() === l) document.documentElement.dataset.i18nReady = l;
  };
  await initI18n();
  await apply();
  onLocaleChange(() => void apply());
}
