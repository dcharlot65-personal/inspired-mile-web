// What the evaluation computes from what the browser recorded. Pure functions, no model,
// no network: src/lib/model-eval.test.ts runs them against known-bad input.

export const LANGS = ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ar', 'hi', 'zh', 'ja', 'ko', 'vi', 'th', 'id'];
export const TIERS = ['grand', 'standard', 'lite'];
export const CRITERIA = ['wordplay', 'allusion', 'flow', 'wit'];

/** Wilson score interval for k successes in n trials (95% by default). */
export function wilson(k, n, z = 1.959964) {
  if (!n) return { rate: null, low: null, high: null };
  const p = k / n;
  const d = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / d;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return { rate: p, low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
}

// --- Script and language ---

const SCRIPTS = ['Latin', 'Cyrillic', 'Arabic', 'Devanagari', 'Thai', 'Hangul', 'Han', 'Hiragana', 'Katakana'];
const SCRIPT_RE = Object.fromEntries(SCRIPTS.map((s) => [s, new RegExp(`\\p{Script=${s}}`, 'u')]));

/** Share of a text's letters in each script (Unicode Script property). */
export function scriptShares(text) {
  const counts = Object.fromEntries(SCRIPTS.map((s) => [s, 0]));
  let letters = 0;
  for (const ch of text) {
    if (!/\p{L}/u.test(ch)) continue;
    letters++;
    for (const s of SCRIPTS) if (SCRIPT_RE[s].test(ch)) { counts[s]++; break; }
  }
  const shares = Object.fromEntries(SCRIPTS.map((s) => [s, letters ? counts[s] / letters : 0]));
  return { letters, shares };
}

/**
 * Is the text written in the script the language is written in? Chinese is Han with no
 * kana; Japanese is Han and kana with some kana; Korean is Hangul (a little Han allowed).
 */
export function scriptOk(text, lang) {
  const { letters, shares: s } = scriptShares(text);
  if (!letters) return false;
  switch (lang) {
    case 'ru': return s.Cyrillic >= 0.8;
    case 'ar': return s.Arabic >= 0.8;
    case 'hi': return s.Devanagari >= 0.8;
    case 'th': return s.Thai >= 0.8;
    case 'ko': return s.Hangul >= 0.6 && s.Hangul + s.Han >= 0.8;
    case 'zh': return s.Han >= 0.8 && s.Hiragana + s.Katakana + s.Hangul <= 0.02;
    case 'ja': return s.Han + s.Hiragana + s.Katakana >= 0.8 && s.Hiragana + s.Katakana >= 0.1;
    default: return s.Latin >= 0.8;
  }
}

/**
 * Where the script check settles the language: Hangul and Thai script are written for no other
 * language a model would plausibly answer in, and Chinese and Japanese are told apart by kana.
 * Cyrillic, Arabic and Devanagari are each Russian's, Arabic's and Hindi's alone among the sixteen,
 * but are shared with Ukrainian, Persian, Urdu, Marathi, Nepali: there the identifier must agree.
 */
export const SCRIPT_DECIDES = ['zh', 'ja', 'ko', 'th'];
/** What the identifier may answer for a language. Indonesian and Malay are one language standardised twice; a short verse cannot tell them apart. */
export const LID_ACCEPTS = { id: ['id', 'ms'] };

/**
 * Is a verse in the language asked for? The script must be right; and where other
 * languages share the script, the language identifier's first answer must be this
 * language. `lid` is that answer (an ISO 639-1 code), or null where it was not run.
 */
export function inLanguage(text, lang, lid) {
  if (!scriptOk(text, lang)) return false;
  if (SCRIPT_DECIDES.includes(lang)) return true;
  return (LID_ACCEPTS[lang] ?? [lang]).includes(lid);
}

// --- Commentary ---

const META = /^\s*["'“«(\[]?\s*(here(?:'s| is| are)?|sure|certainly|of course|okay|ok|note|notes|translation|explanation|verse|title|line\s*\d+|couplet|haiku|quatrain|tercet|acrostic|anaphora|answer|response)\b[^\n]{0,60}[:：!]/i;

/**
 * Why a line reads as commentary rather than verse, or null. `first` is whether it is the
 * verse's first line: a label ("Here is the couplet:", in any language) comes first and
 * ends in a colon. Lines of real verse end in colons too, so the colon counts only there:
 * measured on the 443 reference verses, that flags 2 (0.5%); on any line it flagged 10.
 */
export function commentaryLine(line, lang, first = false) {
  const l = line.trim();
  if (!l) return null;
  if (first && /[:：]\s*$/.test(l)) return 'a first line that ends in a colon';
  if (META.test(l)) return 'opens like a note';
  if (/^\s*(#{1,6}\s|\*\*|[-*]\s)/.test(l)) return 'markup';
  const latinLang = !['ru', 'ar', 'hi', 'th', 'ko', 'zh', 'ja'].includes(lang);
  if (!latinLang) {
    const { letters, shares } = scriptShares(l);
    const latinWords = (l.match(/\p{Script=Latin}{2,}/gu) ?? []).length;
    if (letters >= 6 && shares.Latin >= 0.7 && latinWords >= 3) return 'a line in Latin script';
  }
  return null;
}

// The rules above were committed before any cell ran (8e92604). The first English cells showed
// them missing a small model talking to itself mid-verse ("— wait need rhyme pattern. / Let me
// design:"), echoing its instructions ("Write exactly 3 lines.") and labelling an acrostic's
// letters ("W - Vivid rays…"); the French cells added a reasoning block ("<think>…"), an
// announcement ("I shall craft a heroic couplet in French") and the form's name as a title.
// The rules below were added for those, and kept only because they flag none of the 443
// reference verses (and the prompt rules none of them against any prompt the game sent):
// src/lib/model-eval.test.ts holds both. A rule that ended a verse on a colon was tried and
// dropped: it flagged 4 reference verses, Wikisource excerpts cut mid-sentence.

/**
 * Talk about the task, in English (the language of the prompt). Narrow on purpose: "Let me not
 * to the marriage of true minds" and "Let me count the ways" are verse, so "let me" alone is not
 * enough, nor is "wait" without the dash or colon of an interruption.
 */
const TASK_TALK = /\b(let me (craft|write|try|design|start|fix|redo|rewrite|think|check|compose|adjust|revise|count (the )?syllables)|let'?s (try|craft|write|count|fix|redo)|i need to|need to (rhyme|craft|write|start|end|count|include|make)|needs? (a )?rhyme|must (start|end|begin|rhyme|include|repeat|contain|use)|each line|every line|the (first|last|second|third|fourth) line|lines? \d|syllables?\b|rhyme (scheme|pattern)|the (prompt|instructions?|flourish)|write exactly|exactly \d+ lines|that'?s not right|try again|\((\d+|that'?s[^)]*)\))/i;
const INTERRUPTION = /(^|[—–(-]\s*|\.\s+)wait\b\s*[—–,:.!-]/i;
// Announcing the verse instead of writing it ("I shall craft a heroic couplet in French").
const ANNOUNCE = /\b(i('ll| will| shall| must| need to)|let me|now to) (craft|write|compose)\b|\b(craft|write|compose) (a|an|the|my|this) (heroic )?(couplet|quatrain|tercet|haiku|acrostic|anaphora|epistrophe|crescendo|verse|poem)\b/i;
// A reasoning block some models open with.
const REASONING = /<\/?think>/i;

// Marks (\p{M}) stay: Devanagari vowel signs, Thai vowels and tones, Arabic harakat are part of the
// word. Without them "क़सम, यह रात निर्वासन" fell apart into consonants that matched the relic's word
// list in the prompt, which the model is asked to use (four false echoes in Hindi, found by reading
// grand.hi.write.json; fixed before any decision turned on it).
const norm = (s) => s.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const fourGrams = (s) => {
  const w = norm(s).split(' ').filter(Boolean);
  const out = new Set();
  for (let i = 0; i + 4 <= w.length; i++) out.add(w.slice(i, i + 4).join(' '));
  return out;
};

/**
 * The instruction lines of the prompt a play was written to: the user message, without the
 * challenger's verse it quotes (a reply may borrow from that verse; that is not commentary).
 */
export function instructionLines(prompt, answering) {
  if (!Array.isArray(prompt) || !prompt.length) return [];
  const quoted = new Set((answering ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean));
  return String(prompt[prompt.length - 1]).split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !quoted.has(l));
}

/**
 * A verse line that repeats an instruction: four words in a row from it, or all of a line of
 * three or more words, or the form's name on its own (a title: "Crossed Quatrain").
 */
export function echoesInstruction(line, instructions) {
  const l = norm(line);
  const form = instructions.map((i) => i.match(/^Form: ([^.]+)\./)?.[1]).find(Boolean);
  if (form && l === norm(form)) return true;
  if (l.split(' ').filter(Boolean).length < 3) return false;
  const mine = fourGrams(line);
  return instructions.some((ins) => norm(ins).includes(l) || [...fourGrams(ins)].some((g) => mine.has(g)));
}

/**
 * Does a verse contain commentary? Returns the reasons, one per offending line.
 * `instructions` (instructionLines of the play's prompt) turns on the echo rule.
 * `narrow: true` applies only the rules committed before any cell ran, for comparison.
 */
export function commentary(verse, lang, { instructions = [], narrow = false } = {}) {
  const lines = verse.split(/\r?\n/).filter((l) => l.trim());
  const out = [];
  lines.forEach((l, i) => {
    const old = commentaryLine(l, lang, i === 0 && lines.length > 1);
    if (old) out.push(old);
    else if (narrow) return;
    else if (REASONING.test(l)) out.push('a reasoning block');
    else if (TASK_TALK.test(l) || INTERRUPTION.test(l) || ANNOUNCE.test(l)) out.push('talk about the task');
    else if (echoesInstruction(l, instructions)) out.push('repeats the instructions');
  });
  // Acrostic letters set out as labels ("W - Vivid rays", "L: Llevo", "清：心如止水"): two or more
  // lines. The full-width colon was missing until the Chinese cells were read (nine of Gemma's
  // acrostics there used it; the rules above already treat it as a colon). Adding it flips one
  // decision, which MODEL-EVAL.md states; no reference verse is flagged with or without it.
  if (!narrow && lines.filter((l) => /^\s*\p{L}\s*[-–—:)：]/u.test(l) && !/^\s*\p{L}\p{L}/u.test(l)).length >= 2) out.push('letters set out as labels');
  return out;
}

// --- Summaries ---

/** One judging cell: how often the judge preferred the better verse. */
export function summarizeJudge(cell) {
  const rows = cell.pairs.map((p) => {
    const better = p.betterIsPlayer ? 'player' : 'opponent';
    const verdicts = CRITERIA.map((c) => (p.criteria[c] === better ? 'better' : p.criteria[c] === 'split' ? 'split' : 'worse'));
    const pointsBetter = p.betterIsPlayer ? p.player : p.opponent;
    const pointsWorse = p.betterIsPlayer ? p.opponent : p.player;
    return { id: p.id, kind: p.kind, verdicts, won: pointsBetter > pointsWorse, lost: pointsWorse > pointsBetter, byModel: p.source === 'model' };
  });
  const n = rows.length;
  const crit = rows.flatMap((r) => r.verdicts);
  const pairWins = rows.filter((r) => r.won).length;
  const byCriterion = Object.fromEntries(CRITERIA.map((c, i) => [c, { better: rows.filter((r) => r.verdicts[i] === 'better').length, n }]));
  const byKind = {};
  for (const r of rows) {
    const k = (byKind[r.kind] ??= { pairs: 0, pairWins: 0, pairLosses: 0, criteria: 0, better: 0 });
    k.pairs++; k.pairWins += r.won ? 1 : 0; k.pairLosses += r.lost ? 1 : 0; k.criteria += r.verdicts.length; k.better += r.verdicts.filter((v) => v === 'better').length;
  }
  return {
    pairs: n,
    allByModel: rows.every((r) => r.byModel),
    pairWins, pairWilson: wilson(pairWins, n),
    criteria: crit.length,
    better: crit.filter((v) => v === 'better').length,
    split: crit.filter((v) => v === 'split').length,
    worse: crit.filter((v) => v === 'worse').length,
    criterionWilson: wilson(crit.filter((v) => v === 'better').length, crit.length),
    byCriterion, byKind,
    injectionPairsLost: byKind.injection?.pairLosses ?? 0,
  };
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/**
 * One writing cell. `lidOf(text)` is the language identifier's answer for a text.
 * A play is one call of the opponent (one verse on the table); a draft is one
 * generation inside it.
 */
export function summarizeWrite(cell, lidOf) {
  const lang = cell.lang;
  const plays = cell.plays.map((p) => {
    const model = p.source === 'model';
    const inLang = model && inLanguage(p.verse, lang, lidOf(p.verse));
    const comment = model ? commentary(p.verse, lang, { instructions: instructionLines(p.prompt, p.answering) }) : [];
    const commentNarrow = model ? commentary(p.verse, lang, { narrow: true }) : [];
    return { ...p, model, inLang, comment, commentNarrow };
  });
  const group = (rows) => {
    const n = rows.length;
    const m = rows.filter((r) => r.model);
    return {
      plays: n,
      modelSourced: m.length,
      formKept: m.filter((r) => r.formKept).length,
      formKeptWilson: wilson(m.filter((r) => r.formKept).length, n),
      meanCraft: mean(m.map((r) => r.craft)),
      meanFormPoints: mean(m.map((r) => r.formEarned)),
      inLanguage: m.filter((r) => r.inLang).length,
      inLanguageWilson: wilson(m.filter((r) => r.inLang).length, n),
      commentary: m.filter((r) => r.comment.length).length,
      commentaryNarrow: m.filter((r) => r.commentNarrow.length).length,
      // An upper bound for the game's rhyme check, which is by spelling and misses some real
      // rhymes ("hear / cheer"): the plays that kept everything but rhyme.
      formKeptIfRhymeWaived: m.filter((r) => r.formKept || (r.checks ?? []).every((c) => c.met || /^rhyme-/.test(c.id))).length,
    };
  };
  const drafts = cell.plays.flatMap((p) => p.drafts);
  const tokens = drafts.reduce((s, d) => s + d.tokens, 0);
  const seconds = drafts.reduce((s, d) => s + d.ms, 0) / 1000;
  const byForm = {};
  for (const p of plays) (byForm[p.formId] ??= []).push(p);
  const byDifficulty = {};
  for (const p of plays) (byDifficulty[p.difficulty] ??= []).push(p);
  return {
    ...group(plays),
    drafts: drafts.length,
    draftsFormKept: drafts.filter((d) => d.formKept).length,
    draftsRanOn: drafts.filter((d) => d.rawLines > d.expectedLines).length,
    draftsEmpty: drafts.filter((d) => !d.tidy).length,
    tokensPerSecond: seconds ? tokens / seconds : null,
    minPlaysPerForm: Math.min(...Object.values(byForm).map((r) => r.length)),
    byForm: Object.fromEntries(Object.entries(byForm).map(([f, r]) => [f, group(r)])),
    byDifficulty: Object.fromEntries(Object.entries(byDifficulty).map(([d, r]) => [d, group(r)])),
  };
}

// --- Decisions ---

/** May this model judge this language? `s` is summarizeJudge's result, or null when the cell was not measured. */
export function decideJudge(s, t) {
  if (!s) return { ok: false, why: ['not measured'] };
  const why = [];
  if (s.pairs < t.minPairs) why.push(`${s.pairs} pairs, ${t.minPairs} needed`);
  if (!s.allByModel) why.push('a reading fell back to the rules');
  if (!(s.pairWilson.low > t.pairWinsWilsonLowerAbove)) why.push(`better verse won ${s.pairWins}/${s.pairs} pairs: the 95% interval reaches down to ${s.pairWilson.low.toFixed(2)}, not above chance`);
  if (!(s.criterionWilson.rate >= t.criterionRateAtLeast)) why.push(`preferred the better verse on ${s.better}/${s.criteria} criteria (${(s.criterionWilson.rate * 100).toFixed(0)}%), under ${t.criterionRateAtLeast * 100}%`);
  if (s.injectionPairsLost > t.injectionPairsLostAtMost) why.push(`${s.injectionPairsLost} injection attempt(s) beat a real verse`);
  return { ok: why.length === 0, why };
}

/** May this model write in this language? `recall` is the language detector's pass rate on real verse in the language. */
export function decideWrite(s, t, recall) {
  if (!s) return { ok: false, why: ['not measured'] };
  const why = [];
  const n = s.plays;
  if (s.minPlaysPerForm < t.minPlaysPerForm) why.push(`a form has ${s.minPlaysPerForm} plays, ${t.minPlaysPerForm} needed`);
  if (!(s.modelSourced / n >= t.modelSourcedAtLeast)) why.push(`wrote a usable verse in ${s.modelSourced}/${n} plays`);
  const need = t.inLanguageAtLeastTimesDetectorRecall * Math.min(1, recall ?? 1);
  if (!(s.inLanguage / n >= need)) why.push(`in the language in ${s.inLanguage}/${n} plays (${((s.inLanguage / n) * 100).toFixed(0)}%), under ${(need * 100).toFixed(0)}%`);
  if (!(s.commentary / n <= t.commentaryAtMost)) why.push(`commentary in ${s.commentary}/${n} plays`);
  if (!(s.formKept / n >= t.formKeptAtLeast)) why.push(`kept the form in full in ${s.formKept}/${n} plays (${((s.formKept / n) * 100).toFixed(0)}%), under ${t.formKeptAtLeast * 100}%`);
  return { ok: why.length === 0, why };
}

// --- What the rules added after the first cells decide ---

export const LABEL = { grand: 'Gemma 4 E2B', standard: 'LFM3 1.7B', lite: 'LFM2.5 350M' };

/**
 * The refusals to write that rest on the commentary rules added after the first cells were read
 * (commentaryLine's wider rules, the label and echo rules): every other writing rule is met, and
 * under the narrow rules, committed before any cell ran, commentary would be within the bar too.
 * `table` and `thresholds` as derive() uses them.
 */
export function narrowFlips(table, thresholds) {
  const out = [];
  for (const tier of TIERS) for (const lang of LANGS) {
    const c = table[tier][lang];
    if (!c.write || c.writes.ok) continue;
    const others = c.writes.why.filter((x) => !x.startsWith('commentary'));
    if (!others.length && c.write.commentaryNarrow / c.write.plays <= thresholds.write.commentaryAtMost) out.push({ tier, lang });
  }
  return out;
}

const byTier = (flips) => TIERS.filter((t) => flips.some((f) => f.tier === t)).map((t) => `${LABEL[t]} in ${flips.filter((f) => f.tier === t).map((f) => f.lang).join(', ')}`).join('; ');

/** The line under the results table. MODEL-EVAL.md must carry exactly this (src/lib/model-eval.test.ts). */
export function narrowLine(flips) {
  return `Under the commentary rules committed before any cell ran (the narrow count in brackets above), ${flips.length ? `these would also write: ${byTier(flips)}` : 'no decision would be different'}.`;
}

/** The same fact, for "What is not established"; generated, so that it cannot go stale beside the table. */
export function narrowNote(flips) {
  return flips.length
    ? `- **${flips.length === 1 ? 'One refusal rests' : `${flips.length} refusals rest`} on commentary rules added after cells were read.** The rules were widened after the first cells (above). Under the rules committed before any cell ran, these would also write: ${byTier(flips)}. Those refusals stand on the wider rules, not on rules fixed before every cell was measured; "What else the plays showed" says, per language, when each rule was committed beside that language's cells and what it caught.`
    : '- **The commentary rules were widened after the first cells were read** (above). Under the rules committed before any cell ran, no decision would be different.';
}

// --- From result files to decisions ---

/**
 * Everything decided, from the result files alone.
 *   cells        the parsed cell files (docs/language/model-eval/cells)
 *   lid          { [text]: code } the language identifier's answers, recorded by analyze.mjs
 *   thresholds   scripts/model-eval/thresholds.json
 *   reference    { [lang]: string[] } real verse per language, to measure the detector on
 * A cell that is missing is "not measured", and decides as unsupported.
 */
export function derive(cells, lid, thresholds, reference) {
  const lidOf = (text) => lid[text] ?? null;
  const detector = {};
  for (const lang of LANGS) {
    const texts = reference[lang] ?? [];
    const pass = texts.filter((t) => inLanguage(t, lang, lidOf(t))).length;
    detector[lang] = { texts: texts.length, pass, recall: texts.length ? pass / texts.length : null };
  }
  const find = (tier, lang, task) => cells.find((c) => c.tier === tier && c.lang === lang && c.task === task) ?? null;
  const table = {};
  const models = {};
  for (const tier of TIERS) {
    table[tier] = {};
    models[tier] = { writesIn: [], judgesIn: [] };
    for (const lang of LANGS) {
      const jc = find(tier, lang, 'judge');
      const wc = find(tier, lang, 'write');
      const judge = jc ? summarizeJudge(jc) : null;
      const write = wc ? summarizeWrite(wc, lidOf) : null;
      const dj = decideJudge(judge, thresholds.judge);
      const dw = decideWrite(write, thresholds.write, detector[lang].recall);
      table[tier][lang] = { judge, write, judges: dj, writes: dw };
      if (dj.ok) models[tier].judgesIn.push(lang);
      if (dw.ok) models[tier].writesIn.push(lang);
    }
  }
  return { detector, table, models };
}
