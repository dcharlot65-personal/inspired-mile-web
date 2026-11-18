/**
 * Terminology: one word for a thing within a language.
 *
 * docs/language/glossary.json lists the game's core terms and the platform
 * terms. For each term: a pattern that finds it in the English strings, and per
 * language the accepted forms (stems, so inflected forms pass) with where the
 * term comes from. checkGlossary() reads every string whose English uses the
 * term and reports any whose translation uses none of the accepted forms, and
 * any string that uses a form the glossary rules out for that language.
 *
 * It also holds the names of the verse forms and devices: each must be exactly
 * the name the glossary records for the language (taken from that language's
 * Wikipedia through Wikidata where an article exists).
 */
const strip = (s) => s.replace(/\{[a-zA-Z_]+, plural,/g, ' ').replace(/\{[a-zA-Z_]+\}/g, ' ');

export function checkGlossary(lang, strings, english, glossary) {
  const problems = [];
  if (lang === 'en') return problems;
  for (const [id, term] of Object.entries(glossary.terms ?? {})) {
    const entry = term.langs?.[lang];
    if (!entry) {
      problems.push({ lang, key: `(${id})`, rule: 'glossary-missing', detail: `the glossary has no ${lang} entry for "${id}"` });
      continue;
    }
    const re = new RegExp(term.match, 'i');
    const accept = [entry.term, ...(entry.accept ?? [])].map((a) => a.toLocaleLowerCase(lang));
    for (const [key, source] of Object.entries(english)) {
      if (!re.test(strip(source))) continue;
      if (term.only ? !term.only.includes(key) : term.skip?.includes(key) || entry.skip?.includes(key)) continue;
      const text = strip(strings[key] ?? '').toLocaleLowerCase(lang);
      if (!accept.some((a) => text.includes(a))) problems.push({ lang, key, rule: 'glossary', detail: `"${id}" should be ${entry.term}${entry.accept?.length ? ` (${entry.accept.join(', ')})` : ''}: ${strings[key]}` });
    }
    for (const no of entry.forbid ?? []) {
      const n = no.toLocaleLowerCase(lang);
      for (const [key, value] of Object.entries(strings)) if (strip(value).toLocaleLowerCase(lang).includes(n)) problems.push({ lang, key, rule: 'glossary-forbidden', detail: `"${no}" is not this game's word for "${id}" (${entry.term}): ${value}` });
    }
  }
  for (const [key, name] of Object.entries(glossary.names ?? {})) {
    const want = name.langs?.[lang]?.value;
    if (want === undefined) problems.push({ lang, key, rule: 'glossary-missing', detail: `the glossary has no ${lang} name for ${key}` });
    else if (strings[key] !== want) problems.push({ lang, key, rule: 'glossary-name', detail: `is "${strings[key]}", the glossary says "${want}" (${name.langs[lang].source})` });
  }
  return problems;
}

/**
 * Evidence. A glossary entry's `source` is prose for people; its `cite` list is what a machine checks.
 * Each cite names one fact in a fetched file under docs/language/sources/, for the entry's language
 * unless it gives its own `lang`:
 *
 *   { aosp: <string id>, text }            Android's string, exactly    (aosp-terms.json); with
 *                                          within: true, a phrase inside that string
 *   { dictionary: <English word>, text }   a word in English Wiktionary's tables for that word, exactly
 *                                          (wiktionary-words.json)
 *   { gloss: <word>, text }                an English gloss in that word's own Wiktionary entry (wiktionary-words.json)
 *   { mozilla: <string id>, text }         Firefox's string, exactly    (mozilla-terms.json)
 *   { google: <page>, text }               a Google Help page's title or heading, exactly (google-help.json)
 *   { apple: true, text }                  a word in Apple's passkey article: in its first sentence or in the
 *                                          sentence kept for that term (apple-passkeys.json)
 *   { wikipedia: <wiki>, title, qid }      the <wiki>.wikipedia article titled exactly so is item qid
 *                                          (a sitelink in wikidata-terms.json or wikidata-names.json, or the
 *                                          reverse lookup of the title in wikidata-titles.json)
 *   { wikidata: label|alias, qid, text }   item qid's label or one of its aliases, up to letter case
 *   { wiktionary: <page>, sense?, text }   a word in English Wiktionary's translation table on that page
 *                                          (under that sense), exactly (wiktionary-translations.json)
 *
 * Until 2026-11-16 the evidence was parsed out of the prose, and the patterns skipped what they did not
 * expect: titles with a parenthesis or a comma, every Wiktionary citation, and any quotation not in one
 * of three shapes, while matching the rest by substring. Now prose that names a source must come with
 * cites (checkCitations reports an entry whose `source` mentions Wikipedia, Wiktionary, Wikidata, a
 * vendor or a sources/ file and has none), and every cite is matched exactly.
 *
 * `sources` maps a file's base name (aosp-terms, google-help, …) to its parsed JSON.
 */
const MENTION = /Wikipedia|Wiktionary|Wikidata|Android|AOSP|Mozilla|Firefox|Google|Apple|sources\//;
const fold = (s, lang) => String(s ?? '').normalize('NFC').toLocaleLowerCase(lang);
// A Wikipedia title's disambiguator, "Terzett (Verslehre)" -> "Terzett", and the Arabic article al-.
const bare = (s, lang) => {
  const t = fold(s, lang).replace(/ \([^)]*\)$/, '').trim();
  return lang === 'ar' ? t.replace(/^ال/, '') : t;
};

