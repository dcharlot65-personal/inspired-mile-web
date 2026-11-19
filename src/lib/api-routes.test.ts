/**
 * Every request a page makes is one the API answers: the method and the path of each call in the
 * front end are found among the routes the Rust routers define. Owner decision R9 (2026-11-19):
 * the pages move to the new API with the server-held economy, so nothing calls a route it removed
 * (`POST /credits/spend`, `POST /stats`, `POST /stats/achievements`, `POST /inventory/add`,
 * `POST /migrate/sync`, `POST /variants/unlock`, `POST /tournaments/{id}/matches/{id}/complete`)
 * or any other route that does not exist.
 *
 * Neither list is kept by hand. The routes are read from backend/src (main.rs's `.nest(...)` and each
 * module's `.route(...)`); the calls from src/ (the request helpers of the client modules, and every
 * literal `/api/v1/...` path). A call whose path cannot be read (built at run time) fails the test
 * rather than being skipped.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';
interface Route { method: Method; path: string }
interface Call extends Route { file: string; line: number; raw: string }

const API = '/api/v1';

/** The API's routes: method and full path, with `{name}` for a path parameter. */
export function serverRoutes(): Route[] {
  const main = readFileSync('backend/src/main.rs', 'utf8');
  const routes: Route[] = [];
  const add = (prefix: string, routeSource: string) => {
    for (const m of routeSource.matchAll(/\.route\(\s*"([^"]*)"\s*,\s*((?:[a-z_]+\s*\([^()]*(?:\([^()]*\)[^()]*)*\)\s*\.?\s*)+)\)/g)) {
      const sub = m[1] === '/' ? '' : m[1];
      for (const method of m[2].matchAll(/\b(get|post|put|delete)\s*\(/g)) {
        routes.push({ method: method[1].toUpperCase() as Method, path: `${API}${prefix}${sub}` });
      }
    }
  };
  // Routes defined in main.rs itself (the health check).
  add('', main.replace(/\.nest\([^)]*\)\)?/g, ''));
  for (const m of main.matchAll(/\.nest\(\s*"(\/[a-z-]+)"\s*,\s*([a-z_]+)::(?:public_)?router\(/g)) {
    const [, prefix, module] = m;
    const dir = path.join('backend/src', module);
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.rs'))) {
      const source = readFileSync(path.join(dir, file), 'utf8').split(/^#\[cfg\(test\)\]/m)[0];
      add(prefix, source);
    }
  }
  return routes;
}

/** The helpers a client module sends its requests through, and the path each one starts from. */
const HELPERS: Record<string, Array<[name: string, base: string]>> = {
  'src/lib/api-client.ts': [['request', API]],
  'src/lib/referral.ts': [['apiFetch', API]],
  'src/lib/classroom.ts': [['apiFetch', API]],
  'src/lib/marketplace-client.ts': [['request', `${API}/marketplace`]],
  'src/lib/tournament-client.ts': [['request', `${API}/tournaments`]],
  'src/lib/seasons.ts': [['seasonRequest', `${API}/seasons`]],
};

/** The text of a call's arguments: from its opening parenthesis to the one that closes it. */
function argumentsAt(source: string, open: number): string {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '(') depth++;
    else if (source[i] === ')' && --depth === 0) return source.slice(open + 1, i);
  }
  return source.slice(open + 1);
}

