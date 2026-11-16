/**
 * What a page script needs to be in the interface language:
 *
 *   await initPage(['classroom', 'shared'], { title: 'classroom.meta.title', description: 'classroom.meta.description' });
 *   draw();                    // everything built with t()
 *   onLocaleChange(draw);      // and again when the language changes
 *
 * initPage waits for the language and for the page's areas (src/i18n/pages),
 * fills the data-i18n markup, and keeps the tab title and the description in
 * step with the language. The markup keeps its English text, so the page reads
 * correctly before any script has run and for a reader with scripts off.
 */
import { has, initI18n, loadArea, onLocaleChange, t } from './index';
import { num } from './fmt';
import { apiErrorMessage } from '../lib/api-errors';

const SITE = 'Inspired Mile';

export interface PageMeta {
  /** Key of the page's title; the site name is added, as BaseLayout does. */
  title: string;
  /** Key of the page's one-sentence description. */
  description?: string;
}

function applyMeta(meta: PageMeta): void {
  document.title = `${t(meta.title)} | ${SITE}`;
  if (meta.description) {
    document.querySelector('meta[name="description"]')?.setAttribute('content', t(meta.description));
  }
}

export async function initPage(areas: readonly string[], meta?: PageMeta): Promise<void> {
  await initI18n();
  await Promise.all(areas.map((name) => loadArea(name)));
  if (meta && typeof document !== 'undefined') {
    applyMeta(meta);
    onLocaleChange(() => applyMeta(meta));
  }
}

/** Text that came from a person or the server, made safe to put inside innerHTML. */
export function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/**
 * What to tell the player about a failed request, in the interface language.
 * Never the server's own text. Needs the `shared` area (src/lib/api-errors.ts).
 */
export function errorText(e: unknown): string {
  return apiErrorMessage(e, t, has, num);
}

// Written as code points on purpose: the characters themselves are invisible in a source file.
const FIRST_STRONG_ISOLATE = String.fromCodePoint(0x2068);
const POP_DIRECTIONAL_ISOLATE = String.fromCodePoint(0x2069);

/**
 * A name typed by a person, wrapped so that its own direction cannot reorder the sentence
 * around it: a Latin user name inside an Arabic sentence, or the reverse (Unicode UAX #9,
 * "isolates"). For text placed with t(); in markup, use dir="auto" on the element instead.
 */
export function isolate(value: string): string {
  return FIRST_STRONG_ISOLATE + value + POP_DIRECTIONAL_ISOLATE;
}