function items(sources) {
  const out = [];
  for (const c of Object.values(sources['wikidata-terms']?.concepts ?? {})) out.push(c);
  for (const c of Object.values(sources['wikidata-names']?.names ?? {})) out.push(c);
  return out;
}

/** Is this cite true of the fetched files? Returns null when it is, or what is wrong. */
export function verifyCite(cite, lang, sources) {
  const l = cite.lang ?? lang;
  const need = (file) => (sources[file] === undefined ? `cites sources/${file}.json, which is not there` : null);
  if ('aosp' in cite) {
    const got = sources['aosp-terms']?.terms?.[cite.aosp]?.text?.[l];
    const ok = cite.within ? typeof got === 'string' && got.includes(cite.text) : got === cite.text;
    return need('aosp-terms') ?? (ok ? null : `Android's ${cite.aosp} in ${l} is “${got ?? 'not fetched'}”, ${cite.within ? 'which does not contain' : 'not'} “${cite.text}”`);
  }
  if ('mozilla' in cite) {
    const got = sources['mozilla-terms']?.terms?.[cite.mozilla]?.text?.[l];
    return need('mozilla-terms') ?? (got === cite.text ? null : `Firefox's ${cite.mozilla} in ${l} is “${got ?? 'not fetched'}”, not “${cite.text}”`);
  }
  if ('google' in cite) {
    const got = sources['google-help']?.pages?.[cite.google]?.text?.[l];
    return need('google-help') ?? (got && (got.title === cite.text || got.heading === cite.text) ? null : `Google's ${cite.google} page in ${l} has title “${got?.title ?? 'not fetched'}” and heading “${got?.heading ?? 'not fetched'}”, neither of which is “${cite.text}”`);
  }
  if ('apple' in cite) {
    const page = sources['apple-passkeys']?.pages?.[l];
    const kept = [page?.firstSentence, ...Object.values(page?.termSentences ?? {})].filter(Boolean);
    return need('apple-passkeys') ?? (kept.some((x) => x.includes(cite.text)) ? null : `no sentence kept from Apple's ${l} passkey article contains “${cite.text}” (kept: “${kept.join('” “') || 'nothing'}”)`);
  }
  if ('wikipedia' in cite) {
    const w = cite.wikipedia;
    const link = items(sources).find((c) => c.qid === cite.qid && c.langs?.[w]?.sitelink === cite.title);
    // A sitelink badged as a link to a redirect is a title that leads to another article (it.wikipedia's
    // Rima interna leads to Rima), not an article of that name.
    if (link?.langs[w].redirect) return `the ${w} Wikipedia title “${cite.title}” of ${cite.qid} is a redirect (Wikidata badges the sitelink so), not an article`;
    const reverse = sources['wikidata-titles']?.languages?.[w]?.[cite.title]?.qid === cite.qid;
    return link || reverse ? null : `the ${w} Wikipedia article “${cite.title}” is not recorded as ${cite.qid} in the fetched Wikidata files`;
  }
  if ('wikidata' in cite) {
    const found = items(sources).filter((c) => c.qid === cite.qid);
    if (!found.length) return `${cite.qid} is not in the fetched Wikidata files`;
    const ok = found.some((c) => {
      const x = c.langs?.[l];
      if (!x) return false;
      return cite.wikidata === 'label' ? fold(x.label, l) === fold(cite.text, l) : (x.aliases ?? []).some((a) => fold(a, l) === fold(cite.text, l));
    });
    return ok ? null : `${cite.qid} has no ${l} ${cite.wikidata} “${cite.text}”`;
  }
  if ('dictionary' in cite) {
    const page = sources['wiktionary-words']?.words?.[cite.dictionary];
    if (!page) return need('wiktionary-words') ?? `Wiktionary's “${cite.dictionary}” was not fetched`;
    return (page.tables ?? []).some((t) => (t.langs?.[l] ?? []).includes(cite.text)) ? null : `Wiktionary's “${cite.dictionary}” gives ${l} ${JSON.stringify([...new Set((page.tables ?? []).flatMap((t) => t.langs?.[l] ?? []))])}, not “${cite.text}”`;
  }
  if ('gloss' in cite) {
    const lines = sources['wiktionary-words']?.glosses?.[l]?.[cite.gloss];
    if (!lines) return need('wiktionary-words') ?? `Wiktionary's own entry for ${l} “${cite.gloss}” was not fetched`;
    return lines.some((x) => x.includes(cite.text)) ? null : `Wiktionary's entry for ${l} “${cite.gloss}” glosses it ${JSON.stringify(lines.slice(0, 4))}, not “${cite.text}”`;
  }
  if ('wiktionary' in cite) {
    const page = sources['wiktionary-translations']?.concepts?.[cite.wiktionary];
    if (!page) return need('wiktionary-translations') ?? `Wiktionary's page “${cite.wiktionary}” was not fetched`;
    const tables = (page.tables ?? []).filter((t) => cite.sense === undefined || t.sense === cite.sense);
    if (!tables.length) return `Wiktionary's “${cite.wiktionary}” has no table for the sense “${cite.sense}”`;
    return tables.some((t) => (t.langs?.[l] ?? []).includes(cite.text)) ? null : `Wiktionary's “${cite.wiktionary}” table${cite.sense ? ` (${cite.sense})` : ''} gives ${l} ${JSON.stringify(tables.flatMap((t) => t.langs?.[l] ?? []))}, not “${cite.text}”`;
  }
  return `a cite of no known kind: ${JSON.stringify(cite)}`;
}