/** A path as written in a call: `${...}` is a parameter, a query string is dropped. */
function normalise(written: string): string | null {
  const p = written.replace(/\$\{[^}]*\}/g, '{p}').split('?')[0];
  return /[`'"+]/.test(p) ? null : p;
}

/** Every request in these sources (path -> source text). Exported so the planted cases below use it. */
export function callsIn(files: Record<string, string>): { calls: Call[]; unreadable: string[] } {
  const calls: Call[] = [];
  const unreadable: string[] = [];
  for (const [file, source] of Object.entries(files)) {
    const lineOf = (i: number) => source.slice(0, i).split('\n').length;
    // A mention in a comment ("request() always sends…") is not a call.
    const inComment = (i: number) => /\/\/|^\s*\*|\/\*/.test(source.slice(source.lastIndexOf('\n', i) + 1, i));
    const methodOf = (args: string): Method => (args.match(/method:\s*['"](GET|POST|PUT|DELETE)['"]/)?.[1] as Method) ?? 'GET';
    for (const [name, base] of HELPERS[file] ?? []) {
      for (const m of source.matchAll(new RegExp(`\\b${name}(?:<[^>(]*>)?\\(`, 'g'))) {
        if (inComment(m.index!)) continue;
        const open = m.index! + m[0].length - 1;
        const args = argumentsAt(source, open);
        // The helper's own definition (`function request<T>(path: string, …)`) is not a call.
        if (/^\s*path\s*:/.test(args) || /function\s+$/.test(source.slice(Math.max(0, m.index! - 20), m.index!))) continue;
        const literal = args.match(/^\s*(['"`])((?:(?!\1)[^\\]|\\.)*)\1\s*(,|$)/);
        const written = literal ? normalise(literal[2]) : null;
        if (written === null) {
          unreadable.push(`${file}:${lineOf(m.index!)}: ${args.slice(0, 60)}`);
          continue;
        }
        calls.push({ file, line: lineOf(m.index!), raw: args.slice(0, 80), method: methodOf(args), path: `${base}${written}` });
      }
    }
    // Any path written out whole: fetch('/api/v1/...'), new WebSocket(... + '/api/v1/multiplayer/ws').
    for (const m of source.matchAll(/(['"`])(\/api\/v1\/(?:(?!\1)[^\\])*)\1/g)) {
      if (inComment(m.index!)) continue;
      const written = normalise(m[2]);
      if (written === null) {
        unreadable.push(`${file}:${lineOf(m.index!)}: ${m[0]}`);
        continue;
      }
      // The method: the fetch() call this literal opens, if it is one.
      const before = source.slice(Math.max(0, m.index! - 40), m.index!);
      const fetchOpen = before.match(/fetch\(\s*$/) ? m.index! - 1 - (before.length - before.lastIndexOf('(') - 1) : -1;
      const method = fetchOpen >= 0 ? methodOf(argumentsAt(source, fetchOpen)) : 'GET';
      calls.push({ file, line: lineOf(m.index!), raw: m[0], method, path: written });
    }
  }
  return { calls, unreadable };
}

function matches(route: Route, call: Route): boolean {
  if (route.method !== call.method) return false;
  const a = route.path.split('/');
  const b = call.path.split('/');
  return a.length === b.length && a.every((seg, i) => (/^\{.+\}$/.test(seg) ? b[i].length > 0 : seg === b[i]));
}

/** The calls no route answers. */
export function unanswered(calls: Call[], routes: Route[]): Call[] {
  return calls.filter((c) => !routes.some((r) => matches(r, c)));
}

function frontEndSources(): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) {
        // Message files and generated data hold no requests.
        if (!['i18n', 'sound', 'packs', 'stem', 'function-words', 'cards-i18n'].includes(name)) walk(full);
      } else if (/\.(ts|astro|mjs|js)$/.test(name) && !/\.test\.ts$/.test(name) && !/pron-en|confusables|judge-words/.test(name)) {
        out[full] = readFileSync(full, 'utf8');
      }
    }
  };
  walk('src');
  return out;
}

const ROUTES = serverRoutes();
const FOUND = callsIn(frontEndSources());

describe('the requests the pages make', () => {
  it('are read from both sides (the scans themselves work)', () => {
    // The routers: well over fifty routes, the new ones of the server-held economy among them.
    expect(ROUTES.length).toBeGreaterThan(50);
    for (const r of [['POST', '/api/v1/inventory/packs'], ['POST', '/api/v1/migrate/import'], ['GET', '/api/v1/stats/leaderboard'], ['POST', '/api/v1/tournaments/{id}/matches/{match_id}/room'], ['DELETE', '/api/v1/multiplayer/queue'], ['GET', '/api/v1/marketplace'], ['GET', '/api/v1/health']]) {
      expect(ROUTES, r.join(' ')).toContainEqual({ method: r[0], path: r[1] });
    }
    // The pages: dozens of calls, from every client module and the pages that fetch directly.
    expect(FOUND.calls.length).toBeGreaterThan(50);
    for (const file of [...Object.keys(HELPERS), 'src/lib/multiplayer-client.ts', 'src/pages/playground.astro']) {
      expect(FOUND.calls.some((c) => c.file === file), file).toBe(true);
    }
    expect(FOUND.calls).toContainEqual(expect.objectContaining({ method: 'POST', path: '/api/v1/marketplace/{p}/buy' }));
    expect(FOUND.calls).toContainEqual(expect.objectContaining({ method: 'DELETE', path: '/api/v1/multiplayer/queue' }));
  });

  it('every one has a route that answers it', () => {
    expect(FOUND.unreadable, 'a request whose path is built at run time cannot be checked').toEqual([]);
    const missing = unanswered(FOUND.calls, ROUTES).map((c) => `${c.method} ${c.path} (${c.file}:${c.line})`);
    expect(missing).toEqual([]);
  });

  it('would catch a page that still called a removed route, or a removed method of a route that stays', () => {
    const planted = callsIn({
      'src/lib/api-client.ts': [
        "request('/credits/spend', { method: 'POST', body: JSON.stringify({ amount: 1 }) });",
        "request('/stats', { method: 'POST', body: '{}' });",
        "request('/stats');",
        "request('/inventory/add', {\n  method: 'POST',\n  body: JSON.stringify({ card_id }),\n});",
      ].join('\n'),
      'src/lib/tournament-client.ts': "request(`/${t}/matches/${m}/complete`, { method: 'POST' });",
      'src/pages/somewhere.astro': "fetch('/api/v1/migrate/sync', { method: 'POST' }); fetch(`/api/v1/variants/unlock`, { credentials: 'include', method: 'POST' });",
    });
    expect(unanswered(planted.calls, ROUTES).map((c) => `${c.method} ${c.path}`)).toEqual([
      'POST /api/v1/credits/spend',
      'POST /api/v1/stats',
      'POST /api/v1/inventory/add',
      'POST /api/v1/tournaments/{p}/matches/{p}/complete',
      'POST /api/v1/migrate/sync',
      'POST /api/v1/variants/unlock',
    ]);
    // A path put together at run time is reported, not passed over.
    expect(callsIn({ 'src/lib/api-client.ts': "request(base + '/x');" }).unreadable).toHaveLength(1);
  });
});
