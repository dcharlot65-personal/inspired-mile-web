/**
 * A message the engine wants shown: a stable key and its variables, never a
 * sentence. The page turns it into text in the player's language with t();
 * ./english.ts turns it into English for the prompt sent to the model.
 *
 * Templates are written in a subset of ICU MessageFormat, the syntax every
 * translation tool reads:
 *
 *   {name}                                       a value
 *   {n, plural, one {# line} other {# lines}}    a count: the form is chosen by
 *                                                the language's plural rule
 *                                                (Intl.PluralRules, i.e. CLDR),
 *                                                `#` is the number
 *   {n, plural, =0 {none} one {...} other {...}} an exact number wins over a category
 *
 * A number is written the way the language writes numbers (Intl.NumberFormat);
 * a list of words the way it writes lists (Intl.ListFormat). Deliberately not
 * supported: ICU's apostrophe quoting (our text is full of apostrophes that
 * mean nothing but themselves), `select`, and `selectordinal`.
 */
export type MsgValue = string | number | readonly string[];

export interface Msg {
  key: string;
  vars?: Record<string, MsgValue>;
}

export function msg(key: string, vars?: Msg['vars']): Msg {
  return vars ? { key, vars } : { key };
}

/** The CLDR plural categories, in CLDR's order. */
export const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'] as const;
export type PluralCategory = (typeof PLURAL_CATEGORIES)[number];

/** One piece of a parsed template. */
export type Part =
  | { type: 'text'; value: string }
  | { type: 'arg'; name: string }
  | { type: 'pound' }
  | { type: 'plural'; name: string; options: Record<string, Part[]> };

/** What is wrong with a template, with where; thrown by parseMessage and reported by the locale tests. */
export class MessageSyntaxError extends Error {}

const NAME = /^[a-zA-Z_]+$/;

/**
 * Parse a template. Throws MessageSyntaxError on a brace that does not close,
 * an unknown argument type, or a plural with no `other`.
 */
export function parseMessage(template: string): Part[] {
  let i = 0;
  const fail = (what: string): never => {
    throw new MessageSyntaxError(`${what} at ${i} in "${template}"`);
  };

  function parts(inPlural: boolean, nested: boolean): Part[] {
    const out: Part[] = [];
    let text = '';
    const flush = () => {
      if (text) out.push({ type: 'text', value: text });
      text = '';
    };
    while (i < template.length) {
      const c = template[i];
      if (c === '}') {
        if (!nested) fail('unmatched }');
        break;
      }
      if (c === '#' && inPlural) {
        flush();
        out.push({ type: 'pound' });
        i++;
      } else if (c === '{') {
        flush();
        out.push(argument());
      } else {
        text += c;
        i++;
      }
    }
    flush();
    return out;
  }

  function argument(): Part {
    i++; // {
    const close = template.indexOf('}', i);
    const comma = template.indexOf(',', i);
    if (close < 0) fail('unclosed {');
    if (comma < 0 || comma > close) {
      const name = template.slice(i, close).trim();
      if (!NAME.test(name)) fail(`bad placeholder name "${name}"`);
      i = close + 1;
      return { type: 'arg', name };
    }
    const name = template.slice(i, comma).trim();
    if (!NAME.test(name)) fail(`bad placeholder name "${name}"`);
    i = comma + 1;
    const comma2 = template.indexOf(',', i);
    if (comma2 < 0) fail('argument type without options');
    const kind = template.slice(i, comma2).trim();
    if (kind !== 'plural') fail(`unsupported argument type "${kind}"`);
    i = comma2 + 1;
    const options: Record<string, Part[]> = {};
    for (;;) {
      while (i < template.length && /\s/.test(template[i])) i++;
      if (i >= template.length) fail('unclosed plural');
      if (template[i] === '}') {
        i++;
        break;
      }
      const open = template.indexOf('{', i);
      if (open < 0) fail('plural option without {');
      const selector = template.slice(i, open).trim();
      if (!/^(=\d+|zero|one|two|few|many|other)$/.test(selector)) fail(`bad plural selector "${selector}"`);
      if (selector in options) fail(`plural selector "${selector}" given twice`);
      i = open + 1;
      options[selector] = parts(true, true);
      if (template[i] !== '}') fail('unclosed plural option');
      i++;
    }
    if (!('other' in options)) fail('plural without "other"');
    return { type: 'plural', name, options };
  }

  const out = parts(false, false);
  if (i < template.length) fail('unmatched }');
  return out;
}

