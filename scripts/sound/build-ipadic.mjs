// The Japanese analyser's dictionary as the game ships it: kuromoji 0.1.2's mecab-ipadic 2.7.0
// files, cut down to what the engine reads (src/lib/verse/sound/ja.ts). Writes
// src/lib/verse/sound/ipadic/*.dat.gz.
//
// What changes, and why it cannot change an analysis:
//   - The words are looked up in a sorted list of the dictionary's 390,000-odd surfaces (lex: each
//     written with how much it shares with the one before, and how many entries it has), not in
//     kuromoji's double-array trie (base, check: 7.1 MB packed) and its map from trie node to
//     entries (tid_map: 1.5 MB). ja.ts answers kuromoji's two questions, "which words of the
//     dictionary does this text start with, shortest first" and "which entries has that word, in
//     the dictionary's order", from the list; the entries of a word are stored together, in the
//     order tid_map gave them.
//   - tid_pos held every word's surface, part of speech, conjugation, base form, reading and
//     pronunciation (41.9 MB unpacked, 5.9 MB packed). The engine reads the surface (which ja.ts
//     takes from the text the word was found in: a dictionary word is found by exact match, so the
//     two are the same string), the reading and the pronunciation. The new tid_pos holds
//     "reading,pronunciation" only, each left empty where the engine would read the same without
//     it (no reading, or the reading spells the surface; no pronunciation, or it spells the
//     reading), and each distinct string once. tid's pointers into it are rewritten.
//   - Every file was zero-padded by kuromoji's builder (100 MB unpacked in all). The padding goes:
//     kuromoji's reader answers 0 past the end of a buffer, which is what the padding held.
// The entries' costs and ids, the connection matrix and the unknown-word rules are kuromoji's,
// byte for byte. src/lib/verse/sound/ipadic.test.ts reads text with both dictionaries and
// requires the same words, readings and known flags.
//
//   node scripts/sound/build-ipadic.mjs          (after npm ci; refuses other input files)
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync, constants } from 'node:zlib';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const from = resolve(repo, 'node_modules/kuromoji/dict');
const to = resolve(repo, 'src/lib/verse/sound/ipadic');

// kuromoji 0.1.2 as npm ships it (sha256 of each file).
const PINNED = {
  base: '0803327762e1c93ca731e4319ab8343340f2806bb84941207782cde9d2d5a8eb',
  cc: '02b7631be0d4de3a1a75cd9f9cc51536e4f94c9e6b389b813e06ba0f6e7de765',
  check: '193ae0035fff6fe812b58d9ee730e7a7d7ee601d918481ce51075c58114f6cc9',
  tid: 'd43d831cb6fb0f0a411739cd287a6d5e998e121a8daca614df14a81a0dcac586',
  tid_map: '33efd5ffd87a70f669add093fa39dee44341d58f940844ef107c8fd98bb795b2',
  tid_pos: '60dbfc99a6ab993f30c5dab648bec6ad7f9aaefa5c14e1843837d95e509f8895',
  unk: 'f7f991cdeb9bfd3e9c0e4577cc50ee0815a11c508cccd444a9d3ab3c81521100',
  unk_char: '9a8e86fd9aff32d323fbb59f5a7006f05927a11f8173c90712cc56293aeb3225',
  unk_compat: '50f60aa29bc2e86c2903ab8c825bb6fa604d2b294d96941c1d3924259791899d',
  unk_invoke: '6b210889548457c3006913afd12c8b525562255f2709e404604be9614a25e94c',
  unk_map: '6df12460e5477230bb6fd9641def918b699fc0a8868016b6c9f794488630509b',
  unk_pos: '5b183a29f281acc7e0542beca47b83f7985047c0a2d27e78a66f32276be5ad11',
};

const raw = {};
for (const [name, sha] of Object.entries(PINNED)) {
  const gz = readFileSync(`${from}/${name}.dat.gz`);
  const got = createHash('sha256').update(gz).digest('hex');
  if (got !== sha) throw new Error(`${name}.dat.gz is not kuromoji 0.1.2's (sha256 ${got}); refusing to build from it`);
  raw[name] = new Uint8Array(gunzipSync(gz));
}

const view = (b) => new DataView(b.buffer, b.byteOffset, b.byteLength);
const hira = (t) => t.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

/** A target map (tid_map, unk_map): its exact length, read as kuromoji's loadTargetMap reads it. */
function mapLength(b) {
  const v = view(b);
  const keys = v.getInt32(0, true);
  let p = 4;
  for (let k = 0; k < keys; k++) {
    const n = v.getInt32(p + 4, true);
    p += 8 + 4 * n;
  }
  return { length: p, keys };
}
/** Every token id a target map names. */
function mapIds(b) {
  const v = view(b);
  const keys = v.getInt32(0, true);
  const ids = [];
  let p = 4;
  for (let k = 0; k < keys; k++) {
    const n = v.getInt32(p + 4, true);
    for (let i = 0; i < n; i++) ids.push(v.getInt32(p + 8 + 4 * i, true));
    p += 8 + 4 * n;
  }
  return ids;
}
/** A UTF-8 string kuromoji's ByteBuffer.putString wrote at `at`, up to its terminating zero. */
const decoder = new TextDecoder();
function stringAt(b, at) {
  let e = at;
  while (e < b.length && b[e] !== 0) e++;
  return decoder.decode(b.subarray(at, e));
}

