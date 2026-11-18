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

/** A closing quotation mark: punctuation right before one ends the quoted English line, and is the line's own. */
const CLOSING_QUOTE = /^["»“”’]/u;
/** Punctuation that ends a sentence or a clause. */
const STOP = /[.,;:!?…]+$/u;

/**
 * How much of a run of Latin text is the English's own, and so goes inside the isolate. The run, as RUN finds it,
 * goes on to the next Arabic letter, so it can end with what belongs to the Arabic sentence around it:
 *  - a closing bracket whose opening bracket stands before the run ("رجال الملك (King's Men)"). Inside the isolate
 *    it was cut off from its partner, and Chromium drew the two side by side: "King's Men))" (checker, 2026-11-16).
 *    The pair stays together outside, and the bidirectional algorithm's bracket rule (UAX #9 N0) draws it round
 *    the isolate;
 *  - the Arabic sentence's full stop or comma after a name ("أمام الأمير Escalus."): inside the isolate it was
 *    drawn between the Arabic and the name. It stays outside, unless a closing quotation mark follows it: then it
 *    ends the quoted English line («Et tu, Brute?») and is the line's own.
 */
function own(run, next) {
  let t = run.replace(/\s+$/u, '');
  // Closing brackets with no opening one in the run are the sentence's.
  let depth = 0, cut = t.length;
  for (let i = 0; i < t.length; i++) {
    if ('([{'.includes(t[i])) depth++;
    else if (')]}'.includes(t[i])) { if (depth === 0) { cut = i; break; } depth--; }
  }
  t = t.slice(0, cut).replace(/\s+$/u, '');
  if (cut === run.replace(/\s+$/u, '').length && CLOSING_QUOTE.test(next)) return t;
  return t.replace(STOP, '');
}

/** The text with each run of Latin letters isolated, the spaces and the sentence's punctuation after it left outside; placeholders untouched. */
export function isolateLatin(s) {
  const runs = (text) => text.replace(RUN, (run, at, whole) => {
    const t = own(run, whole.slice(at + run.length));
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
