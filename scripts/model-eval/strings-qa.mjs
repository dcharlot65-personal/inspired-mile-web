// The interface strings this evaluation added, checked by tools that did not write them.
//
//   bash scripts/model-eval/strings-qa.sh        (on the build host; it starts what this needs)
//
// The strings (battle.lang.written, battle.lang.rules, brain.noneShown) were written in all
// sixteen languages by the agent that built the evaluation. Here each is put, as the sentence a
// player reads (placeholders filled the way the page fills them), to:
//   - LanguageTool 6.6 (grammar and style; modules for en es fr de it pt pl ru ar zh ja),
//   - Hunspell (spelling; dictionaries for all but zh and ja),
//   - MADLAD-400 3B (back-translation to English, a dedicated translation model), scored
//     against the English by sentence-embedding cosine (all-MiniLM-L6-v2), threshold 0.6.
// The same tools, method and threshold as scripts/lang/ on the lang/qa-pipeline branch; the
// tools are that branch's installation on the build host, used read-only.
//
// Each tool must also show it can fail, in this run: LanguageTool on sentences with a plain
// grammar error, Hunspell on each checked sentence with one word misspelled, and the
// back-translation scored against the wrong English sentence (another key's).
//
//   node strings-qa.mjs prepare <dir>    sentences and back-translation pairs   -> <dir>/pairs.json
//   node strings-qa.mjs check <dir>      LanguageTool + Hunspell (LT_URL, HSPELL, DICT_DIR)
//   node strings-qa.mjs report <dir>     merge <dir>/bt.json         -> docs/language/model-eval/strings-qa.json
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LANGS } from './lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const [step, dir] = process.argv.slice(2);
const KEYS = ['battle.lang.written', 'battle.lang.rules', 'brain.noneShown'];
const MODEL = 'LFM3 1.7B';
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));

// As src/i18n/index.ts languageName(): the CLDR name of a language, in the interface language, capitalised.
const nameOf = (code, ui) => {
  const n = new Intl.DisplayNames([ui], { type: 'language' }).of(code);
  return n.charAt(0).toLocaleUpperCase(ui) + n.slice(1);
};
const fill = (template, ui) => template.replace('{language}', nameOf(ui === 'th' ? 'ja' : 'th', ui)).replace('{model}', MODEL);

// Our code -> LanguageTool's (as scripts/lang/grammar.mjs), and the Hunspell dictionary.
const LT_CODE = { en: 'en-US', es: 'es', fr: 'fr', de: 'de-DE', it: 'it', pt: 'pt-BR', pl: 'pl-PL', ru: 'ru-RU', ar: 'ar', zh: 'zh-CN', ja: 'ja-JP' };
const DICT = { en: 'en', es: 'es', fr: 'fr', de: 'de', it: 'it', pt: 'pt-BR', pl: 'pl', ru: 'ru', ar: 'ar', hi: 'hi', ko: 'ko', vi: 'vi', th: 'th', id: 'id' };
// Sentences with a grammar error a native reader sees at once (from scripts/lang/grammar.mjs).
const KNOWN_BAD = {
  en: ['She go to school every day.', 'They was at home.'], es: ['Los casa es muy grandes.', 'Yo tiene dos gatos.'],
  fr: ['Les maison est très grands.', 'Nous allez au cinéma.'], de: ['Das Häuser ist sehr großen.', 'Wir geht ins Kino.'],
  it: ['Le casa è molto grandi.', 'Loro è andati a casa.'], pt: ['As casa é muito grandes.', 'Nós vai embora.'],
  pl: ['Ten kobieta jest bardzo wysoki.', 'Oni jest w domu.'], ru: ['Он пошла домой.', 'Они был дома.'],
  ar: ['ذهبت الولد إلى المدرسة أمس.', 'هذا السيارة جميلة.'], zh: ['我有三个书。', '我昨天去学校了了。'], ja: ['私は学校に行くました。', 'これはペンをです。'],
};

