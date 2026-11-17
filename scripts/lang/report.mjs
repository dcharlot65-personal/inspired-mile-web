#!/usr/bin/env node
/**
 * Write docs/language/QA-REPORT.md from what the checks actually produced.
 *
 *   node scripts/lang/report.mjs
 *
 * It reads the locale files as they are now, the strings as they were before
 * this work (docs/language/baseline.json, made by baseline.mjs from main), and the result files the
 * tools left in docs/language/results/ (grammar.json, bt.json, review.json,
 * adoption.json). A result file that is not there is reported as a check that
 * was not run, in those words; nothing is filled in.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { allStrings, checkedTexts, grammarItems, meaningTexts, readJson, ROOT, HOUSE_QUOTES, LOCALES, parseMessage } from './lib/strings.mjs';
import { applyAllowlist, checkLanguage, untranslated } from './lib/mechanical.mjs';
import { checkCitations, checkGlossary } from './lib/glossary.mjs';
import { checkWords, wordsToCheck } from './lib/words.mjs';
const { argumentNames, pluralBlocks } = await import('../../src/lib/verse/msg.ts');
const { loadPack } = await import('../../src/lib/verse/packs/index.ts');

const D = `${ROOT}docs/language/`;
const R = `${D}results/`;
const NAME = { en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese (Brazil)', pl: 'Polish', ru: 'Russian', ar: 'Arabic', hi: 'Hindi', zh: 'Chinese (Simplified)', ja: 'Japanese', ko: 'Korean', vi: 'Vietnamese', th: 'Thai', id: 'Indonesian' };
const opt = (path) => (existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null);
const cldr = readJson(`${D}sources/cldr.json`);
const allowMech = readJson(`${D}allow/mechanical.json`);
const allowSame = readJson(`${D}allow/untranslated.json`);
const allowGrammar = readJson(`${D}allow/grammar.json`, { entries: [] });
const allowSpelling = readJson(`${D}allow/spelling.json`, { words: {} });
const allowMeaning = readJson(`${D}allow/meaning.json`, { entries: [] });
const glossary = readJson(`${D}glossary.json`);
const baselineFile = readJson(`${D}baseline.json`);
const baseline = baselineFile.strings;
const grammar = opt(`${R}grammar.json`);
// The first full run, before the strings were fixed: what each tool flagged at the start.
const grammarFirst = opt(`${R}grammar-first.json`);
const bt = opt(`${R}bt.json`);
const review = opt(`${R}review.json`);
const adoption = opt(`${R}adoption.json`);
// What the engineer decided, reading each correction that survived the tools (and the rest): { languages: { lang: { key: { decision, note } } } }.
const reading = opt(`${R}adoption-reading.json`);
const readOf = (lang) => reading?.languages?.[lang] ?? {};
const now = await allStrings();
const SOURCE_FILES = ['aosp-terms', 'mozilla-terms', 'google-help', 'apple-passkeys', 'wikidata-names', 'wikidata-terms', 'wikidata-titles', 'wiktionary-translations', 'wiktionary-words'];
const sources = Object.fromEntries(SOURCE_FILES.map((f) => [f, readJson(`${D}sources/${f}.json`)]));
const citations = checkCitations(glossary, sources);
// Single words against the dictionary (lib/words.mjs).
const packs = {};
const uiAll = {};
for (const l of LOCALES) {
  packs[l] = await loadPack(l);
  uiAll[l] = now[l].ui;
}
const words = checkWords(wordsToCheck(LOCALES, packs, uiAll, glossary), sources['wiktionary-words'], readJson(`${D}allow/words.json`, { entries: [] }).entries, readJson(`${D}sources/opencc-ts.json`).map);
// Is each grammar result about the string as it is now? (scripts/lang/fresh.mjs makes the same comparison.)
const grammarStale = {};
if (grammar) for (const l of LOCALES) {
  const want = checkedTexts(await grammarItems(l, now[l]));
  const got = grammar.languages?.[l]?.checked;
  grammarStale[l] = got ? Object.keys(want).filter((id) => JSON.stringify(got[id] ?? null) !== JSON.stringify(want[id])).length : Object.keys(want).length;
}
const helpers = { parseMessage, argumentNames, pluralBlocks };
const THRESHOLD = 0.6;
const XTHRESHOLD = 0.6;
// As scripts/lang/meaning.mjs: flagged when back-translation and LaBSE both doubt the string.
const doubt = (cos, x) => cos < THRESHOLD && (x === undefined || x < XTHRESHOLD);

const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ⏎ ');
const code = (s) => '`' + String(s).replace(/`/g, 'ˋ').replace(/\n/g, ' ⏎ ').replace(/\u00a0/g, '⍽').replace(/\u202f/g, '⍽') + '`';
const out = [];
const p = (...lines) => out.push(...lines);

// ---------- what changed ----------
const changes = {};
for (const lang of LOCALES) {
  changes[lang] = { ui: [], pack: [] };
  for (const sect of ['ui', 'pack']) {
    const before = baseline[lang][sect];
    const after = now[lang][sect];
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) if (before[key] !== after[key]) changes[lang][sect].push({ key, before: before[key] ?? null, after: after[key] ?? null });
  }
}

// ---------- mechanical, before and now ----------
const mech = {};
for (const lang of LOCALES) {
  const run = (strings) => {
    const found = checkLanguage(lang, strings, now.en.ui, cldr.languages[lang], helpers, { quotations: HOUSE_QUOTES, extraQuotes: allowMech.extraQuotes });
    for (const key of untranslated(lang, strings, now.en.ui, HOUSE_QUOTES)) found.push({ lang, key, rule: 'same-as-english', detail: '' });
    return found;
  };
  let before;
  try {
    before = run(baseline[lang].ui);
  } catch {
    before = null;
  }
  const after = run(now[lang].ui);
  const { open, used } = applyAllowlist(after, [...allowMech.entries, ...allowSame.entries.map((e) => ({ ...e, rule: 'same-as-english' }))]);
  const gloss = checkGlossary(lang, now[lang].ui, now.en.ui, glossary);
  const glossBefore = checkGlossary(lang, baseline[lang].ui, now.en.ui, glossary);
  mech[lang] = { before, after, open, accepted: used.length, gloss, glossBefore };
}

// ---------- meaning ----------
const meaning = {};
if (bt) {
  for (const lang of LOCALES) {
    if (lang === 'en') continue;
    const scored = bt.languages?.[lang];
    const row = (meaning[lang] = { scored: 0, backOnly: 0, flagged: [], accepted: 0, open: [], notScored: 0, control: null });
    if (!scored) {
      row.missing = true;
      continue;
    }
    let control = 0;
    for (const [key, text] of Object.entries(await meaningTexts(lang, now[lang]))) {
      const s = scored[key];
      if (!s || s.text !== text) {
        row.notScored++;
        continue;
      }
      row.scored++;
      if (doubt(s.controlCos, s.xcontrol)) control++;
      if (s.cos < THRESHOLD) row.backOnly++;
      if (!doubt(s.cos, s.xcos)) continue;
      const a = allowMeaning.entries.find((e) => e.lang === lang && e.key === key && e.text === text);
      row.flagged.push({ key, ...s, reason: a?.reason });
      if (a) row.accepted++;
      else row.open.push({ key, ...s });
    }
    row.control = row.scored ? Math.round((100 * control) / row.scored) : null;
  }
}

// ---------- the report ----------
p('# Language QA report', '');
p(`Generated by \`node scripts/lang/report.mjs\` on ${new Date().toISOString().slice(0, 10)}. Do not edit by hand: change the strings, the allowlists or the tools, run the checks again, and regenerate.`, '');
p('What this report can and cannot say. A tool that covers a language can show that a string breaks one of its rules; no tool here shows that a string is *good*. Where a language has no grammar checker, no claim about its grammar is made beyond "a second model was asked". Verse, wit and tone are not certified by anything below; the last section says what a native reader should look at first.', '');

p('## Summary by language', '');
p('Strings: interface strings (the six Shakespeare quotations, which are the source text, are not counted) + player-facing strings in the language pack (verse lines, power words, acrostic words).', '');
p(`"Changed" and "before" are measured against \`${baselineFile.ref}\` at \`${baselineFile.commit.slice(0, 10)}\` (\`docs/language/baseline.json\`, made by \`node scripts/lang/baseline.mjs\`): the strings as they stand without this work.`, '');
p('| Language | Strings (interface + pack) | Changed | Mechanical: before → now (accepted) | Glossary: before → now | LanguageTool: first run → now (accepted / open) | Hunspell: first run → now (accepted / open) | Meaning: flagged (accepted / open) | Dictionary: listed / read and kept / no entry | Second model: proposed / survived the tools / adopted after reading |');
p('|---|---|---|---|---|---|---|---|---|---|');
for (const lang of LOCALES) {
  const g = grammar?.languages?.[lang];
  const hits = (tool) => (g ? g.hits.filter((h) => h.tool === tool) : []);
  const first = (tool) => grammarFirst?.languages?.[lang]?.hits.filter((h) => h.tool === tool).length;
  const lt = !grammar ? 'not run' : !g ? 'not run' : g.languagetool ? `${first('languagetool') ?? '?'} → ${hits('languagetool').length} (${hits('languagetool').filter((h) => h.allowed).length} / ${hits('languagetool').filter((h) => !h.allowed).length})` : '**no module**';
  const hs = !grammar ? 'not run' : !g ? 'not run' : g.hunspell ? `${first('hunspell') ?? '?'} → ${hits('hunspell').length} (${hits('hunspell').filter((h) => h.allowed).length} / ${hits('hunspell').filter((h) => !h.allowed).length})` : '**no dictionary**';
  const m = meaning[lang];
  const mt = lang === 'en' ? 'source' : !bt ? 'not run' : m.missing ? 'not run' : `${m.flagged.length} of ${m.scored} (${m.accepted} / ${m.open.length})${m.notScored ? `; ${m.notScored} not scored since changed` : ''}`;
  const rv = review?.languages?.[lang];
  const proposed = rv ? Object.values(rv.reviewed).filter((r) => r.verdict === 'fix').length : null;
  const survived = adoption?.languages?.[lang]?.adopted ?? null;
  const taken = survived ? survived.filter((a) => readOf(lang)[a.key]?.decision === 'adopt').length : null;
  const rt = lang === 'en' ? 'source' : !rv ? 'not run' : `${proposed} / ${survived ? survived.length : 'not decided'} / ${taken ?? 'not read'} (of ${Object.keys(rv.reviewed).length} reviewed)`;
  const ui = Object.keys(now[lang].ui).length - Object.keys(HOUSE_QUOTES).length;
  const wr = words.rows.filter((r) => r.lang === lang);
  const dict = lang === 'en' ? 'source' : `${wr.filter((r) => r.state === 'listed').length} / ${wr.filter((r) => r.state === 'not-listed' && r.allowed).length} / ${wr.filter((r) => r.state === 'not-covered' || r.state === 'no-page').length}${wr.some((r) => r.state === 'not-listed' && !r.allowed) ? ` (**${wr.filter((r) => r.state === 'not-listed' && !r.allowed).length} open**)` : ''}`;
  p(`| ${NAME[lang]} (${lang}) | ${ui} + ${Object.keys(now[lang].pack).length} | ${changes[lang].ui.length} + ${changes[lang].pack.length} | ${mech[lang].before ? mech[lang].before.length : 'n/a'} → ${mech[lang].open.length} (${mech[lang].accepted}) | ${lang === 'en' ? '—' : `${mech[lang].glossBefore.length} → ${mech[lang].gloss.length}`} | ${lt} | ${hs} | ${mt} | ${dict} | ${rt} |`);
}
p('');
p('"First run → now": hits on the first full run (2026-11-16, after the earlier mechanical and plural fixes, before this triage) and on the final run; a hit that is gone was fixed in the string. Every hit still there is accepted, with its reason, in `docs/language/allow/`.', '');
p('"Mechanical: before" is the text as it stood before this work, measured with today\'s rules (so it counts the strings that had no plural forms). "Accepted" means listed, with a reason, in `docs/language/allow/`. "Open" should be zero; an open hit fails the run.', '');

// ---------- tool coverage ----------
p('## What each tool covers', '');
if (grammar) {
  p(`LanguageTool ${grammar.languagetool.version} (server reports ${grammar.languagetool.languages.length} language variants) and ${grammar.hunspell.version.replace(/^@\(#\) /, '')}, run ${grammar.ran.slice(0, 10)}. Before the run, each tool was given known-bad input in each language; the table records what it did with it, because a checker that cannot flag a wrong sentence says nothing by staying silent.`, '');
  p('| Language | LanguageTool | Known-bad sentences it flagged | Hunspell dictionary | Rejects a misspelling |');
  p('|---|---|---|---|---|');
  for (const lang of LOCALES) {
    const g = grammar.languages[lang];
    const s = grammar.selftest.find((r) => r.lang === lang) ?? {};
    p(`| ${NAME[lang]} | ${g?.languagetool ?? '**no module**'} | ${s.languagetoolTried ? `${s.languagetoolCaught} of ${s.languagetoolTried}` : '—'} | ${g?.hunspell ? g.hunspell.join(', ') : '**none**'} | ${s.hunspellWorks === undefined ? '—' : s.hunspellWorks ? 'yes' : '**no**'} |`);
  }
  p('');
  const noLt = LOCALES.filter((l) => !grammar.languages[l]?.languagetool);
  const weak = grammar.selftest.filter((r) => r.languagetoolTried && r.languagetoolCaught < r.languagetoolTried);
  const noHs = LOCALES.filter((l) => !grammar.languages[l]?.hunspell);
  p('In plain words:', '');
  p(`- **No grammar checker at all** for ${noLt.map((l) => NAME[l]).join(', ')}. LanguageTool has no module for them. Their grammar has been read by the second model only, which is a generative model's opinion and not a verification.`);
  if (weak.length) p(`- **A weak grammar checker** for ${weak.map((r) => `${NAME[r.lang]} (flagged ${r.languagetoolCaught} of ${r.languagetoolTried} plainly wrong sentences)`).join(', ')}. A clean LanguageTool run in these languages rules out less than it does in the others.`);
  p(`- **No spelling dictionary** for ${noHs.map((l) => NAME[l]).join(', ')}: Hunspell works on words separated by spaces and has no dictionary for them.`);
  p('- Thai is written without spaces; its words are found with the ICU word segmenter (`Intl.Segmenter`) before they are put to the dictionary, so a Thai "misspelling" can also be a segmentation the dictionary does not know.');
  p('- Neither tool reads verse as verse. The pack lines (the written opponent\'s verses) are checked for spelling and for outright grammar errors only.', '');
  const staleTotal = Object.values(grammarStale).reduce((a, b) => a + b, 0);
  p(grammar.languages?.en?.checked ? (staleTotal ? `**${staleTotal} strings changed after this grammar run** and were not checked as they are now (\`node scripts/lang/fresh.mjs\` lists them): ${Object.entries(grammarStale).filter(([, n]) => n).map(([l, n]) => `${l} ${n}`).join(', ')}.` : 'Every string was checked by LanguageTool and Hunspell as it is now: `grammar.json` keeps each sentence it read, and `node scripts/lang/fresh.mjs` finds none that has changed since.') : '**This grammar result keeps no record of the text it read**, so it cannot show that it is about the current strings.', '');
} else p('**LanguageTool and Hunspell were not run** (no `docs/language/results/grammar.json`). Nothing is claimed about grammar or spelling.', '');

if (bt) {
  p(`Back-translation: ${bt.model}, on ${bt.device ?? 'cpu'} (beam ${bt.beam ?? 4}); similarity by ${bt.embedder}. Second signal: ${bt.bitext ?? 'none'}, which scores each translation against its English directly, with no back-translation in between. A string is flagged when the back-translation scores under ${THRESHOLD} **and** LaBSE scores it under ${XTHRESHOLD}: alone, back-translation flags short labels by the dozen, because the translation model copies a one-word label through untranslated ('Mazo' came back as 'Mazo'). The control: every back-translation and every translation is also scored against the wrong English sentence (the next key's), with the same rule.`, '');
  p('| Language | Scored | Under the threshold by back-translation alone | Flagged (both signals) | Mismatched control pairs the rule catches |');
  p('|---|---|---|---|---|');
  for (const lang of LOCALES) if (lang !== 'en') p(`| ${NAME[lang]} | ${meaning[lang].missing ? 'not run' : meaning[lang].scored} | ${meaning[lang].missing ? '—' : meaning[lang].backOnly} | ${meaning[lang].missing ? '—' : meaning[lang].flagged.length} | ${meaning[lang].control === null ? '—' : meaning[lang].control + '%'} |`);
  p('', 'A string is flagged only when **both** signals doubt it, so a drift that one of them sees and the other does not is not flagged: the column "under the threshold by back-translation alone" counts those, and they were not all read. Single words, where this matters most (Hindi लालसा, greed, for "ambition", passed with LaBSE 0.72), are checked against a dictionary instead (next section). Back-translation finds a changed meaning; it does not find a translation that is faithful and clumsy, and it is unreliable on one-word labels, where the translation model has no context. What is scored: every interface string, and each relic\'s power words against the English word they translate. The written opponent\'s verses and the acrostic words are not: each language\'s were written to keep a form, with no English line to compare.', '');
  p(`Every flagged string was read, and either changed (then scored again) or accepted with its reason in \`docs/language/allow/meaning.json\` (${allowMeaning.entries.length} entries). Most flags are names and one-word labels that MADLAD copies through or reads in another sense (Spanish *Mazo* came back as 'Mazo', Arabic الخصم, the opponent, as 'discount'). The reader was the engineer doing this work, a language model, not a native speaker: an accepted flag means a second reading found the string right, not that a native speaker did.`, '');
} else p('**Back-translation was not run** (no `docs/language/results/bt.json`). Nothing is claimed about meaning beyond the mechanical and glossary checks.', '');

{
  const changedWords = [];
  for (const lang of LOCALES) for (const c of changes[lang].pack) if (c.key.startsWith('relics.')) changedWords.push(`${lang} ${c.key}: ${c.before} → ${c.after}`);
  p('## Single words against a dictionary', '');
  p(`Each relic's power words (they score in a duel), the judge's four criteria and the glossary's core terms, ${words.rows.length} words in 15 languages, are looked up in English Wiktionary's translation tables for their English word (\`docs/language/sources/wiktionary-words.json\`, fetched by \`scripts/lang/fetch-wiktionary-words.mjs\`; Chinese is compared through OpenCC's traditional-to-simplified table, since Wiktionary writes Mandarin in traditional characters). Where a table has nothing for the language, the word's own Wiktionary entry decides by its English glosses. A word that is not listed is changed or read and kept with its reason in \`docs/language/allow/words.json\`; the unit tests fail on one that is neither, and name the old Hindi लालसा and Portuguese *engenho* when they are planted.`, '');
  p(`- Listed: ${words.rows.filter((r) => r.state === 'listed').length}. Not listed, read and kept: ${words.rows.filter((r) => r.state === 'not-listed' && r.allowed).length} (most are a sense the table lacks: Shakespeare's Fool as the jester, the stage play, "drown" given as a noun, plurals, the word games use for a deck). Open: ${words.open.length}. No entry at all: ${words.rows.filter((r) => r.state === 'not-covered' || r.state === 'no-page').length}, which proves nothing either way.`);
  p(`- Power words changed: ${changedWords.length ? changedWords.join('; ') : 'none'}.`, '');
  p(`The glossary's citations (${citations.count} of them: Android's, Firefox's, Google's and Apple's strings, Wikipedia titles, Wikidata labels, Wiktionary words) are each checked exactly against the fetched file by the unit tests: ${citations.problems.length ? `**${citations.problems.length} do not hold**` : 'all hold'}.`, '');
}

if (review) {
  p(`Second opinion: ${String(review.server?.model ?? review.model ?? 'a local model').split('/').pop()} (see PROVENANCE.md for the repository, revision and checksum) under llama.cpp ${review.server?.build ?? ''}, asked per language to review each string as a native-speaking localisation reviewer. Its control (planted errors it must catch, a correct line it must pass):`, '');
  p('| Language | Passed the correct line | Caught the wrong word | Caught text left in English | Caught the broken grammar | Reviewed | Proposed corrections | No answer |');
  p('|---|---|---|---|---|---|---|---|');
  for (const lang of LOCALES) {
    const r = review.languages?.[lang];
    if (!r) continue;
    const c = r.control ?? {};
    const yn = (b) => (b ? 'yes' : '**no**');
    const vals = Object.values(r.reviewed);
    p(`| ${NAME[lang]} | ${yn(c.passedGood)} | ${yn(c.caughtWrongWord)} | ${yn(c.caughtEnglish)} | ${yn(c.caughtGrammar)} | ${vals.length} | ${vals.filter((v) => v.verdict === 'fix').length} | ${vals.filter((v) => v.verdict === 'no answer').length}${r.failedBatches ? ` (${r.failedBatches} failed batch${r.failedBatches > 1 ? 'es' : ''}, asked again on a later run)` : ''} |`);
  }
  p('', 'A correction was adopted only if it passed the mechanical checks and the glossary, raised no new LanguageTool or Hunspell hit, was not flagged by the meaning check nor further from the English than the text it replaced, and then read as right (the section on the second model\'s corrections, below). A model\'s "ok" is not counted as verification anywhere in this report.', '');
} else p('**The second-model review was not run** (no `docs/language/results/review.json`).', '');

// ---------- per language ----------
p('## Per language', '');
for (const lang of LOCALES) {
  p(`### ${NAME[lang]} (${lang})`, '');
  const g = grammar?.languages?.[lang];
  const cats = cldr.languages[lang].pluralCategories;
  p(`- Plural categories (CLDR ${cldr.version}): ${cats.join(', ')}. Strings with a count: ${Object.values(now[lang].ui).filter((v) => pluralBlocks(v).length).length}.`);
  const byRule = {};
  for (const f of mech[lang].before ?? []) byRule[f.rule] = (byRule[f.rule] ?? 0) + 1;
  p(`- Mechanical checks before: ${mech[lang].before ? mech[lang].before.length : 'n/a'}${Object.keys(byRule).length ? ` (${Object.entries(byRule).map(([r, n]) => `${r} ${n}`).join(', ')})` : ''}. Now open: ${mech[lang].open.length}; accepted exceptions: ${mech[lang].accepted}.`);
  if (lang !== 'en') p(`- Glossary: ${mech[lang].glossBefore.length} strings strayed from the glossary before, ${mech[lang].gloss.length} now.`);
  if (g) {
    for (const tool of ['languagetool', 'hunspell']) {
      const covered = tool === 'languagetool' ? g.languagetool : g.hunspell;
      if (!covered) {
        p(`- ${tool === 'languagetool' ? 'LanguageTool' : 'Hunspell'}: **does not cover this language.**`);
        continue;
      }
      const hs = g.hits.filter((h) => h.tool === tool);
      const openHits = hs.filter((h) => !h.allowed);
      const rules = {};
      for (const h of hs) rules[h.rule] = (rules[h.rule] ?? 0) + 1;
      p(`- ${tool === 'languagetool' ? `LanguageTool (${g.languagetool})` : `Hunspell (${g.hunspell.join(', ')})`}: ${hs.length} hits on ${g.strings.sentences} rendered sentences; ${hs.length - openHits.length} accepted with a reason, ${openHits.length} open.${tool === 'languagetool' && hs.length ? ` By rule: ${Object.entries(rules).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([r, n]) => `${r} ${n}`).join(', ')}.` : ''}`);
      for (const h of openHits.slice(0, 40)) p(`  - OPEN ${code(h.id)} ${h.rule}: “${cell(h.at)}” in “${cell(h.text)}” (${cell(h.message)})`);
    }
  } else if (grammar) p('- LanguageTool and Hunspell: not run for this language.');
  if (lang !== 'en') {
    const m = meaning[lang];
    if (!bt || m.missing) p('- Back-translation: not run.');
    else {
      p(`- Back-translation: ${m.scored} scored, ${m.backOnly} under ${THRESHOLD} by back-translation alone, ${m.flagged.length} flagged by both signals; ${m.accepted} read and accepted with a reason, ${m.open.length} open${m.notScored ? `, ${m.notScored} changed after the run and not scored again` : ''}.`);
      for (const f of m.open.slice(0, 40)) p(`  - OPEN ${code(f.key)} cos ${f.cos}: “${cell(f.text)}” came back as “${cell(f.back)}” (English: “${cell(f.english)}”)`);
    }
    const rv = review?.languages?.[lang];
    if (rv) {
      const a = adoption?.languages?.[lang];
      const stage1 = a ? a.rejected.filter((r) => /^(mechanical|glossary|no change|stale)/.test(r.why)).length : 0;
      const taken = a ? a.adopted.filter((x) => readOf(lang)[x.key]?.decision === 'adopt').length : 0;
      p(`- Second model: ${Object.values(rv.reviewed).filter((r) => r.verdict === 'fix').length} corrections proposed${a ? `; ${stage1} stopped at the mechanical or glossary check, ${a.rejected.length - stage1} by LanguageTool, Hunspell or the meaning check, ${a.adopted.length} survived the tools; ${taken} adopted after reading` : '; adoption not decided'}.`);
    } else p('- Second model: not run.');
    p(`- Strings changed: ${changes[lang].ui.length} interface, ${changes[lang].pack.length} pack.`);
  }
  p('');
}

// ---------- accepted exceptions ----------
p('## What remains flagged, and why', '');
p('Every exception is one line in a checked-in file with its reason; a run fails on a hit that is not listed and on a listed exception that no longer matches anything.', '');
p(`- Mechanical (\`allow/mechanical.json\`): ${allowMech.entries.length} entries, plus two extra quotation-mark pairs (Spanish « », Arabic « »; reasons in the file).`);
p(`- Same as English (\`allow/untranslated.json\`): ${allowSame.entries.length} entries (names, loanwords, forms whose name is the same).`);
p(`- LanguageTool (\`allow/grammar.json\`): ${allowGrammar.entries.length} entries.`);
p(`- Hunspell (\`allow/spelling.json\`): ${Object.values(allowSpelling.words).reduce((n, w) => n + Object.keys(w).length, 0)} words.`);
p(`- Back-translation (\`allow/meaning.json\`): ${allowMeaning.entries.length} entries.`, '');
if (allowGrammar.entries.length) {
  const byReason = {};
  for (const e of allowGrammar.entries) (byReason[e.reason] ??= []).push(e);
  p('LanguageTool exceptions by reason:', '');
  for (const [reason, es] of Object.entries(byReason).sort((a, b) => b[1].length - a[1].length)) p(`- ${es.length} × ${reason} (${[...new Set(es.map((e) => `${e.lang} ${e.rule}`))].slice(0, 12).join('; ')}${new Set(es.map((e) => `${e.lang} ${e.rule}`)).size > 12 ? '; …' : ''})`);
  p('');
}

// ---------- form names ----------
p('## Form names: where each comes from', '');
const names = Object.entries(glossary.names ?? {});
const byStatus = { sourced: [], head: [], 'own-name': [], 'not-sourced': [] };
for (const [key, n] of names) for (const [lang, e] of Object.entries(n.langs)) (byStatus[e.status] ??= []).push({ key, lang, ...e });
p(`${names.length} names × 15 languages = ${names.length * 15}, each with a status in \`docs/language/glossary.json\` that the unit tests hold to its cited evidence:`, '');
p(`- **Sourced** (${byStatus.sourced.length}): the name is that language's Wikipedia article title, a Wikidata label or alias, or a Wiktionary translation, in the fetched data.`);
p(`- **Head word sourced** (${byStatus.head.length}): the quatrains, whose head word is sourced (Cuarteta, Vierzeiler, 四行诗) and whose words for the rhyme pattern are the translator's.`);
p(`- **The form's own name** (${byStatus['own-name'].length}): Jueju and Lục bát, as other languages' Wikipedias title them, where this language has no article.`);
p(`- **Not sourced** (${byStatus['not-sourced'].length}): the translator's name; no article, label or dictionary entry gives one in this language. Listed here for a native reader. Where the meaning check doubted one of these, the exception says "Not sourced" and gives the reading it was kept on, which is a language model's reading.`, '');
p('| Name | Language | Text | Why it is not sourced |', '|---|---|---|---|');
for (const u of byStatus['not-sourced']) p(`| ${code(u.key)} | ${u.lang} | ${cell(u.value)} | ${cell(u.source)} |`);
p('', 'Head-sourced names (the rhyme-pattern words are not sourced):', '');
p('| Name | Language | Text | Sourced head |', '|---|---|---|---|');
for (const u of byStatus.head) p(`| ${code(u.key)} | ${u.lang} | ${cell(u.value)} | ${cell(u.head)} |`);
p('');

// ---------- second-model corrections, as read ----------
if (adoption) {
  p('## The second model\'s corrections, as read', '');
  p('Surviving the tools is necessary, not sufficient: a correction that passes LanguageTool, Hunspell and the meaning check can still be wrong (in Hindi, Arabic and German the reviewer turned the theatre company\'s *player*, an actor, into a games *player*). Every survivor was read against the English and where the string appears, and adopted or not with a reason, in `docs/language/results/adoption-reading.json`. The reader was the engineer doing this work, a language model, not a native speaker. Strings changed for reasons of the engineer\'s own (a fault the reviewer pointed near, or one the meaning check showed) were put through the same tools and are in the list of every change below.', '');
  for (const lang of LOCALES) {
    const a = adoption.languages?.[lang];
    if (!a) continue;
    const taken = a.adopted.filter((x) => readOf(lang)[x.key]?.decision === 'adopt');
    const left = a.adopted.filter((x) => readOf(lang)[x.key]?.decision !== 'adopt');
    p(`### ${NAME[lang]} (${lang}): ${taken.length} adopted of ${a.adopted.length} that survived the tools`, '');
    for (const x of taken) p(`- adopted ${code(x.key)}: ${code(x.old)} → ${code(x.new)}. ${cell(readOf(lang)[x.key].note)}`);
    for (const x of left) p(`- not adopted ${code(x.key)}: ${code(x.new)}. ${cell(readOf(lang)[x.key]?.note ?? 'not read')}`);
    p('');
  }
}

// ---------- human review ----------
const human = `${D}HUMAN-REVIEW.md`;
if (existsSync(human)) p(readFileSync(human, 'utf8').trim(), '');

// ---------- every change ----------
p('## Every string changed', '');
p('Old text first, new text second. ⍽ marks a no-break space. A key with a dotted number is a pack string (a verse line, a power word).', '');
for (const lang of LOCALES) {
  const all = [...changes[lang].ui.map((c) => ({ ...c, sect: 'ui' })), ...changes[lang].pack.map((c) => ({ ...c, sect: 'pack' }))];
  if (!all.length) continue;
  p(`### ${NAME[lang]} (${lang}): ${all.length}`, '');
  for (const c of all) p(`- ${code(`${c.sect === 'pack' ? 'pack:' : ''}${c.key}`)}`, `  - old: ${c.before === null ? '(none)' : code(c.before)}`, `  - new: ${c.after === null ? '(removed)' : code(c.after)}`);
  p('');
}
writeFileSync(`${D}QA-REPORT.md`, out.join('\n') + '\n');

// ---------- the glossary, readable ----------
const g = [];
g.push('# Glossary', '', 'Generated from `glossary.json` by `node scripts/lang/report.mjs`; edit the JSON, not this file. The check that holds every string to it is `scripts/lang/lib/glossary.mjs` (unit test `src/i18n/quality.test.ts`).', '');
g.push('## Terms', '');
const langs = LOCALES.filter((l) => l !== 'en');
for (const [id, t] of Object.entries(glossary.terms)) {
  g.push(`### ${t.english}`, '', t.note, '', '| Language | Term | Also accepted (stems) | Source |', '|---|---|---|---|');
  for (const l of langs) g.push(`| ${l} | ${cell(t.langs[l].term)} | ${cell((t.langs[l].accept ?? []).join(', '))} | ${cell(t.langs[l].source)} |`);
  g.push('');
}
g.push('## Names of forms and devices', '');
for (const [key, n] of Object.entries(glossary.names)) {
  g.push(`### ${n.english} (\`${key}\`, Wikidata ${n.wikidata})`, '', '| Language | Name | Where it comes from |', '|---|---|---|');
  for (const l of langs) g.push(`| ${l} | ${cell(n.langs[l].value)} | ${cell(n.langs[l].source)} |`);
  g.push('');
}
writeFileSync(`${D}GLOSSARY.md`, g.join('\n') + '\n');
console.log(`${D}QA-REPORT.md: ${out.length} lines`);
