#!/usr/bin/env node
/**
 * Decide which of the second model's corrections survive the tools.
 *
 *   node scripts/lang/adopt.mjs propose <review.json> [--out dir]
 *       -> dir/overlay.json   the corrections that pass the mechanical and glossary checks,
 *                             as { lang: { key: text } }, for LANGQA_OVERLAY
 *          dir/pairs.json     the same, rendered, for back-translation
 *          dir/proposals.json every proposal and what the first checks said
 *
 *   node scripts/lang/adopt.mjs decide --proposals dir/proposals.json --base grammar.json \
 *        --with grammar-with-overlay.json --pairs pairs-out.json --bt bt.json [--out adoption.json]
 *       -> adoption.json      each proposal: adopted or rejected, and why
 *          adoption-survivors.json  the ones that survived the tools, { lang: { key: text } }: read each
 *                             against the English, record the decision in adoption-reading.json, and
 *                             apply (scripts/lang/apply.mjs) only those marked adopt
 *
 * A correction is adopted only if (1) it passes the mechanical checks and keeps
 * the glossary, (2) LanguageTool and Hunspell raise nothing on it that they did
 * not raise on the text it replaces, and (3) the meaning check does not flag it
 * (back-translation and LaBSE both under 0.6), nor is it further from the
 * English than the old text on both signals (by more than 0.02).
 * Surviving is necessary, not sufficient: read the survivors before applying.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { allStrings, renderSamples, readJson, ROOT, HOUSE_QUOTES, parseMessage } from './lib/strings.mjs';
import { checkLanguage } from './lib/mechanical.mjs';
import { checkGlossary } from './lib/glossary.mjs';
const { argumentNames, pluralBlocks } = await import('../../src/lib/verse/msg.ts');

const [mode, ...rest] = process.argv.slice(2);
const opt = (name, dflt) => (rest.includes(name) ? rest[rest.indexOf(name) + 1] : dflt);
const cldr = readJson(`${ROOT}docs/language/sources/cldr.json`);
const allowMech = readJson(`${ROOT}docs/language/allow/mechanical.json`);
const glossary = readJson(`${ROOT}docs/language/glossary.json`);
const strings = await allStrings();
const helpers = { parseMessage, argumentNames, pluralBlocks };

if (mode === 'propose') {
  const review = JSON.parse(readFileSync(rest[0], 'utf8'));
  const dir = resolve(opt('--out', `${ROOT}.langqa/adopt`));
  mkdirSync(dir, { recursive: true });
  const overlay = {};
  const pairs = [];
  const proposals = [];
  for (const [lang, r] of Object.entries(review.languages)) {
    for (const [key, v] of Object.entries(r.reviewed)) {
      if (v.verdict !== 'fix' || key in HOUSE_QUOTES) continue;
      const current = strings[lang].ui[key];
      const row = { lang, key, current, proposed: v.corrected, reason: v.reason, stage1: 'pass' };
      proposals.push(row);
      if (v.translation !== current) row.stage1 = 'stale: the string has changed since it was reviewed';
      else if (!v.corrected || v.corrected === current) row.stage1 = 'no change proposed';
      else {
        const trial = { ...strings[lang].ui, [key]: v.corrected };
        const was = new Set(checkLanguage(lang, strings[lang].ui, strings.en.ui, cldr.languages[lang], helpers, { quotations: HOUSE_QUOTES, extraQuotes: allowMech.extraQuotes }).filter((p) => p.key === key).map((p) => p.rule));
        const mech = checkLanguage(lang, trial, strings.en.ui, cldr.languages[lang], helpers, { quotations: HOUSE_QUOTES, extraQuotes: allowMech.extraQuotes }).filter((p) => p.key === key && !was.has(p.rule));
        const gloss = checkGlossary(lang, trial, strings.en.ui, glossary).filter((p) => p.key === key);
        if (mech.length) row.stage1 = `mechanical: ${mech.map((m) => `${m.rule} (${m.detail})`).join('; ')}`;
        else if (gloss.length) row.stage1 = `glossary: ${gloss.map((g) => g.detail).join('; ')}`;
      }
      if (row.stage1 !== 'pass') continue;
      (overlay[lang] ??= {})[key] = v.corrected;
    }
  }
  // Render with all the surviving corrections of a language in place, as they would be read together.
  process.env.LANGQA_OVERLAY = `${dir}/overlay.json`;
  writeFileSync(`${dir}/overlay.json`, JSON.stringify(overlay, null, 1) + '\n');
  for (const [lang, keys] of Object.entries(overlay)) {
    for (const [key, text] of Object.entries(keys)) {
      pairs.push({ id: `${lang}|${key}`, lang, text: (await renderSamples(lang, text, { typical: true, key }))[0].text, english: (await renderSamples('en', strings.en.ui[key], { typical: true, key }))[0].text });
    }
  }
  writeFileSync(`${dir}/pairs.json`, JSON.stringify(pairs, null, 1) + '\n');
  writeFileSync(`${dir}/proposals.json`, JSON.stringify(proposals, null, 1) + '\n');
  const by = {};
  for (const pr of proposals) ((by[pr.lang] ??= { pass: 0, out: 0 })[pr.stage1 === 'pass' ? 'pass' : 'out'])++;
  for (const [l, c] of Object.entries(by)) console.log(`${l}: ${c.pass} to the tools, ${c.out} stopped at the mechanical or glossary check`);
  console.log(`${dir}: overlay.json, pairs.json, proposals.json`);
} else if (mode === 'decide') {
  const proposals = JSON.parse(readFileSync(opt('--proposals'), 'utf8'));
  const base = JSON.parse(readFileSync(opt('--base'), 'utf8'));
  const withO = JSON.parse(readFileSync(opt('--with'), 'utf8'));
  const pairs = Object.fromEntries(JSON.parse(readFileSync(opt('--pairs'), 'utf8')).map((p) => [p.id, p]));
  const bt = JSON.parse(readFileSync(opt('--bt'), 'utf8'));
  const out = resolve(opt('--out', `${ROOT}docs/language/results/adoption.json`));
  const result = { decided: new Date().toISOString(), rule: 'adopted = passes the mechanical and glossary checks; raises no new LanguageTool or Hunspell hit; is not flagged by the meaning check (back-translation and LaBSE both under 0.6); and is not further from the English than the old text on both signals (by more than 0.02)', languages: {} };
  const changes = {};
  const sig = (h) => `${h.tool}|${h.rule}|${h.at}`;
  for (const pr of proposals) {
    const L = (result.languages[pr.lang] ??= { adopted: [], rejected: [] });
    if (pr.stage1 !== 'pass') {
      L.rejected.push({ key: pr.key, current: pr.current, proposed: pr.proposed, modelReason: pr.reason, why: pr.stage1 });
      continue;
    }
    const id = `ui:${pr.key}`;
    const had = new Set((base.languages[pr.lang]?.hits ?? []).filter((h) => h.id === id).map(sig));
    const fresh = (withO.languages[pr.lang]?.hits ?? []).filter((h) => h.id === id && !had.has(sig(h)) && !h.allowed);
    const before = bt.languages?.[pr.lang]?.[pr.key];
    const after = pairs[`${pr.lang}|${pr.key}`];
    let why = null;
    // Step 3 as meaning.mjs applies it: flagged when back-translation and LaBSE both doubt the text.
    const doubt = (c, x) => c < 0.6 && (x === undefined || x < 0.6);
    const worse = (a, b) => b !== undefined && a !== undefined && b < a - 0.02;
    if (fresh.length) why = `new ${fresh[0].tool} hit: ${fresh[0].rule} on “${fresh[0].at}” (${fresh[0].message})`;
    else if (!after) why = 'not back-translated';
    else if (!before) why = 'the old text has no back-translation score to compare with';
    else if (doubt(after.cos, after.xcos)) why = `the meaning check flags it: back-translation cosine ${after.cos}, LaBSE ${after.xcos ?? '—'} (“${after.back}”)`;
    else if (worse(before.cos, after.cos) && (before.xcos === undefined || worse(before.xcos, after.xcos))) why = `further from the English than the text it would replace: cosine ${before.cos} → ${after.cos}, LaBSE ${before.xcos ?? '—'} → ${after.xcos ?? '—'} (“${after.back}”)`;
    if (why) L.rejected.push({ key: pr.key, current: pr.current, proposed: pr.proposed, modelReason: pr.reason, why });
    else {
      L.adopted.push({ key: pr.key, old: pr.current, new: pr.proposed, modelReason: pr.reason, cosOld: before.cos, cosNew: after.cos, xcosOld: before.xcos, xcosNew: after.xcos, back: after.back });
      (changes[pr.lang] ??= {})[pr.key] = pr.proposed;
    }
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(result, null, 1) + '\n');
  writeFileSync(out.replace(/adoption\.json$/, 'adoption-survivors.json'), JSON.stringify(changes, null, 1) + '\n');
  for (const [l, r] of Object.entries(result.languages)) console.log(`${l}: ${r.adopted.length} survive, ${r.rejected.length} rejected`);
} else {
  console.error('usage: adopt.mjs propose <review.json> | decide --proposals … --base … --with … --pairs … --bt …');
  process.exit(2);
}