/** The text a cite vouches for: the article title, the label or alias, the vendor's string. */
const citedText = (c) => c.title ?? c.text;

/**
 * Is a cite about the form's own item? A Wikipedia title or a Wikidata label or alias must be of the
 * item glossary.json gives the form (`wikidata`), and a Wiktionary table must be on the page of the
 * form's English word (`concept`, or `wiktionary` where the page has another name). Until 2026-11-17
 * any confirmed cite that spelled the name would do: the Arabic acrostic was 'sourced' by the article
 * تطريز (شعر), which is another item (Q40376349) and defines another figure, and a name cited to the
 * haiku article would have passed as the acrostic's.
 */
export function aboutItem(cite, item) {
  if ('wikipedia' in cite || 'wikidata' in cite) return cite.qid === item.wikidata;
  if ('wiktionary' in cite) return cite.wiktionary === (item.wiktionary ?? item.concept);
  return false;
}

/** The item's own label and article title in a language, from the fetched Wikidata files. */
function ownNames(item, lang, sources) {
  const c = items(sources).find((x) => x.qid === item.wikidata)?.langs?.[lang];
  return [c?.label, c?.redirect ? null : c?.sitelink].filter(Boolean);
}

export const NAME_STATUSES = ['sourced', 'head', 'own-name', 'not-sourced'];

/**
 * Where each form name comes from, as glossary.json records it in `status`:
 *   sourced      the name is an article title, a Wikidata label or alias, or a Wiktionary translation in
 *                this language (`cited` gives the source's spelling when the game's differs, e.g. simplified
 *                characters or the Arabic article al-);
 *   head         its head word is sourced (`head`) and the words added for the rhyme pattern are the translator's;
 *   own-name     the form's own name, as other languages' Wikipedias title it (Jueju, Lục bát);
 *   not-sourced  the translator's name: no article or dictionary entry in this language names the form.
 * The prose says "Not sourced" exactly when the status is not-sourced, and a status that claims a source
 * must be backed by a cite that the files confirm, that gives that very name, and that is about the
 * form's own item (aboutItem). A cite about another item may stay as context; it backs nothing.
 * A name backed only by a Wikidata alias, where the item has a label or an article in the language,
 * must say in `aliasNote` why the label was not used: the Arabic alliteration was the alias
 * الجناس الاستهلالي, which the item's own article (سجع ابتدائي) says names the acrostic.
 */
