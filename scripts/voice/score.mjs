/**
 * How a transcript is scored against a text (scripts/voice/measure.mjs, report.mjs): the words,
 * which spellings are one word, the word-level alignment, and the error rate with its interval.
 * No models here.
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

/** A seeded generator for the bootstrap, so the interval is the same every run. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Word error rate of one side ('old' or 'new') over result rows. */
export function wer(rows, side) {
  const edits = rows.reduce((s, r) => s + r[side].edits, 0);
  const n = rows.reduce((s, r) => s + r.words, 0);
  return { edits, words: n, wer: n ? edits / n : 0 };
}
/** 95% interval of new minus old WER, by a paired bootstrap over texts (seeded: the same every run). */
export function bootstrap(rows, reps = 10000) {
  const rand = rng(20261119);
  const diffs = [];
  for (let b = 0; b < reps; b++) {
    let eo = 0;
    let en = 0;
    let n = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[Math.floor(rand() * rows.length)];
      eo += r.old.edits;
      en += r.new.edits;
      n += r.words;
    }
    diffs.push(n ? (en - eo) / n : 0);
  }
  diffs.sort((a, b) => a - b);
  return { low: diffs[Math.floor(reps * 0.025)], high: diffs[Math.floor(reps * 0.975)] };
}
