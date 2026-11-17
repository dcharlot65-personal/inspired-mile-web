// English inside right-to-left text: Shakespeare's lines and the names no source gives in Arabic script.
//
// The Unicode bidirectional algorithm gives the punctuation at the end of an English line ("…, sir?",
// "…your houses!") the direction of the Arabic around it, so it is drawn at the wrong end of the line:
// «?Do you bite your thumb at me, sir». An isolate (U+2068 FIRST STRONG ISOLATE … U+2069 POP DIRECTIONAL
// ISOLATE, Unicode Standard Annex #9, since Unicode 6.3) lays the English out on its own, left to right,
// and the Arabic sentence treats it as one neutral piece. Quotation marks stay outside: they are the
// Arabic sentence's own.
//
// Used by build.mjs for the generated files and by play-areas.test.ts over every string of a
// right-to-left language; the hand-written area files carry the isolates as \u2068 and \u2069 escapes.
export const RTL = new Set(['ar']);
export const FSI = '\u2068';
export const PDI = '\u2069';

/** A run of Latin text: from a Latin letter up to the Arabic, the quotation mark or the isolate that ends it. */
const RUN = /[A-Za-z\u00C0-\u024F][^\u0590-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF«»"“”\u2066-\u2069]*/gu;

/** A {placeholder}: its name is not text, and what fills it is not known here. */
const PLACEHOLDER = /(\{[a-zA-Z_]+\})/;

/**
 * An English line in straight quotation marks ("Do you bite your thumb at me, sir?"): the marks are English
 * ones and go inside the isolate with the line, so where the line wraps they stay at its own two ends. Arabic
 * guillemets («…») are the Arabic sentence's marks and stay outside.
 */
const QUOTED = /"[A-Za-z\u00C0-\u024F][^"\u0590-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u2066-\u2069]*"/gu;
const ISOLATED = /(\u2068[^\u2069]*\u2069)/u;

/** The text with each run of Latin letters isolated, the spaces after it left outside; placeholders untouched. */
export function isolateLatin(s) {
  const runs = (text) => text.replace(RUN, (run) => {
    const t = run.replace(/\s+$/u, '');
    return FSI + t + PDI + run.slice(t.length);
  });
  return s.split(PLACEHOLDER).map((part, i) => (i % 2 ? part
    : part.replace(QUOTED, (q) => FSI + q + PDI).split(ISOLATED).map((p, j) => (j % 2 ? p : runs(p))).join(''))).join('');
}

export const stripIsolates = (s) => s.replace(/[\u2066-\u2069]/gu, '');

/** What is wrong with the direction marks of a string of a right-to-left language: [] when nothing. */
export function bidiProblems(key, s) {
  const out = [];
  const opened = (s.match(/[\u2066-\u2068]/gu) ?? []).length, closed = (s.match(/\u2069/gu) ?? []).length;
  if (opened !== closed) out.push(`${key}: ${opened} isolates opened, ${closed} closed`);
  if (isolateLatin(stripIsolates(s)) !== s) out.push(`${key}: Latin text not isolated: ${stripIsolates(s).match(RUN)?.join(' | ')}`);
  if (/[\u200E\u200F\u202A-\u202E]/u.test(s)) out.push(`${key}: a direction mark or embedding other than an isolate`);
  // "{n} / {total}": with spaces round the slash the two numbers are laid out right to left, and 1 / 5 reads 5 / 1
  // (found on lang/pages-core's pages on 2026-11-16). Written {n}/{total}, the slash joins them into one number.
  if (/(?:\{\w+\}|\d)\s+\/\s*(?:\{\w+\}|\d)|(?:\{\w+\}|\d)\s*\/\s+(?:\{\w+\}|\d)/u.test(s)) out.push(`${key}: a count and its total with a space by the slash, which right to left reads reversed`);
  return out;
}
