// Measure, in a real browser, how each in-browser model judges and writes verse in each language.
//
//   node scripts/model-eval/run.mjs
//
// Runs on the build host (WebGPU on Apple Metal), under memguard, one at a time:
//
//   M=/Volumes/macos_4TB_external_1/wai-build/im-lang/model-eval
//   /Volumes/macos_4TB_external_1/wai-build/bin/memguard --max-gb 24 -- node scripts/model-eval/run.mjs
//
// What it calls is the game's own code, served unbundled by the dev server it starts:
// loadBrain and generate (src/lib/brain.ts), modelJudge (src/lib/verse/referee.ts, the
// function referee() itself calls), writeOpponentVerse and scoreVerse (opponent.ts,
// duel.ts). Nothing about judging or writing is re-implemented here.
//
// One cell is one model, one language, one task. Each finished cell is written at once to
// MEVAL_OUT and a cell already there is skipped, so a run that is stopped (the host is
// shared, and its memory guard may end a run) picks up where it left off. Languages are
// the outer loop: a language is finished for every model before the next begins.
//
// Environment:
//   MEVAL_DIR      state on the build host (browser profile, results, lock). Default
//                  /Volumes/macos_4TB_external_1/wai-build/im-lang/model-eval
//   MEVAL_PORT     dev-server port. It is the page origin, and the browser keeps downloaded
//                  models per origin, so it must stay the same between runs. Default 47731
//   TIERS, LANGS   comma-separated subsets. Default all three models, all sixteen languages
//   TASKS          judge,write (default both)
//   MEVAL_MINUTES  start no new cell after this many minutes (default 0: no limit)
//   MEVAL_PER_FORM plays per form in a writing cell (default 10)
//   MEVAL_CONTROL  "same": instead of the matrix, judge pairs whose two verses are the
//                  same text. A judge that reads a preference there is broken, and so is a
//                  harness that reports one; the result goes to control/ and decides nothing.
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { LANGS as ALL_LANGS, TIERS as ALL_TIERS } from './lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPO_CELLS = join(ROOT, 'docs', 'language', 'model-eval', 'cells');
const DIR = process.env.MEVAL_DIR ?? '/Volumes/macos_4TB_external_1/wai-build/im-lang/model-eval';
const OUT = join(DIR, 'results');
const PORT = Number(process.env.MEVAL_PORT ?? 47731);
const ORIGIN = `http://localhost:${PORT}`;
const TIERS = (process.env.TIERS ?? ALL_TIERS.join(',')).split(',').filter(Boolean);
const LANGS = (process.env.LANGS ?? ALL_LANGS.join(',')).split(',').filter(Boolean);
const TASKS = (process.env.TASKS ?? 'judge,write').split(',').filter(Boolean);
const MINUTES = Number(process.env.MEVAL_MINUTES ?? 0);
const PER_FORM = Number(process.env.MEVAL_PER_FORM ?? 10);
const CONTROL = process.env.MEVAL_CONTROL ?? '';
const started = Date.now();
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// --- One evaluation at a time on this host ---
mkdirSync(OUT, { recursive: true });
const LOCK = join(DIR, 'lock');
try {
  mkdirSync(LOCK);
} catch {
  const holder = existsSync(join(LOCK, 'pid')) ? readFileSync(join(LOCK, 'pid'), 'utf8').trim() : '';
  let alive = false;
  try { alive = !!holder && (process.kill(Number(holder), 0), true); } catch { alive = false; }
  if (alive) { console.error(`model-eval: another run holds ${LOCK} (pid ${holder}); two model evaluations must not run at once.`); process.exit(75); }
  log(`taking over a lock left by a run that is gone (pid ${holder || 'unknown'})`);
}
writeFileSync(join(LOCK, 'pid'), String(process.pid));
// The other harnesses in this repository that load a model in a browser.
const others = (() => {
  try { return execFileSync('pgrep', ['-fl', 'judge-eval.mjs|model-spike.mjs|playwright.model.config'], { encoding: 'utf8' }).trim(); } catch { return ''; }
})();
if (others) { rmSync(LOCK, { recursive: true, force: true }); console.error(`model-eval: another model harness is running; not starting a second one:\n${others}`); process.exit(75); }