/** The strings as the locale files hold them: one single-quoted line each (the modules themselves import TypeScript that plain Node cannot resolve). */
async function strings() {
  const out = {};
  for (const lang of LANGS) {
    const src = readFileSync(join(ROOT, 'src', 'i18n', 'locales', `${lang}.ts`), 'utf8');
    out[lang] = Object.fromEntries(KEYS.map((k) => {
      const m = src.match(new RegExp(`^\\s*'${k.replace(/\./g, '\\.')}': '([^'\\n]*)',$`, 'm'));
      if (!m) throw new Error(`${lang}: ${k} is not one single-quoted line`);
      return [k, fill(m[1], lang)];
    }));
  }
  return out;
}

const words = (lang, text) => {
  if (lang === 'th') return [...new Intl.Segmenter('th', { granularity: 'word' }).segment(text)].filter((s) => s.isWordLike && /\p{Script=Thai}/u.test(s.segment)).map((s) => s.segment);
  return [...text.matchAll(/[\p{L}\p{M}]+(?:[’'\-][\p{L}\p{M}]+)*/gu)].map((m) => (lang === 'ar' ? m[0].replace(/[ً-ْٰـ]/g, '') : m[0].replace(/’/g, "'")));
};
/** One word misspelled: the longest word's two middle letters swapped (or a letter doubled where they are the same). */
function misspell(lang, text) {
  const ws = words(lang, text).filter((w) => !/^(LFM|Thai|th)$/i.test(w)).sort((a, b) => [...b].length - [...a].length);
  const w = ws[0];
  const ch = [...w];
  const i = Math.floor(ch.length / 2) - 1;
  const bad = ch[i] === ch[i + 1] ? [...ch.slice(0, i + 1), ch[i], ...ch.slice(i + 1)].join('') : [...ch.slice(0, i), ch[i + 1], ch[i], ...ch.slice(i + 2)].join('');
  return { word: w, bad };
}
function rejected(lang, list) {
  const r = spawnSync(process.env.HSPELL, [`${process.env.DICT_DIR}/${DICT[lang]}.aff`, `${process.env.DICT_DIR}/${DICT[lang]}.dic`], { input: list.join('\n') + '\n', encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`hspell ${lang}: ${r.stderr}`);
  return new Set(r.stdout.split('\n').filter(Boolean));
}
async function lt(code, text) {
  const r = await fetch(`${process.env.LT_URL}/v2/check`, { method: 'POST', body: new URLSearchParams({ language: code, text, level: 'picky' }) });
  if (!r.ok) throw new Error(`LanguageTool ${code}: ${r.status}`);
  return (await r.json()).matches.map((m) => ({ rule: m.rule.id, message: m.message, at: text.slice(m.offset, m.offset + m.length), replacements: m.replacements.slice(0, 3).map((x) => x.value) }));
}

if (step === 'prepare') {
  const s = await strings();
  const pairs = [];
  for (const lang of LANGS.filter((l) => l !== 'en')) KEYS.forEach((k, i) => {
    pairs.push({ id: `${lang}:${k}`, lang, text: s[lang][k], english: s.en[k] });
    // The control: the same sentence against another key's English. It must score lower.
    pairs.push({ id: `${lang}:${k}:control`, lang, text: s[lang][k], english: s.en[KEYS[(i + 1) % KEYS.length]] });
  });
  writeFileSync(join(dir, 'strings.json'), JSON.stringify(s, null, 1));
  writeFileSync(join(dir, 'pairs.json'), JSON.stringify(pairs, null, 1));
  console.log(`${pairs.length} pairs`);
} else if (step === 'check') {
  const s = read(join(dir, 'strings.json'));
  const languages = (await (await fetch(`${process.env.LT_URL}/v2/languages`)).json()).map((l) => l.longCode);
  const out = {};
  for (const lang of LANGS) {
    const row = (out[lang] = { languagetool: null, hunspell: null });
    if (LT_CODE[lang] && languages.includes(LT_CODE[lang])) {
      const hits = Object.fromEntries(await Promise.all(KEYS.map(async (k) => [k, await lt(LT_CODE[lang], s[lang][k])])));
      const control = await Promise.all((KNOWN_BAD[lang] ?? []).map(async (t) => ({ text: t, flagged: (await lt(LT_CODE[lang], t)).length > 0 })));
      row.languagetool = { code: LT_CODE[lang], hits, control, controlFlagged: control.filter((c) => c.flagged).length };
    }
    if (DICT[lang]) {
      const hits = {};
      const control = {};
      for (const k of KEYS) {
        const ws = [...new Set(words(lang, s[lang][k]))];
        const bad = rejected(lang, ws);
        hits[k] = [...bad];
        const m = misspell(lang, s[lang][k]);
        control[k] = { word: m.word, misspelled: m.bad, rejected: rejected(lang, [m.bad]).has(m.bad) };
      }
      row.hunspell = { dictionary: DICT[lang], hits, control, controlRejected: Object.values(control).filter((c) => c.rejected).length };
    }
  }
  writeFileSync(join(dir, 'grammar.json'), JSON.stringify(out, null, 1));
  for (const [lang, r] of Object.entries(out)) console.log(lang, 'LT', r.languagetool ? `${Object.values(r.languagetool.hits).flat().length} hits, control ${r.languagetool.controlFlagged}/${r.languagetool.control.length}` : 'none', '| Hunspell', r.hunspell ? `${Object.values(r.hunspell.hits).flat().join(' ') || 'no'} rejected, control ${r.hunspell.controlRejected}/3` : 'none');
} else if (step === 'report') {
  const s = read(join(dir, 'strings.json'));
  const grammar = read(join(dir, 'grammar.json'));
  const bt = read(join(dir, 'bt.json'));
  const T = 0.6;
  const meaning = {};
  for (const lang of LANGS.filter((l) => l !== 'en')) meaning[lang] = Object.fromEntries(KEYS.map((k) => {
    const right = bt.find((p) => p.id === `${lang}:${k}`);
    const wrong = bt.find((p) => p.id === `${lang}:${k}:control`);
    return [k, { back: right.back, cos: right.cos, chrf: right.chrf, controlCos: wrong.cos, flagged: right.cos < T }];
  }));
  const report = {
    note: 'The three interface strings the model evaluation added, checked by tools that did not write them. Written by scripts/model-eval/strings-qa.mjs. A flag is a question for a reader of the language, not a verdict.',
    tools: {
      languagetool: 'LanguageTool 6.6 (LGPL-2.1), HTTP server on the build host, level picky',
      hunspell: 'Hunspell 1.7 library through scripts/lang/hspell.cpp, dictionaries in the lang/qa-pipeline installation (see docs/language there for each dictionary\'s source and licence)',
      backTranslation: 'google/madlad400-3b-mt (Apache-2.0) as CTranslate2 int8 (Nextcloud-AI/madlad400-3b-mt-ct2-int8), beam 4; cosine of sentence-transformers/all-MiniLM-L6-v2 (Apache-2.0) embeddings; threshold 0.6',
    },
    date: new Date().toISOString().slice(0, 10),
    model: MODEL,
    sentences: s,
    grammar,
    meaning,
  };
  writeFileSync(join(ROOT, 'docs', 'language', 'model-eval', 'strings-qa.json'), JSON.stringify(report, null, 1) + '\n');
  for (const [lang, m] of Object.entries(meaning)) console.log(lang, Object.entries(m).map(([k, v]) => `${k.split('.').pop()} ${v.cos.toFixed(2)} (control ${v.controlCos.toFixed(2)})${v.flagged ? ' FLAG' : ''}`).join(' | '));
}
