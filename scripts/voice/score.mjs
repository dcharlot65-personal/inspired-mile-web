/**
 * How a transcript is scored against a text (scripts/voice/measure.mjs, report.mjs): the words,
 * which spellings are one word, and the word-level alignment. No models here.
 */
/** Words of a text for scoring: lower case, apostrophes and punctuation gone, hyphens split. */
export function scoreWords(text) {
  return text
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[‘’ʼ`']/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}
/** Spellings that are the same word (Whisper writes American spelling). */
export function same(a, b) {
  if (a === b) return true;
  const fold = (w) => w.replace(/our$/, 'or').replace(/ise$/, 'ize').replace(/ised$/, 'ized').replace(/tre$/, 'ter').replace(/ll(ed|ing)$/, 'l$1');
  return fold(a) === fold(b);
}
/** Levenshtein over words, with the alignment: [{ op: '='|'S'|'D'|'I', ref, hyp }]. */
export function align(ref, hyp) {
  const n = ref.length;
  const m = hyp.length;
  const d = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (same(ref[i - 1], hyp[j - 1]) ? 0 : 1));
  const ops = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (same(ref[i - 1], hyp[j - 1]) ? 0 : 1)) {
      ops.push({ op: same(ref[i - 1], hyp[j - 1]) ? '=' : 'S', ref: ref[i - 1], hyp: hyp[j - 1] });
      i--;
      j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      ops.push({ op: 'D', ref: ref[i - 1] });
      i--;
    } else {
      ops.push({ op: 'I', hyp: hyp[j - 1] });
      j--;
    }
  }
  return { edits: d[n][m], ops: ops.reverse() };
}