let server;
let ctx;
let cleaned = false;
async function cleanup() {
  if (cleaned) return;
  cleaned = true;
  try { await ctx?.close(); } catch { /* already gone */ }
  // The dev server is this run's own child: stop it by its handle, never by name.
  try { server?.kill('SIGTERM'); } catch { /* already gone */ }
  rmSync(LOCK, { recursive: true, force: true });
}
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => cleanup().then(() => process.exit(143)));

/** Results live on the build host between runs; the repository gets a copy. */
function syncToRepo() {
  mkdirSync(REPO_CELLS, { recursive: true });
  for (const f of readdirSync(OUT)) if (f.endsWith('.json')) cpSync(join(OUT, f), join(REPO_CELLS, f));
  if (existsSync(join(OUT, 'control'))) cpSync(join(OUT, 'control'), join(ROOT, 'docs', 'language', 'model-eval', 'control'), { recursive: true });
}

async function waitFor(url, ms) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try { if ((await fetch(url)).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${url} did not answer in ${ms / 1000}s`);
}

// --- In the page: the game's own modules ---

/** Load a model, and say which one really loaded: loadBrain falls back to a smaller one when a model fails. */
async function pageLoad(tier) {
  const brain = await import('/src/lib/brain.ts');
  const t0 = performance.now();
  let last = '';
  const ok = await brain.loadBrain(tier, (p) => { if (p.text !== last && p.percent % 10 === 0) { last = p.text; console.log('[meval]', p.text); } });
  const info = brain.brainInfo();
  const adapter = await navigator.gpu?.requestAdapter();
  return {
    ok, tier: info?.tier ?? null, id: info?.id ?? null, dtype: info?.dtype ?? null, judge: info?.judge ?? null, loadMs: Math.round(performance.now() - t0),
    gpu: adapter?.info ? { vendor: adapter.info.vendor, architecture: adapter.info.architecture, device: adapter.info.device, description: adapter.info.description } : null,
    userAgent: navigator.userAgent,
  };
}

async function pageJudge({ lang, pairs, same }) {
  const { modelJudge } = await import('/src/lib/verse/referee.ts');
  const out = [];
  for (let i = 0; i < pairs.length; i++) {
    const p = pairs[i];
    // The better verse sits on each side in turn, and not always the same side for one kind of worse verse.
    const betterIsPlayer = (i + Math.floor(i / 4)) % 2 === 0;
    const worse = same ? p.better.text : p.worse.text;
    const t0 = performance.now();
    const s = await modelJudge(betterIsPlayer ? p.better.text : worse, betterIsPlayer ? worse : p.better.text, lang);
    out.push({ id: p.id, kind: p.worse.kind, betterIsPlayer, criteria: s.criteria, player: s.player, opponent: s.opponent, source: s.source, ms: Math.round(performance.now() - t0) });
  }
  return out;
}

/** Which duels to write in: seeds whose rounds, as createDuel draws them, give every form of the language `perForm` plays. */
async function pagePlan({ lang, perForm }) {
  const { loadPack } = await import('/src/lib/verse/packs/index.ts');
  const { createDuel, starterDeck } = await import('/src/lib/verse/duel.ts');
  const { formsFor } = await import('/src/lib/verse/forms.ts');
  await loadPack(lang);
  const forms = formsFor(lang).map((f) => f.id);
  const count = Object.fromEntries(forms.map((f) => [f, 0]));
  const DIFFICULTIES = ['apprentice', 'player', 'master'];
  const slots = [];
  for (let seed = 1001; seed < 3001 && forms.some((f) => count[f] < perForm); seed++) {
    const duel = createDuel(seed, lang, starterDeck());
    duel.rounds.forEach((plan, roundIndex) => {
      if (count[plan.formId] >= perForm) return;
      slots.push({ seed, roundIndex, formId: plan.formId, difficulty: DIFFICULTIES[count[plan.formId] % 3] });
      count[plan.formId]++;
    });
  }
  return { forms, slots };
}

async function pageWrite({ lang, slots, replies }) {
  const brain = await import('/src/lib/brain.ts');
  const { loadPack } = await import('/src/lib/verse/packs/index.ts');
  const { createDuel, starterDeck, scoreVerse } = await import('/src/lib/verse/duel.ts');
  const { getForm } = await import('/src/lib/verse/forms.ts');
  const { getCardById } = await import('/src/lib/cards.ts');
  const { writeOpponentVerse, opponentMessages, tidyModelVerse, expectedLines } = await import('/src/lib/verse/opponent.ts');
  const { linesOf } = await import('/src/lib/verse/text.ts');
  await loadPack(lang);
  const plays = [];
  for (const slot of slots) {
    const duel = createDuel(slot.seed, lang, starterDeck());
    const plan = duel.rounds[slot.roundIndex];
    const form = getForm(plan.formId);
    const card = getCardById(plan.opponent.charId);
    const n = expectedLines(form, plan.ctx);
    // After the first round the opponent answers the player's last verse: a real verse in the language.
    const previous = slot.roundIndex > 0 ? replies[slot.seed % replies.length] : undefined;
    const score = (verse) => scoreVerse({ verse, form, ctx: plan.ctx, card, deckCharacters: duel.opponent.characters, opponentVerse: previous, lent: plan.opponent.relic });
    const drafts = [];
    const written = await writeOpponentVerse({
      duel, roundIndex: slot.roundIndex, difficulty: slot.difficulty, previousPlayerVerse: previous,
      generate: async (messages, o) => {
        const t0 = performance.now();
        const raw = await brain.generate(messages, { maxTokens: o.maxTokens, temperature: o.temperature });
        const ms = performance.now() - t0;
        const tidy = tidyModelVerse(raw, n);
        const s = tidy ? score(tidy) : null;
        drafts.push({ raw, tidy, ms: Math.round(ms), tokens: brain.countTokens(raw), temperature: o.temperature, maxTokens: o.maxTokens, rawLines: raw.split(/\r?\n/).filter((l) => l.trim()).length, expectedLines: n, formKept: !!s?.form.kept, formEarned: s?.form.earned ?? 0, craft: s?.craft ?? 0 });
        return raw;
      },
    });
    const s = score(written.verse);
    plays.push({
      ...slot, card: card.name, acrostic: plan.ctx.acrostic ?? null, relicWords: plan.opponent.relic?.words ?? null, answering: previous ?? null,
      prompt: opponentMessages(plan, card, form, lang, previous).map((m) => m.content),
      verse: written.verse, source: written.source, lines: linesOf(written.verse).length, expectedLines: n,
      formKept: s.form.kept, formEarned: s.form.earned, checks: s.form.checks.map((c) => ({ id: c.id, met: c.met, detail: c.detail })), deviceMet: s.device.met, signatureMet: s.signature.met, craft: s.craft,
      drafts,
    });
  }
  return plays;
}

// --- The run ---
try {
  // Results from an earlier run that reached the repository but not this host's store.
  if (existsSync(REPO_CELLS)) for (const f of readdirSync(REPO_CELLS)) if (f.endsWith('.json') && !existsSync(join(OUT, f))) cpSync(join(REPO_CELLS, f), join(OUT, f));

  log(`dev server on ${ORIGIN}`);
  server = spawn('npx', ['astro', 'dev', '--port', String(PORT), '--host', '127.0.0.1'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' } });
  const serverLog = [];
  for (const s of [server.stdout, server.stderr]) s.on('data', (d) => { serverLog.push(String(d)); if (serverLog.length > 200) serverLog.shift(); });
  server.on('exit', (code) => { if (!cleaned) { console.error(`dev server exited (${code})\n${serverLog.join('').slice(-2000)}`); } });
  await waitFor(`${ORIGIN}/about`, 120000);

  ctx = await chromium.launchPersistentContext(join(DIR, 'browser-profile'), { headless: true, args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal'] });
  const commit = (() => { try { return execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return null; } })();
  const transformers = JSON.parse(readFileSync(join(ROOT, 'node_modules', '@huggingface', 'transformers', 'package.json'), 'utf8')).version;

  // One page per model: each page has its own copy of the game's modules, so each keeps its
  // own model loaded. Only one of them is ever working.
  const pages = {};
  const loaded = {};
  async function pageFor(tier) {
    if (pages[tier]) return pages[tier];
    const page = await ctx.newPage();
    page.on('console', (m) => { const t = m.text(); if (t.startsWith('[meval]') || m.type() === 'error') log(`[${tier}]`, t.slice(0, 300)); });
    page.on('pageerror', (e) => log(`[${tier}] pageerror`, e.message.slice(0, 300)));
    // The battle page first: it makes the dev server prepare the model library, which reloads the page once.
    await page.goto(`${ORIGIN}/battle?brain=rules`, { waitUntil: 'load' });
    await page.waitForTimeout(3000);
    let info;
    for (let attempt = 0; ; attempt++) {
      try {
        await page.goto(`${ORIGIN}/about`, { waitUntil: 'load' });
        if (!(await page.evaluate(async () => !!(await navigator.gpu?.requestAdapter())))) throw new Error('this browser has no WebGPU adapter');
        info = await page.evaluate(pageLoad, tier);
        break;
      } catch (err) {
        // The dev server reloads the page when it finishes preparing a dependency; try again on the new page.
        if (attempt >= 3 || !/context was destroyed|navigation|Failed to fetch dynamically imported/i.test(String(err))) throw err;
        log(`[${tier}] page reloaded while loading (${String(err).slice(0, 120)}); again`);
        await page.waitForTimeout(3000);
      }
    }
    if (!info.ok || info.tier !== tier) throw new Error(`asked for ${tier}, but ${info.tier ?? 'no model'} loaded: its cells would be mislabelled`);
    log(`[${tier}] ${info.id} (${info.dtype}) loaded in ${Math.round(info.loadMs / 1000)}s`);
    loaded[tier] = info;
    pages[tier] = page;
    return page;
  }

  const meta = (tier, lang, task) => ({
    tier, lang, task, model: loaded[tier].id, dtype: loaded[tier].dtype, judgeMethod: loaded[tier].judge,
    date: new Date().toISOString(), commit, transformers, gpu: loaded[tier].gpu, userAgent: loaded[tier].userAgent, origin: ORIGIN,
  });
  const readJson = (...p) => JSON.parse(readFileSync(join(ROOT, 'docs', 'language', 'model-eval', ...p), 'utf8'));
  const overBudget = () => MINUTES > 0 && (Date.now() - started) / 60000 > MINUTES;

  if (CONTROL === 'same') {
    mkdirSync(join(OUT, 'control'), { recursive: true });
    for (const tier of TIERS) for (const lang of LANGS) {
      const page = await pageFor(tier);
      const pairs = await page.evaluate(pageJudge, { lang, pairs: readJson('pairs', `${lang}.json`).pairs, same: true });
      writeFileSync(join(OUT, 'control', `same.${tier}.${lang}.judge.json`), JSON.stringify({ ...meta(tier, lang, 'judge'), control: 'both verses of every pair are the same text', pairs }, null, 1) + '\n');
      log(`control same ${tier} ${lang}: ${pairs.flatMap((p) => Object.values(p.criteria)).filter((v) => v !== 'split').length} of ${pairs.length * 4} criteria were not a split`);
    }
  } else {
    let stopped = false;
    outer: for (const lang of LANGS) {
      for (const tier of TIERS) for (const task of TASKS) {
        const file = join(OUT, `${tier}.${lang}.${task}.json`);
        if (existsSync(file)) continue;
        if (overBudget()) { stopped = true; break outer; }
        const page = await pageFor(tier);
        const t0 = Date.now();
        let cell;
        if (task === 'judge') {
          const pairs = await page.evaluate(pageJudge, { lang, pairs: readJson('pairs', `${lang}.json`).pairs, same: false });
          cell = { ...meta(tier, lang, task), pairs };
        } else {
          const { forms, slots } = await page.evaluate(pagePlan, { lang, perForm: PER_FORM });
          const replies = readJson('corpus', `${lang}.json`).excerpts.map((e) => e.text);
          const plays = await page.evaluate(pageWrite, { lang, slots, replies });
          cell = { ...meta(tier, lang, task), forms, perForm: PER_FORM, plays };
        }
        cell.seconds = Math.round((Date.now() - t0) / 1000);
        // Written under another name first: a cell file that exists is a finished cell.
        writeFileSync(`${file}.part`, JSON.stringify(cell, null, 1) + '\n');
        cpSync(`${file}.part`, file);
        rmSync(`${file}.part`);
        log(`${tier} ${lang} ${task}: ${cell.seconds}s` + (task === 'judge'
          ? `, ${cell.pairs.filter((p) => (p.betterIsPlayer ? p.player > p.opponent : p.opponent > p.player)).length}/${cell.pairs.length} pairs to the better verse`
          : `, ${cell.plays.filter((p) => p.formKept).length}/${cell.plays.length} plays kept the form`));
        syncToRepo();
      }
    }
    log(stopped ? `stopped at the ${MINUTES}-minute budget; run again to continue` : 'every requested cell is done');
  }
  syncToRepo();
} catch (err) {
  console.error('model-eval failed:', err);
  process.exitCode = 1;
} finally {
  await cleanup();
}
