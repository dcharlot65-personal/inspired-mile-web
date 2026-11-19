/**
 * Every way the API can say no has a sentence in every language, and the server's own
 * English is never what the player reads.
 *
 * The list of what the API can say is not kept by hand: this test reads the Rust sources
 * (backend/src) and collects every plain-text answer `(StatusCode::…, "…")` and every
 * machine code `ApiError::new(…, "code", …)`. A handler that gains a new answer makes this
 * test fail until src/lib/api-errors.ts knows it and the sixteen locales have its sentence.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ApiError } from './api-client';
import { ERROR_VARS, GENERIC_CODES, SERVER_TEXT_CODES, apiErrorCode, apiErrorMessage, codeForServerText, codeForStatus } from './api-errors';
import { LOCALES, loadMessages, type Messages } from '../i18n';
import { interpolate } from './verse/msg';

const shared = import.meta.glob<{ default: Messages }>('../i18n/pages/shared/*.ts', { eager: true });
const sharedFor = (l: string) => shared[`../i18n/pages/shared/${l}.ts`].default;

/**
 * The multiplayer routes answer src/pages/multiplayer.astro, which this branch does not localise (its
 * brief leaves that page to the branch that rewrote it, now merged through integrate/wave3).
 */
const SKIP_DIRS = ['multiplayer'];

function rustFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return SKIP_DIRS.includes(name) ? [] : rustFiles(full);
    return name.endsWith('.rs') ? [full] : [];
  });
}