function checkNames(glossary, sources, problems) {
  for (const [id, item] of Object.entries(glossary.names ?? {})) {
    for (const [lang, e] of Object.entries(item.langs ?? {})) {
      const key = `names:${id}`;
      const say = (rule, detail) => problems.push({ lang, key, rule, detail });
      if (!NAME_STATUSES.includes(e.status)) {
        say('name-status', `status “${e.status}” is not one of ${NAME_STATUSES.join(', ')}`);
        continue;
      }
      const saysNot = /Not sourced/.test(e.source ?? '');
      if (saysNot !== (e.status === 'not-sourced')) say('name-status', `status ${e.status}, but the prose ${saysNot ? 'says' : 'does not say'} “Not sourced”: ${e.source}`);
      const confirmed = (e.cite ?? []).filter((c) => !verifyCite(c, lang, sources));
      const good = confirmed.filter((c) => aboutItem(c, item));
      // A cite that spells the name but is about another item: say which, since that is how a name gets misread as sourced.
      const elsewhere = (want, l) => confirmed.filter((c) => !aboutItem(c, item) && (c.lang ?? lang) === l && bare(citedText(c), l) === want).map((c) => c.qid ?? `Wiktionary “${c.wiktionary}”`);
      const unbacked = (what, want, l = lang) => {
        const other = elsewhere(bare(want, l), l);
        say('name-unbacked', `marked ${what}, but no confirmed ${l} cite about the form's item (${item.wikidata}) gives “${want}”${other.length ? `; the cite that gives it is about ${other.join(', ')}` : ''}`);
      };
      const aliasOnly = (want) => {
        const backing = good.filter((c) => (c.lang ?? lang) === lang && bare(citedText(c), lang) === bare(want, lang));
        if (backing.length && backing.every((c) => c.wikidata === 'alias') && !e.aliasNote) {
          const own = ownNames(item, lang, sources);
          if (own.length) say('name-alias', `“${want}” is only a Wikidata alias of ${item.wikidata}, whose ${lang} label or article is “${own.join('”, “')}”; say why the alias is used (aliasNote)`);
        }
      };
      if (e.status === 'sourced') {
        const want = e.cited ?? e.value;
        if (!good.some((c) => (c.lang ?? lang) === lang && bare(citedText(c), lang) === bare(want, lang))) unbacked('sourced', want);
        else aliasOnly(want);
        if (e.cited && bare(e.cited, lang) !== bare(e.value, lang) && !e.citedNote) say('name-unbacked', `cites “${e.cited}” for “${e.value}” without saying how one becomes the other (citedNote)`);
      } else if (e.status === 'head') {
        if (!e.head || !fold(e.value, lang).includes(fold(e.head, lang))) say('name-unbacked', `marked head-sourced, but its head “${e.head}” is not part of “${e.value}”`);
        else if (!good.some((c) => (c.lang ?? lang) === lang && bare(citedText(c), lang) === bare(e.head, lang))) unbacked('head-sourced', e.head);
        else aliasOnly(e.head);
      } else if (e.status === 'own-name') {
        if (!good.some((c) => c.lang && c.lang !== lang && bare(citedText(c), c.lang) === bare(e.value, c.lang))) say('name-unbacked', `marked as the form's own name, but no confirmed cite about the form's item (${item.wikidata}) in another language gives “${e.value}”`);
      }
    }
  }
}

/** Every cite in the glossary is true of the fetched files; prose that names a source has cites; form names say where they come from. */
export function checkCitations(glossary, sources) {
  const problems = [];
  let count = 0;
  for (const [sect, group] of [['terms', glossary.terms ?? {}], ['names', glossary.names ?? {}]]) {
    for (const [id, item] of Object.entries(group)) {
      for (const [lang, entry] of Object.entries(item.langs ?? {})) {
        const cites = entry.cite ?? [];
        // Prose that begins "Not sourced" claims nothing (it may say what a source lacks).
        if (MENTION.test(entry.source ?? '') && !/^Not sourced/.test(entry.source) && !cites.length) problems.push({ lang, key: `${sect}:${id}`, rule: 'citation-missing', detail: `the prose names a source and the entry cites nothing: ${entry.source}` });
        for (const c of cites) {
          count++;
          const wrong = verifyCite(c, lang, sources);
          if (wrong) problems.push({ lang, key: `${sect}:${id}`, rule: wrong.includes('is not there') ? 'citation-no-file' : 'citation-not-in-source', detail: wrong });
        }
      }
    }
  }
  checkNames(glossary, sources, problems);
  return { problems, count };
}

