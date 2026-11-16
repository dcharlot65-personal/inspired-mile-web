// The "better verse" side of the judging test set: real, public-domain poetry, taken
// from Wikisource and from nowhere else.
//
//   node scripts/model-eval/corpus-fetch.mjs probe <lang> <title>       print a page's lines, numbered
//   node scripts/model-eval/corpus-fetch.mjs build [lang…]              write docs/language/model-eval/corpus/<lang>.json
//
// `build` reads scripts/model-eval/corpus-manifest.json. An entry names a Wikisource page,
// the poet and the poem, and an anchor: the opening words of the first line wanted. The
// lines themselves are never typed here; they are cut from the page as fetched, so an
// anchor that is not on the page fails the build rather than letting remembered text in.
// Every excerpt is stored with its page URL, revision id and the date it was fetched.
//
// Light enough for the dev Mac: it only makes HTTPS requests.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'docs', 'language', 'model-eval', 'corpus');
const UA = 'verse-eval-corpus-fetch/1.0 (automated; fetches a few pages once)';

/**
 * A page as a reader gets it. Ordinary page views are used, not the API: on 2026-11-16
 * the API answered 429 for minutes at a time from this network, while page views, which
 * Wikimedia serves from its cache, did not.
 */
async function getHtml(url) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' } });
    if (res.ok) return res.text();
    if (res.status === 404) throw new Error('no such page');
    if (attempt >= 6 || (res.status !== 429 && res.status < 500)) throw new Error(`${res.status} for ${url}`);
    // Wikimedia says how long to stay away; do as it says.
    const wait = Number(res.headers.get('retry-after')) || 5 * (attempt + 1);
    await new Promise((r) => setTimeout(r, (wait + 1) * 1000));
  }
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decode(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

// Built from code points so that no escape sequence in this file can be rewritten into the character.
const cps = (...c) => c.map((x) => String.fromCodePoint(x)).join('');
const SPACES = /\p{Zs}/gu;
/**
 * Removed from every line: zero-width space, the direction marks, word joiner, BOM, soft hyphen,
 * and the Arabic tatweel (U+0640), which only stretches a word to justify a line of print.
 * Joiners (ZWJ, ZWNJ) are kept: Devanagari uses them. Nothing else in a line is changed.
 */
const INVISIBLE = new RegExp(`[${cps(0x200b, 0x200e, 0x200f, 0x2060, 0xfeff, 0xad, 0x640)}]`, 'g');

/** The lines of text on a rendered page, in order, with the apparatus removed. */
export function htmlToLines(html) {
  let s = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(style|script|sup)\b[\s\S]*?<\/\1>/gi, '')
    // Page numbers, line numbers, edit links and reference marks are not the poem.
    .replace(/<span[^>]*class="[^"]*(pagenum|mw-editsection|ws-pagenum|numeroriga|linenum|reference|noprint)[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|dd|dt|li|h[1-6]|tr|blockquote|span class="line")>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  s = decode(s);
  return s
    .split('\n')
    .map((l) => l.replace(SPACES, ' ').replace(INVISIBLE, '').replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0);
}

const slug = (title) => encodeURIComponent(title.replace(/ /g, '_'));

async function page(lang, title) {
  // CORPUS_CACHE=<dir> keeps each fetched page, so choosing excerpts does not ask Wikisource twice.
  const cacheDir = process.env.CORPUS_CACHE;
  const cacheFile = cacheDir && join(cacheDir, `${lang}-${slug(title)}.html`);
  let html;
  if (cacheFile && existsSync(cacheFile)) html = readFileSync(cacheFile, 'utf8');
  else {
    html = await getHtml(`https://${lang}.wikisource.org/wiki/${slug(title)}`);
    if (cacheFile) { mkdirSync(cacheDir, { recursive: true }); writeFileSync(cacheFile, html); }
  }
  const revid = Number(/"wgRevisionId":(\d+)/.exec(html)?.[1]);
  const name = /"wgPageName":"((?:[^"\\]|\\.)*)"/.exec(html)?.[1];
  if (!revid || !name) throw new Error('the page gave no revision id');
  const real = JSON.parse(`"${name}"`).replace(/_/g, ' ');
  // The text is the parser output; what follows it (categories, footer) is not the page.
  const start = html.search(/<div class="[^"]*mw-parser-output[^"]*"/);
  if (start < 0) throw new Error('no page text');
  const end = [html.indexOf('<div class="printfooter"', start), html.indexOf('<div id="catlinks"', start)].filter((i) => i > 0).sort((x, y) => x - y)[0] ?? html.length;
  return {
    title: real,
    revid,
    lines: htmlToLines(html.slice(start, end)),
    url: `https://${lang}.wikisource.org/wiki/${slug(real)}`,
    permalink: `https://${lang}.wikisource.org/w/index.php?oldid=${revid}`,
  };
}

