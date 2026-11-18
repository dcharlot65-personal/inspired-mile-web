/**
 * Text on the theatre's canvas panels, in every script.
 *
 * Babylon's TextBlock wraps a line at its word divider, a space, and draws it with the canvas's
 * left-to-right base direction. So, seen in screenshots on 2026-11-16: a Japanese line, which has no
 * spaces, never wrapped and ran off its panel; an Arabic sentence's final full stop stood at its right
 * end, and the text sat at the left. wrapUnits() gives the TextBlock the pieces it may break between
 * (its wordSplittingFunction, with wordDivider ''), and a right-to-left line its direction marks.
 */

import { breakPoints } from './line-break';

/** RIGHT-TO-LEFT MARK, written by code so that no file tool turns it into an invisible character. */
const RLM = String.fromCharCode(0x200f);
const RTL_LETTER = /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}]/u;

/** Does the text read right to left (its first letter is Arabic, Hebrew, …)? */
export function startsRtl(text: string): boolean {
  const first = text.match(/\p{L}/u);
  return !!first && RTL_LETTER.test(first[0]);
}

/**
 * Does a block of text read right to left as a whole: are most of its letters Arabic, Hebrew, …? The
 * theatre's opponent panel begins with the card's Latin name (Apollo) above an Arabic verse; by its
 * first letter it was set left-aligned.
 */
export function readsRtl(text: string): boolean {
  let rtl = 0;
  let ltr = 0;
  for (const m of text.matchAll(/\p{L}/gu)) {
    if (RTL_LETTER.test(m[0])) rtl++;
    else ltr++;
  }
  return rtl > ltr;
}

/**
 * A line cut where it may wrap (./line-break: words as Intl.Segmenter finds them, with the line-break
 * rules of Japanese, Chinese and Thai). In a right-to-left line every piece is bracketed with RLM,
 * zero-width: the punctuation at either end of a drawn line then takes the line's direction.
 */
export function wrapUnits(line: string): string[] {
  const units = breakPoints(line);
  return startsRtl(line) ? units.map((u) => RLM + u + RLM) : units;
}