const unescapeRust = (s: string) => s.replace(/\\(["'\\])/g, '$1');

/** Rust below its unit tests is not what the server answers with. */
const production = (source: string) => source.split(/^#\[cfg\(test\)\]/m)[0];

interface ServerText {
  file: string;
  /** The whole body, or for a format!() the text before its first variable. */
  text: string;
  formatted: boolean;
}

function collect(): { texts: ServerText[]; codes: Map<string, string> } {
  const texts: ServerText[] = [];
  const codes = new Map<string, string>();
  for (const file of rustFiles('backend/src')) {
    const source = production(readFileSync(file, 'utf8'));
    // (StatusCode::NOT_FOUND, "Classroom not found".into())
    for (const m of source.matchAll(/\(\s*(?:[a-z_]+::)*StatusCode::[A-Z_]+,\s*"((?:[^"\\]|\\.)*)"\s*(?:\.into\(\)|\.to_string\(\)|\.to_owned\(\))?\s*,?\s*\)/g)) {
      texts.push({ file, text: unescapeRust(m[1]), formatted: false });
    }
    // (StatusCode::BAD_REQUEST, format!("Match is already {status}"))
    for (const m of source.matchAll(/\(\s*(?:[a-z_]+::)*StatusCode::[A-Z_]+,\s*format!\(\s*"((?:[^"\\]|\\.)*)"/g)) {
      texts.push({ file, text: unescapeRust(m[1]).split('{')[0], formatted: true });
    }
    // const INTERNAL_MESSAGE: &str = "…"; and other plain-text bodies kept in a constant
    for (const m of source.matchAll(/const [A-Z_]*MESSAGE[A-Z_]*: &str =\s*"((?:[^"\\]|\\.)*)"/g)) {
      texts.push({ file, text: unescapeRust(m[1]), formatted: false });
    }
    // ApiError::new(StatusCode::CONFLICT, "email_in_use", …), Self::new(…), ApiError::bad_request("invalid_email", …)
    for (const m of source.matchAll(/\b(?:ApiError|Self)::new\(\s*(?:[a-z_]+::)*StatusCode::[A-Z_]+,\s*"([a-z_]+)"/g)) codes.set(m[1], file);
    for (const m of source.matchAll(/\b(?:ApiError|Self)::bad_request\(\s*"([a-z_]+)"/g)) codes.set(m[1], file);
  }
  return { texts, codes };
}

const { texts, codes } = collect();

/** Does any locale-independent table entry cover this server text? */
function codeFor(t: ServerText): string | null {
  // A formatted body is matched by what follows its prefix being anything at all.
  return codeForServerText(t.formatted ? `${t.text}x` : t.text);
}

describe('what the API can answer', () => {
  it('is found in the Rust sources (the scan itself works)', () => {
    // If these fall to zero the patterns above have stopped matching and the tests below prove nothing.
    expect(texts.length).toBeGreaterThan(40);
    expect(codes.size).toBeGreaterThan(12);
    expect(texts.map((t) => t.text)).toContain('Classroom not found');
    expect(texts.map((t) => t.text)).toContain('Rate limit exceeded');
    expect(texts.some((t) => t.formatted && t.text.startsWith('Daily spending limit reached'))).toBe(true);
    expect([...codes.keys()]).toContain('email_in_use');
    expect([...codes.keys()]).toContain('not_signed_in');
    // Written with its full path (axum::http::StatusCode::FORBIDDEN): the patterns must see that too.
    expect([...codes.keys()]).toContain('age_required');
  });

  it('every plain-text answer has a code', () => {
    const unknown = texts.filter((t) => codeFor(t) === null).map((t) => `${t.file}: "${t.text}"`);
    expect(unknown, unknown.join('\n')).toEqual([]);
  });

  it('the table holds nothing the server no longer says', () => {
    const said = texts.map((t) => (t.formatted ? `${t.text}x` : t.text));
    const stale = SERVER_TEXT_CODES.filter(([pattern]) => !said.some((s) => (typeof pattern === 'string' ? pattern === s : pattern.test(s)))).map(([pattern]) => String(pattern));
    expect(stale, stale.join('\n')).toEqual([]);
  });

  it('every code, from a JSON body, a plain-text body or a bare status, has a sentence in all sixteen languages', async () => {
    const all = new Set<string>([...codes.keys(), ...SERVER_TEXT_CODES.map(([, code]) => code), ...GENERIC_CODES]);
    for (const status of [400, 401, 403, 404, 409, 422, 429, 500, 502, 503, 504]) all.add(codeForStatus(status));
    const problems: string[] = [];
    const english = { ...(await loadMessages('en')), ...sharedFor('en') };
    for (const l of LOCALES) {
      const messages = { ...(await loadMessages(l)), ...sharedFor(l) };
      for (const code of all) {
        const key = `error.${code}` in messages ? `error.${code}` : `auth.error.${code}`;
        const text = messages[key];
        if (typeof text !== 'string' || !text.trim()) {
          problems.push(`${l}: no message for "${code}"`);
          continue;
        }
        if (l !== 'en' && text === english[key]) problems.push(`${l}: the message for "${code}" is still English`);
        // What the sentence needs filled in is something the page can fill in.
        const needs = [...text.matchAll(/\{([a-zA-Z_]+)\}/g)].map((m) => m[1]);
        for (const name of needs) if (!(name in (ERROR_VARS[code] ?? {}))) problems.push(`${l}: "${code}" needs {${name}}, which nothing supplies`);
      }
    }
    // The list is the message too: vitest shortens a long array to "Array(1)" in its one-line summary.
    expect(problems, problems.join('\n')).toEqual([]);
  });
});

describe('from a failure to a code', () => {
  it('reads the code of a JSON body, the text of a plain one, and the status when there is neither', () => {
    expect(apiErrorCode(new ApiError(409, JSON.stringify({ error: 'email_in_use', message: 'srv-msg-one' })))).toBe('email_in_use');
    expect(apiErrorCode(new ApiError(404, 'Classroom not found'))).toBe('classroom_not_found');
    expect(apiErrorCode(new ApiError(404, '  Classroom not found\n'))).toBe('classroom_not_found');
    expect(apiErrorCode(new ApiError(400, 'Match is already completed'))).toBe('match_finished');
    expect(apiErrorCode(new ApiError(403, 'Daily spending limit reached (480/500 credits/day for players under 18)'))).toBe('daily_limit_reached');
    expect(apiErrorCode(new ApiError(500, 'DB error: error returned from database: relation "classrooms" does not exist'))).toBe('server_error');
    expect(apiErrorCode(new ApiError(401, ''))).toBe('not_signed_in');
    expect(apiErrorCode(new ApiError(429, 'Rate limit exceeded'))).toBe('too_many_requests');
    expect(apiErrorCode(new ApiError(404, 'something the page has never heard of'))).toBe('not_found');
    expect(apiErrorCode(new ApiError(418, 'teapot'))).toBe('bad_request');
    expect(apiErrorCode(new ApiError(503, '<html>Bad gateway</html>'))).toBe('unavailable');
    // fetch() itself failing is "no network"; anything else thrown is not blamed on the network.
    expect(apiErrorCode(new TypeError('Failed to fetch'))).toBe('network');
    expect(apiErrorCode(new Error('boom'))).toBe('generic');
    expect(apiErrorCode('boom')).toBe('generic');
    expect(codeForServerText('')).toBeNull();
  });
});

describe('from a failure to a sentence', () => {
  const failures: unknown[] = [
    new ApiError(404, 'Classroom not found'),
    new ApiError(500, 'DB error: error returned from database: relation "classrooms" does not exist'),
    new ApiError(400, 'Price must be between 1 and 100000'),
    // The server's own wording is a marker here, so that finding it on the page cannot be mistaken for our English.
    new ApiError(409, JSON.stringify({ error: 'email_in_use', message: 'srv-msg-one' })),
    new ApiError(400, JSON.stringify({ error: 'a_code_from_the_future', message: 'srv-msg-two' })),
    new ApiError(404, 'something the page has never heard of'),
    new TypeError('Failed to fetch'),
    new Error('boom'),
  ];

  it('is in the interface language and never the server’s own text', async () => {
    for (const l of LOCALES) {
      const messages = { ...(await loadMessages(l)), ...sharedFor(l) };
      const t = (key: string, vars?: Record<string, string | number>) => interpolate(messages[key] ?? key, vars);
      const has = (key: string) => key in messages;
      for (const e of failures) {
        const said = apiErrorMessage(e, t, has, (n) => new Intl.NumberFormat(l).format(n));
        expect([l, said.length > 0]).toEqual([l, true]);
        // Not a key, not an unfilled variable.
        expect([l, said, /^[a-z]+(\.[a-zA-Z_]+)+$/.test(said) || /\{[a-zA-Z_]+\}/.test(said)]).toEqual([l, said, false]);
        // Nothing of what the server or the browser wrote.
        for (const leak of ['relation', 'classrooms', 'DB error', 'Failed to fetch', 'boom', 'srv-msg', 'never heard of', 'Price must be']) {
          expect([l, said, said.includes(leak)]).toEqual([l, said, false]);
        }
        if (l !== 'en') {
          const inEnglish = apiErrorMessage(e, (key, vars) => interpolate(sharedFor('en')[key] ?? key, vars), (key) => key in sharedFor('en'), String);
          expect([l, said === inEnglish]).toEqual([l, false]);
        }
      }
    }
  });

  it('says the specific thing when it knows it, the status when it does not, and writes numbers as the language does', async () => {
    const de = { ...(await loadMessages('de')), ...sharedFor('de') };
    const t = (key: string, vars?: Record<string, string | number>) => interpolate(de[key] ?? key, vars);
    const has = (key: string) => key in de;
    const fmt = (n: number) => new Intl.NumberFormat('de').format(n);
    expect(apiErrorMessage(new ApiError(404, 'Classroom not found'), t, has, fmt)).toBe(de['error.classroom_not_found']);
    expect(apiErrorMessage(new ApiError(400, 'Price must be between 1 and 100000'), t, has, fmt)).toBe('Der Preis muss zwischen 1 und 100.000 Credits liegen.');
    expect(apiErrorMessage(new ApiError(409, JSON.stringify({ error: 'email_in_use' })), t, has, fmt)).toBe(de['auth.error.email_in_use']);
    expect(apiErrorMessage(new ApiError(403, JSON.stringify({ error: 'a_code_from_the_future' })), t, has, fmt)).toBe(de['error.forbidden']);
    expect(apiErrorMessage(new Error('boom'), t, has, fmt)).toBe(de['error.generic']);
  });
});

describe('the client libraries hand over the status and the body, not a sentence', () => {
  for (const file of ['src/lib/classroom.ts', 'src/lib/marketplace-client.ts', 'src/lib/tournament-client.ts', 'src/lib/seasons.ts']) {
    it(`${file} throws ApiError`, () => {
      const source = readFileSync(file, 'utf8');
      expect(source).toMatch(/throw new ApiError\(/);
      expect(source).not.toMatch(/throw new Error\(/);
    });
  }

  it('no page under this work shows e.message', () => {
    for (const file of ['classroom', 'marketplace', 'tournaments', 'season', 'viewer', 'vr'].map((p) => `src/pages/${p}.astro`)) {
      const source = readFileSync(file, 'utf8');
      expect([file, /\b(?:e|err|error)\.message\b/.test(source)]).toEqual([file, false]);
      expect([file, /\.serverMessage\b/.test(source)]).toEqual([file, false]);
    }
  });
});