const norm = (s) => s.normalize('NFC').replace(INVISIBLE, '').replace(/\s+/g, ' ').trim();
/** The lines that can be verse: short, and not the page's furniture. `pick` in the manifest counts these. */
const verseLike = (x) => x.length >= 4 && x.length <= 70 && !/[←→|]|\d{3,}|wiki|Wiki/.test(x);

async function build(only) {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'scripts', 'model-eval', 'corpus-manifest.json'), 'utf8'));
  mkdirSync(OUT, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  let failed = 0;
  for (const [lang, entries] of Object.entries(manifest.languages)) {
    if (only.length && !only.includes(lang)) continue;
    const out = [];
    for (const e of entries) {
      try {
        const p = await page(e.wiki ?? lang, e.title);
        // An entry points at its first line by `anchor` (the line's opening words) or by `pick`
        // (its place among the page's verse-like lines); `offset` then moves on by whole lines.
        const lines = p.lines.map(norm).filter(verseLike);
        let at = e.pick ?? lines.findIndex((l) => l.startsWith(norm(e.anchor)));
        if (at < 0 || at >= lines.length) throw new Error(`anchor not on the page: "${e.anchor ?? e.pick}"`);
        at += e.offset ?? 0;
        const cut = lines.slice(at, at + e.lines);
        if (cut.length !== e.lines) throw new Error(`only ${cut.length} of ${e.lines} lines after the anchor`);
        // Public domain by age: the poet died at least 70 years ago.
        if (!(Number.isFinite(e.died) && e.died <= new Date().getFullYear() - 71)) throw new Error(`no death year 71 or more years back for ${e.poet}`);
        out.push({
          id: `${lang}-${String(out.length + 1).padStart(2, '0')}`,
          poet: e.poet, poem: e.poem, died: e.died,
          text: cut.join('\n'),
          firstLineOnPage: cut[0],
          source: { site: `${e.wiki ?? lang}.wikisource.org`, page: p.title, url: p.url, permalink: p.permalink, revid: p.revid, fetched: today },
        });
        console.log(`ok   ${lang} ${e.poet} — ${e.poem}\n       ${cut.join(' / ')}`);
      } catch (err) {
        failed++;
        console.log(`FAIL ${lang} ${e.title}: ${err.message}`);
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    writeFileSync(join(OUT, `${lang}.json`), JSON.stringify({ lang, licence: manifest.licence, excerpts: out }, null, 1) + '\n');
  }
  if (failed) { console.log(`${failed} entries failed`); process.exit(1); }
}

const [cmd, lang, ...rest] = process.argv.slice(2);
if (cmd === 'never') {
} else if (cmd === 'probe') {
  const max = Number(process.env.LINES ?? 30);
  const from = Number(process.env.FROM ?? 0);
  const p = await page(lang, rest.join(' '));
  console.log(`# ${p.title} rev ${p.revid} (${p.lines.length} lines)`);
  p.lines.slice(from, from + max).forEach((l, i) => console.log(String(from + i).padStart(4), l.slice(0, 110)));
} else if (cmd === 'links') {
  // links <lang> <title>: where a page of versions or a contents page points.
  const html = await getHtml(`https://${lang}.wikisource.org/wiki/${slug(rest.join(' '))}`);
  const seen = new Set();
  for (const m of html.matchAll(/href="\/wiki\/([^"#?]+)"/g)) {
    const t = decodeURIComponent(m[1]).replace(/_/g, ' ');
    if (!/^[^/]*:/.test(t) && !seen.has(t)) { seen.add(t); console.log(t); }
  }
} else if (cmd === 'batch') {
  // batch <file>: lines of "lang|title"; prints the opening lines of each, to choose anchors from.
  const max = Number(process.env.LINES ?? 6);
  for (const row of readFileSync(lang, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))) {
    const [l, t] = row.split('|');
    try {
      const p = await page(l, t);
      // The verse-like lines: short, and not the page's furniture.
      const ls = p.lines.filter(verseLike);
      const from = Number(process.env.FROM ?? 0);
      console.log(`## ${l}|${p.title} (${p.lines.length}/${ls.length}) ` + ls.slice(from, from + max).map((x) => x.slice(0, 44)).join(' / '));
    } catch (err) {
      console.log(`## ${l}|${t} FAIL ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
} else if (cmd === 'build') {
  await build([lang, ...rest].filter(Boolean));
} else if (cmd) {
  console.log('usage: corpus-fetch.mjs probe|batch|build …');
  process.exit(2);
}