// The words: each trie node's entries (tid_map), and the surface they share (tid_pos field 0).
const entriesOf = new Map();
{
  const v = view(raw.tid_map);
  const keys = v.getInt32(0, true);
  let p = 4;
  for (let k = 0; k < keys; k++) {
    const key = v.getInt32(p, true);
    const n = v.getInt32(p + 4, true);
    const ids = [];
    for (let i = 0; i < n; i++) ids.push(v.getInt32(p + 8 + 4 * i, true));
    entriesOf.set(key, [...(entriesOf.get(key) ?? []), ...ids]);
    p += 8 + 4 * n;
  }
}
const oldTid = view(raw.tid);
const surfaceOf = (id) => stringAt(raw.tid_pos, oldTid.getInt32(id + 6, true)).split(',')[0];
const bySurface = new Map();
for (const ids of entriesOf.values()) {
  const surface = surfaceOf(ids[0]);
  if (ids.some((id) => surfaceOf(id) !== surface)) throw new Error(`a trie node holds two surfaces (${surface})`);
  if (bySurface.has(surface)) throw new Error(`two trie nodes for ${surface}`);
  bySurface.set(surface, ids);
}
// Sorted as JavaScript compares strings (UTF-16 code units), which is how ja.ts searches the list.
const surfaces = [...bySurface.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

// tid: one 10-byte entry per word (left id, right id, cost: int16; pointer into tid_pos: int32),
// a surface's entries together, in the sorted order.
const entries = surfaces.reduce((n, s) => n + bySurface.get(s).length, 0);
const tid = new Uint8Array(entries * 10);
const tv = view(tid);
const strings = new Map();
const parts = [];
let size = 0;
const encoder = new TextEncoder();
const lexLines = [];
let at = 0;
let prev = '';
for (const surface of surfaces) {
  const ids = bySurface.get(surface);
  let shared = 0;
  while (shared < prev.length && shared < surface.length && prev[shared] === surface[shared]) shared++;
  if (shared > 200) throw new Error('a surface shares too much to write');
  lexLines.push(`${String.fromCharCode(48 + shared)}${surface.slice(shared)}\t${ids.length}`);
  prev = surface;
  for (const id of ids) {
    const f = stringAt(raw.tid_pos, oldTid.getInt32(id + 6, true)).split(',');
    const reading = f[8] && f[8] !== '*' ? f[8] : '';
    const pron = f[9] && f[9] !== '*' ? f[9] : '';
    // What ja.ts reads: kana = the reading, else the surface; spoken = the pronunciation, else kana.
    const kana = reading ? hira(reading) : hira(surface);
    const r = reading && hira(reading) !== hira(surface) ? reading : '';
    const p = pron && hira(pron) !== kana ? pron : '';
    const str = r || p ? `${r},${p}` : '';
    let off = strings.get(str);
    if (off === undefined) {
      off = size;
      strings.set(str, off);
      const bytes = encoder.encode(str);
      parts.push(bytes);
      size += bytes.length + 1;
    }
    tid.set(raw.tid.subarray(id, id + 6), at * 10);
    tv.setInt32(at * 10 + 6, off, true);
    at++;
  }
}
const pos = new Uint8Array(size);
{
  let o = 0;
  for (const p of parts) {
    pos.set(p, o);
    o += p.length + 1;
  }
}
const lex = encoder.encode(lexLines.join('\n') + '\n');

const unkEntries = mapIds(raw.unk_map).reduce((m, x) => Math.max(m, x), 0) / 10 + 1;
const out = {
  lex,
  tid,
  tid_pos: pos,
  cc: raw.cc,
  unk: raw.unk.slice(0, unkEntries * 10),
  // Strings read up to their zero: the last one's zero kept.
  unk_pos: raw.unk_pos.slice(0, (() => { let n = raw.unk_pos.length; while (n > 0 && raw.unk_pos[n - 1] === 0) n--; return n + 1; })()),
  unk_map: raw.unk_map.slice(0, mapLength(raw.unk_map).length),
  unk_char: raw.unk_char,
  unk_compat: raw.unk_compat,
  unk_invoke: raw.unk_invoke,
};

mkdirSync(to, { recursive: true });
const report = {};
for (const [name, b] of Object.entries(out)) {
  // Level 9, no file name or time in the header: the same input always gives the same bytes.
  const gz = gzipSync(b, { level: constants.Z_BEST_COMPRESSION });
  writeFileSync(`${to}/${name}.dat.gz`, gz);
  report[name] = { unpacked: b.length, packed: gz.length };
}
const sum = (k) => Object.values(report).reduce((n, r) => n + r[k], 0);
const before = Object.keys(PINNED).reduce((n, f) => n + readFileSync(`${from}/${f}.dat.gz`).length, 0);
console.log(JSON.stringify({ surfaces: surfaces.length, entries, distinctFeatures: strings.size, files: report, packed: sum('packed'), before, unpacked: sum('unpacked') }));