// ---------- what an exception may say about a form name ----------

const WORD = /[\p{L}\p{M}]+(?:[’'\-][\p{L}\p{M}]+)*/gu;
const tokens = (s, lang) => [...String(s).matchAll(WORD)].map((m) => fold(m[0], lang));

/** 'sourced' | 'not-sourced' | null: what the glossary says about a word of a form name in a language. */
export function nameWordStatus(glossary, lang, word) {
  const w = fold(word, lang);
  let sourced = false;
  let unsourced = false;
  for (const item of Object.values(glossary.names ?? {})) {
    const e = item.langs?.[lang];
    if (!e) continue;
    // Thai is written without spaces: a word Hunspell rejects is a piece of the name.
    const has = (s) => (lang === 'th' ? fold(s, lang).includes(w) : tokens(s, lang).includes(w));
    if (!has(e.value)) continue;
    if (e.status === 'sourced' || e.status === 'own-name') sourced = true;
    else if (e.status === 'head' && has(e.head)) sourced = true;
    else unsourced = true;
  }
  return sourced ? 'sourced' : unsourced ? 'not-sourced' : null;
}

/** How a meaning exception for a form name must begin, by the name's status. */
export const NAME_REASON = {
  sourced: 'Sourced name:',
  head: 'Head word sourced:',
  'own-name': "The form's own name:",
  'not-sourced': 'Not sourced:',
};

// A reason that vouches for a word's provenance, and one that speaks of a form's name at all.
const CLAIMS_SOURCE = /published source|sourced in docs|taken from|from that language's Wikipedia|as glossary\.json records it/i;
const ABOUT_NAME = /verse form|form's name|form name|device's name|glossary\.json, 'names'/i;

/**
 * An exception that excuses a word of a form name, or a flag on a form name, must say what the glossary
 * says about where the name comes from. On 2026-11-16 a blanket reason ("taken from a published source")
 * excused Hunspell's complaints about 짝운, 교차운, 첫말, 영웅시체, 육팔체, جويجو and Шесть-восемь, which
 * the glossary marks as not sourced, and 40 meaning flags on unsourced names were waived as "the name
 * as glossary.json records it". Checks allow/meaning.json, allow/spelling.json and allow/grammar.json.
 */
export function checkNameExceptions(glossary, { meaning = [], spelling = {}, grammar = [] }, langs) {
  const problems = [];
  for (const e of meaning) {
    const e2 = glossary.names?.[e.key]?.langs?.[e.lang];
    if (!e2) continue;
    const want = NAME_REASON[e2.status];
    if (!want || !e.reason.startsWith(want)) problems.push({ lang: e.lang, key: e.key, rule: 'name-reason', detail: `the glossary says ${e2.status}; the reason must begin “${want}”: ${e.reason}` });
  }
  const judge = (lang, word, reason, where) => {
    // Only a reason that speaks of a form's name, or vouches for a source, is about provenance: 행시 is
    // excused as an ordinary Korean word, and a Thai piece such as ค as part of a loanword.
    if (!ABOUT_NAME.test(reason) && !CLAIMS_SOURCE.test(reason)) return;
    const ls = lang === '*' ? langs : [lang];
    const st = ls.map((l) => nameWordStatus(glossary, l, word)).filter(Boolean);
    if (!st.length) return;
    const not = st.includes('not-sourced');
    if (not && (CLAIMS_SOURCE.test(reason) || !/not sourced/i.test(reason))) problems.push({ lang, key: `${where}:${word}`, rule: 'name-reason', detail: `“${word}” is part of a name the glossary marks as not sourced, so the reason must say so (“not sourced”) and claim no source: ${reason}` });
    if (!not && /not sourced/i.test(reason)) problems.push({ lang, key: `${where}:${word}`, rule: 'name-reason', detail: `“${word}” is a sourced name, but the reason says it is not sourced: ${reason}` });
  };
  for (const [lang, words] of Object.entries(spelling)) for (const [word, reason] of Object.entries(words)) judge(lang, word, reason, 'spelling');
  for (const a of grammar) for (const at of a.at === undefined ? [] : [].concat(a.at)) judge(a.lang, at, a.reason, `grammar ${a.rule}`);
  return problems;
}
