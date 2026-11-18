/**
 * Where a line of the theatre's panels may break (theatre.ts gives this to Babylon as
 * TextBlock.wordSplittingFunction, joined with no divider): the line comes back as pieces that
 * are never split, and a panel breaks only between two of them.
 *
 * A piece is a word as Intl.Segmenter finds it, so lines written without spaces (Japanese,
 * Chinese, Thai) break between their words, with the spaces after a word kept with it. Then the
 * line-break rules of the scripts the game is played in (JIS X 4051 and W3C's "Requirements for
 * Japanese Text Layout", kinsoku; the same rules for Chinese; Thai's repetition and
 * abbreviation marks) are applied by joining pieces, never by moving characters:
 *   - a character that may not open a line (closing brackets and quotes, the comma and full stop,
 *     ！ ？ ： ；, the middle dot, the prolonged-sound mark ー, small kana, iteration marks, %, ℃,
 *     Thai ๆ and ฯ) is joined to the piece before it;
 *   - a character that may not close a line (an opening bracket or quote) is joined to the piece
 *     after it.
 * Joining the pieces back together always gives the line unchanged.
 *
 * Without a segmenter (an old browser): after each run of spaces, and between the characters of
 * a run of CJK or Thai script, with the same rules.
 */

/** May not open a line. */
const NO_START = /^[\p{Pe}\p{Pf}、。，．,.・･：；:;！？!?‼⁇⁈⁉%％‰℃°′″ーｰ々〻ゝゞヽヾぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶㇰ-ㇿ゠‐–〜～…‥ๆฯ]/u;
/** May not close a line. */
const NO_END = /[\p{Ps}\p{Pi}]\s*$/u;

type WordSegmenter = { segment(s: string): Iterable<{ segment: string }> };

let shared: WordSegmenter | null | undefined;

function defaultSegmenter(): WordSegmenter | null {
  if (shared === undefined) {
    const Segmenter = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => WordSegmenter }).Segmenter;
    shared = Segmenter ? new Segmenter(undefined, { granularity: 'word' }) : null;
  }
  return shared;
}

/** The pieces of `line` a panel may break between (see above). */
export function breakPoints(line: string, segmenter: WordSegmenter | null = defaultSegmenter()): string[] {
  const pieces = segmenter
    ? [...segmenter.segment(line)].map((x) => x.segment)
    : line.split(/(\s+|[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}])/u).filter(Boolean);
  const out: string[] = [];
  for (const piece of pieces) {
    const last = out.length - 1;
    if (last >= 0 && (/^\s+$/.test(piece) || NO_START.test(piece) || NO_END.test(out[last]))) out[last] += piece;
    else out.push(piece);
  }
  return out;
}

/** The break rule a pair of lines would break, or null: for tests of what a panel drew. */
export function lineBreakFault(before: string, after: string): string | null {
  if (NO_START.test(after.trimStart())) return `"${after.trimStart()[0]}" opens a line`;
  if (NO_END.test(before)) return `"${before.trimEnd().at(-1)}" closes a line`;
  return null;
}
