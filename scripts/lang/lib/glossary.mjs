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
