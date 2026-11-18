/**
 * Text on the theatre's canvas panels, in every script.
 *
 * Babylon's TextBlock wraps a line at its word divider, a space, and draws each line with fillText on a
 * canvas whose base direction is left to right (Babylon never sets context.direction). Seen in
 * screenshots on 2026-11-16: a Japanese line, which has no spaces, never wrapped and ran off its panel;
 * an Arabic sentence's final full stop stood at its right end, and the text sat at the left.
 *
 * wrapUnits() gives the TextBlock the pieces it may break between (its wordSplittingFunction, with
 * wordDivider ''): the pieces of ./line-break (words as Intl.Segmenter finds them, with the line-break
 * rules of Japanese, Chinese and Thai). A line that reads right to left has each piece put inside a
 * RIGHT-TO-LEFT EMBEDDING (RLE … PDF). The Unicode Bidirectional Algorithm drops those two characters
 * before it resolves anything (rule X9) and joins runs at the same level (BD13), so whatever pieces a
 * drawn line ends up with, its whole content sits at an odd level and is laid out right to left, as if
 * the canvas's direction were 'rtl': the full stop at the sentence's end, a Latin card or model name
 * kept whole and in its place.
 *
 * Until 2026-11-17 each piece was bracketed with RLM instead. That set the punctuation of a pure
 * Arabic line right, but not the base direction: a line with a Latin name in it ('Hamlet يكسب الجولة.',
 * 'حكم Gemma 4 E2B على هذا الجهاز.') was laid out left to right, its runs in the wrong order, the model
 * name cut in two by the marks ('4E2B'), and a line that began with a Latin letter was not marked at all.
 */
import { breakPoints } from './line-break';

/** RIGHT-TO-LEFT EMBEDDING and POP DIRECTIONAL FORMATTING, written by code so that no file tool turns them into invisible characters. */
const RLE = String.fromCharCode(0x202b);
const PDF = String.fromCharCode(0x202c);
const RTL_LETTER = /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}]/u;

/** Is the page's interface right to left (html dir="rtl")? False outside a browser. */
export function interfaceRtl(): boolean {
  return typeof document !== 'undefined' && document.documentElement?.dir === 'rtl';
}

/**
 * Does a text read right to left? It must hold a right-to-left letter (an English verse in an Arabic
 * interface stays left to right), and then either the interface is right to left (an Arabic sentence
 * that opens with a card's Latin name is still an Arabic sentence) or most of its letters are right to
 * left (an Arabic verse in an English interface; the opponent panel's Latin card name above it).
 * The first strong letter, which is what the bidirectional algorithm and dir="auto" go by, gets
 * 'Hamlet يكسب الجولة.' wrong.
 */
export function readsRtl(text: string, uiRtl: boolean = interfaceRtl()): boolean {
  let rtl = 0;
  let ltr = 0;
  for (const m of text.matchAll(/\p{L}/gu)) {
    if (RTL_LETTER.test(m[0])) rtl++;
    else ltr++;
  }
  return rtl > 0 && (uiRtl || rtl > ltr);
}

/**
 * The pieces a panel may break `line` between (./line-break), each inside a right-to-left embedding when
 * the line reads right to left. Joining the pieces and dropping RLE and PDF gives the line back.
 */
export function wrapUnits(line: string, uiRtl: boolean = interfaceRtl()): string[] {
  const pieces = breakPoints(line);
  return readsRtl(line, uiRtl) ? pieces.map((p) => RLE + p + PDF) : pieces;
}