const parsed = new Map<string, Part[] | null>();
function cachedParse(template: string): Part[] | null {
  let p = parsed.get(template);
  if (p === undefined) {
    try {
      p = parseMessage(template);
    } catch {
      p = null; // shown as written rather than breaking the page; the locale tests refuse such a template
    }
    parsed.set(template, p);
  }
  return p;
}

const numberFormats = new Map<string, Intl.NumberFormat>();
const pluralRules = new Map<string, Intl.PluralRules>();
const listFormats = new Map<string, Intl.ListFormat>();

/** A number as the language writes it: grouping, decimal mark and digits from CLDR. */
export function formatNumber(n: number, locale = 'en'): string {
  let f = numberFormats.get(locale);
  if (!f) numberFormats.set(locale, (f = new Intl.NumberFormat(locale)));
  return f.format(n);
}

/** The CLDR plural category of a number in a language. */
export function pluralCategory(n: number, locale = 'en'): PluralCategory {
  let r = pluralRules.get(locale);
  if (!r) pluralRules.set(locale, (r = new Intl.PluralRules(locale)));
  return r.select(n) as PluralCategory;
}

/** Words joined as the language joins a list ("a, b, and c"; "a、b、c"). */
export function formatList(items: readonly string[], locale = 'en'): string {
  let f = listFormats.get(locale);
  if (!f) listFormats.set(locale, (f = new Intl.ListFormat(locale, { type: 'conjunction', style: 'long' })));
  return f.format(items);
}

function value(v: MsgValue, locale: string): string {
  if (typeof v === 'number') return formatNumber(v, locale);
  if (typeof v === 'string') return v;
  return formatList(v, locale);
}

function render(parts: Part[], vars: Record<string, MsgValue>, locale: string, pound: string | null): string {
  let out = '';
  for (const p of parts) {
    if (p.type === 'text') out += p.value;
    else if (p.type === 'pound') out += pound ?? '#';
    else if (p.type === 'arg') out += p.name in vars ? value(vars[p.name], locale) : `{${p.name}}`;
    else {
      const raw = vars[p.name];
      const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
      if (Number.isNaN(n)) {
        // No number to choose a form by: show the general form with the name still visible, so a test sees it.
        out += render(p.options.other, vars, locale, `{${p.name}}`);
      } else {
        const chosen = p.options[`=${n}`] ?? p.options[pluralCategory(n, locale)] ?? p.options.other;
        out += render(chosen, vars, locale, formatNumber(n, locale));
      }
    }
  }
  return out;
}

/**
 * Fill a template in a language. An unknown name is left as written, so a
 * missing variable shows in tests. `locale` decides the plural form, the
 * number format and the list format; English when not given (the engine's
 * prompt to the model is always English).
 */
export function interpolate(template: string, vars?: Msg['vars'], locale = 'en'): string {
  if (!vars && !template.includes(', plural,')) return template;
  const p = cachedParse(template);
  if (!p) return template;
  return render(p, vars ?? {}, locale, null);
}

/** Every argument name a template uses, once each, sorted; throws MessageSyntaxError on a malformed template. */
export function argumentNames(template: string): string[] {
  const names = new Set<string>();
  const walk = (ps: Part[]) => {
    for (const p of ps) {
      if (p.type === 'arg') names.add(p.name);
      else if (p.type === 'plural') {
        names.add(p.name);
        for (const o of Object.values(p.options)) walk(o);
      }
    }
  };
  walk(parseMessage(template));
  return [...names].sort();
}

/** Every plural block in a template (also nested ones): the argument it counts and the selectors it gives. */
export function pluralBlocks(template: string): { name: string; selectors: string[] }[] {
  const blocks: { name: string; selectors: string[] }[] = [];
  const walk = (ps: Part[]) => {
    for (const p of ps) {
      if (p.type !== 'plural') continue;
      blocks.push({ name: p.name, selectors: Object.keys(p.options) });
      for (const o of Object.values(p.options)) walk(o);
    }
  };
  walk(parseMessage(template));
  return blocks;
}
