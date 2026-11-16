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
 * Every word the glossary says it took from a fetched source must be in that source's file.
 *
 * A glossary entry cites its evidence in its `source` text, in one of these forms:
 *   Android (AOSP <module>, <string id>): <text>                       -> sources/aosp-terms.json
 *   <vendor> (sources/<file>.json[, <id>]): <text>                     -> that file
 *   Wikidata label (Q…): <text>, Wikidata alias (Q…): <text>          -> sources/wikidata-names.json
 * The quoted text runs to the next ';', '. ', ' (' or the end; 'a / b' quotes two strings (singular
 * and plural), and only the part before a ', ' is the quotation. A trailing ellipsis is the vendor's.
 * Each quotation must appear, exactly, among the strings of the file it names: on 2026-11-16 four
 * sign-out entries quoted Google's help in Spanish, French, Italian and Arabic while
 * sources/google-help.json held nothing for those languages (the fetch had come back empty).
 *
 * `sources` maps a file's base name (aosp-terms, google-help, …) to its parsed JSON.
 */
const CITATION = /(Android \(AOSP [^)]*\)|\(sources\/([a-z-]+)\.json[^)]*\)|Wikidata (?:label|alias) \(Q\d+\)): ([^;]+?)(?=;|\. |\.$|$| \()/g;

export function checkCitations(glossary, sources) {
  const problems = [];
  const texts = {};
  const textOf = (file) => {
    if (texts[file] === undefined) {
      const out = [];
      const walk = (x) => {
        if (typeof x === 'string') out.push(x);
        else if (x && typeof x === 'object') for (const v of Object.values(x)) walk(v);
      };
      walk(sources[file]);
      texts[file] = sources[file] === undefined ? null : out;
    }
    return texts[file];
  };
  let count = 0;
  for (const [sect, items] of [['terms', glossary.terms ?? {}], ['names', glossary.names ?? {}]]) {
    for (const [id, item] of Object.entries(items)) {
      for (const [lang, entry] of Object.entries(item.langs ?? {})) {
        for (const m of (entry.source ?? '').matchAll(CITATION)) {
          const file = m[1].startsWith('Android') ? 'aosp-terms' : m[2] ?? 'wikidata-names';
          const quoted = m[3].trim().replace(/^'|'$/g, '').replace(/(…|\.\.\.)$/, '');
          for (const part of quoted.split(' / ').map((x) => x.split(', ')[0])) {
            count++;
            const strings = textOf(file);
            if (strings === null) problems.push({ lang, key: `${sect}:${id}`, rule: 'citation-no-file', detail: `cites sources/${file}.json, which is not there` });
            else if (!strings.some((s) => s.includes(part))) problems.push({ lang, key: `${sect}:${id}`, rule: 'citation-not-in-source', detail: `quotes “${part}” from sources/${file}.json, which does not contain it` });
          }
        }
      }
    }
  }
  return { problems, count };
}
