import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mayStayCached, SW_CACHE_PREFIX } from './pwa';

/**
 * public/sw.js, run for real against a fake Cache Storage and a fake network.
 *
 * The worker is a classic script with no exports, so it is evaluated here with its three
 * globals (self, caches, fetch) supplied, and driven through the listeners it registers.
 * The fake network records, for every request, whether it carried credentials: the
 * browser's own request does (as a signed-in player's would), the worker's must not.
 */

const SOURCE = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');
const ORIGIN = 'https://sonnetman.inspiredmile.com';
const CACHE = 'inspired-mile-v3';
const MODEL_URL = 'https://huggingface.co/onnx-community/LFM3-1.7B-ONNX/resolve/main/onnx/model_q4f16.onnx_data';

interface Call {
  url: string;
  /** false only when the request was sent with credentials: 'omit'. */
  credentialed: boolean;
  headers: Record<string, string>;
}
type Net = (call: Call) => Response | Promise<Response>;

/** What a signed-in player's request gets, against what an anonymous one gets. */
const personal: Net = (call) => new Response(call.credentialed ? 'PERSONAL viola@example.test' : 'public');

function boot(network: Net = personal) {
  const listeners: Record<string, (event: any) => void> = {};
  const stores = new Map<string, Map<string, Response>>();
  const calls: Call[] = [];
  const key = (r: any) => new URL(typeof r === 'string' ? r : r.url, ORIGIN).href;
  const cacheOf = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    return {
      match: async (r: any) => store.get(key(r))?.clone(),
      put: async (r: any, res: Response) => void store.set(key(r), res),
      keys: async () => [...store.keys()].map((url) => ({ url })),
      delete: async (r: any) => store.delete(key(r)),
    };
  };
  const caches = {
    open: async (name: string) => cacheOf(name),
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (r: any) => {
      for (const store of stores.values()) {
        const hit = store.get(key(r));
        if (hit) return hit.clone();
      }
      return undefined;
    },
  };
  async function fetchFake(r: any, init?: { credentials?: string; headers?: Record<string, string> }): Promise<Response> {
    // A Request object stands for the browser's own request, which carries the cookie.
    const call: Call = { url: key(r), credentialed: typeof r !== 'string' || init?.credentials !== 'omit', headers: init?.headers ?? {} };
    calls.push(call);
    return network(call);
  }
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, f: (event: any) => void) => void (listeners[type] = f),
    skipWaiting: () => {},
    clients: { claim: () => {} },
  };
  new Function('self', 'caches', 'fetch', SOURCE)(self, caches, fetchFake);

  /** Deliver a fetch event; `response` stays undefined if the worker left it to the browser. */
  async function request(url: string, init: { method?: string; mode?: string; headers?: Record<string, string> } = {}) {
    let answer: Promise<Response> | undefined;
    const waits: Promise<unknown>[] = [];
    listeners.fetch({
      request: { url: key(url), method: init.method ?? 'GET', mode: init.mode ?? 'cors', headers: new Headers(init.headers) },
      respondWith: (p: Promise<Response>) => void (answer = Promise.resolve(p)),
      waitUntil: (p: Promise<unknown>) => void waits.push(p),
    });
    const response = answer ? await answer : undefined;
    await Promise.all(waits);
    // Let the worker's background cache writes settle.
    await new Promise((r) => setTimeout(r, 0));
    return { handled: answer !== undefined, response };
  }
  async function lifecycle(type: 'install' | 'activate') {
    const waits: Promise<unknown>[] = [];
    listeners[type]({ waitUntil: (p: Promise<unknown>) => void waits.push(p) });
    await Promise.all(waits);
  }
  async function message(data: unknown) {
    const waits: Promise<unknown>[] = [];
    const replies: unknown[] = [];
    listeners.message({ data, ports: [{ postMessage: (m: unknown) => void replies.push(m) }], waitUntil: (p: Promise<unknown>) => void waits.push(p) });
    await Promise.all(waits);
    return replies;
  }
  const cached = (url: string) => [...stores.values()].some((s) => s.has(key(url)));
  const entries = () => [...stores.entries()].flatMap(([name, s]) => [...s.keys()].map((url) => `${name} ${url}`));
  async function bodies() {
    const out: string[] = [];
    for (const s of stores.values()) for (const res of s.values()) out.push(await res.clone().text());
    return out;
  }
  const text = async (name: string, url: string) => (await stores.get(name)!.get(key(url))!.clone()).text();
  return {
    request, lifecycle, message, stores, calls, cached, entries, bodies, text,
    seed: (name: string, url: string, body: string, headers?: Record<string, string>) => cacheOf(name).put(url, new Response(body, { headers })),
  };
}

describe('service worker: nothing of a signed-in player is kept', () => {
  it('does not answer, fetch or store anything under /api', async () => {
    const sw = boot();
    for (const path of ['/api/v1/auth/me', '/api/v1/inventory', '/api/v1/cards', '/api/v1/auth/passkeys', '/api']) {
      expect((await sw.request(path)).handled, path).toBe(false);
      expect((await sw.request(path, { mode: 'navigate' })).handled, path).toBe(false);
    }
    expect(sw.calls).toEqual([]);
    expect(sw.entries()).toEqual([]);
  });

  it('leaves a request with an Authorization header alone, whatever its path', async () => {
    const sw = boot();
    expect((await sw.request('/images/cards/DC-001.webp', { headers: { authorization: 'Bearer x' } })).handled).toBe(false);
    expect((await sw.request('/_astro/a.abc123.js', { headers: { authorization: 'Bearer x' } })).handled).toBe(false);
    expect(sw.entries()).toEqual([]);
  });

  it('stores only answers to requests it sent without credentials', async () => {
    const sw = boot();
    await sw.lifecycle('install');
    await sw.request('/battle', { mode: 'navigate' });
    await sw.request('/battle?seed=11&code=123456', { mode: 'navigate' });
    await sw.request('/_astro/battle.Dk3f9a.js');
    await sw.request('/images/cards/DC-001.webp');
    await sw.request('/fonts/inter-latin.woff2');
    expect(sw.entries().length).toBeGreaterThan(5);
    // The player saw their own (credentialed) page...
    expect(sw.calls.some((c) => c.credentialed && c.url === `${ORIGIN}/battle`)).toBe(true);
    // ...and not one byte of a credentialed answer was kept.
    for (const body of await sw.bodies()) expect(body).toBe('public');
  });

  it('keeps one copy of a page per path, and never a query string', async () => {
    const sw = boot();
    await sw.request('/battle?seed=11&code=123456', { mode: 'navigate' });
    expect(sw.entries()).toEqual([`${CACHE} ${ORIGIN}/battle`]);
  });

  it('does not keep an answer marked private, no-store, or varying by cookie', async () => {
    for (const headers of [{ 'cache-control': 'private, max-age=60' }, { 'cache-control': 'no-store' }, { vary: 'Accept-Encoding, Cookie' }, { vary: 'Authorization' }] as Record<string, string>[]) {
      const sw = boot(() => new Response('x', { headers }));
      await sw.request('/battle', { mode: 'navigate' });
      await sw.request('/_astro/a.abc123.js');
      await sw.request('/images/cards/DC-001.webp');
      expect(sw.entries(), JSON.stringify(headers)).toEqual([]);
    }
  });

  it('on FORGET_USER deletes everything but static files, deletes its older caches, and answers', async () => {
    const sw = boot();
    await sw.seed(CACHE, '/api/v1/auth/me', '{"email":"viola@example.test"}');
    await sw.seed(CACHE, '/battle?token=abc', 'page with a token');
    await sw.seed(CACHE, 'https://elsewhere.example/x', 'foreign');
    await sw.seed(CACHE, '/battle', 'page');
    await sw.seed(CACHE, '/_astro/battle.Dk3f9a.js', 'js');
    await sw.seed(CACHE, '/images/cards/DC-001.webp', 'art');
    await sw.seed('inspired-mile-v2', '/api/v1/auth/me', '{"email":"viola@example.test"}');
    await sw.seed('transformers-cache', MODEL_URL, 'weights');
    const replies = await sw.message({ type: 'FORGET_USER' });
    expect(replies).toEqual([{ type: 'FORGOTTEN' }]);
    expect(sw.entries().sort()).toEqual([
      `${CACHE} ${ORIGIN}/_astro/battle.Dk3f9a.js`,
      `${CACHE} ${ORIGIN}/battle`,
      `${CACHE} ${ORIGIN}/images/cards/DC-001.webp`,
      `transformers-cache ${MODEL_URL}`,
    ]);
  });

  it('ignores any other message', async () => {
    const sw = boot();
    await sw.seed(CACHE, '/api/v1/auth/me', 'x');
    expect(await sw.message({ type: 'CACHE_CARDS', urls: ['/api/v1/auth/me'] })).toEqual([]);
    expect(await sw.message(null)).toEqual([]);
    expect(sw.calls).toEqual([]);
    expect(sw.cached('/api/v1/auth/me')).toBe(true);
  });

  it('agrees with the page (pwa.ts mayStayCached) on what may stay', async () => {
    expect(CACHE.startsWith(SW_CACHE_PREFIX)).toBe(true);
    const urls = [
      '/', '/battle', '/battle/', '/cards/DC-001', '/offline.html', '/battle?seed=1', '/api', '/api/v1/auth/me', '/api/v1/cards',
      '/_astro/a.abc123.js', '/_astro/a.abc123.css?x=1', '/images/cards/DC-001.webp', '/fonts/inter-latin.woff2', '/audio/sfx/hit.mp3',
      '/icons/20261120100034/favicon.svg', '/icons/20261120100034/icon-192.png', '/icons/20261120100034/icon-512.png', '/favicon.ico', '/apple-touch-icon.png', '/icon-192.png', '/models/sm-001.glb', '/manifest.json', '/sw.js', '/src/lib/brain.ts',
      'https://elsewhere.example/battle', MODEL_URL,
    ];
    const sw = boot();
    for (const url of urls) await sw.seed(CACHE, url, 'x');
    await sw.message({ type: 'FORGET_USER' });
    for (const url of urls) expect(sw.cached(url), url).toBe(mayStayCached(new URL(url, ORIGIN).href, ORIGIN));
    // and the table has both kinds in it
    expect(urls.filter((u) => sw.cached(u)).length).toBeGreaterThan(8);
    expect(urls.filter((u) => !sw.cached(u)).length).toBeGreaterThan(8);
  });
});

describe('service worker: what it leaves alone', () => {
  it('does not answer, fetch or store a model file from the Hugging Face hub', async () => {
    const sw = boot();
    const r = await sw.request(MODEL_URL);
    expect(r.handled).toBe(false);
    expect(sw.calls).toEqual([]);
    expect(sw.cached(MODEL_URL)).toBe(false);
  });

  it('leaves range requests, 3D models, dev modules, query-string files and non-GET requests to the browser', async () => {
    const sw = boot();
    expect((await sw.request('/audio/music/battle-beat.mp3', { headers: { range: 'bytes=0-' } })).handled).toBe(false);
    expect((await sw.request('/models/sm-001.glb')).handled).toBe(false);
    expect((await sw.request('/src/lib/brain.ts')).handled).toBe(false);
    expect((await sw.request('/node_modules/.vite/deps/@huggingface_transformers.js')).handled).toBe(false);
    expect((await sw.request('/images/cards/DC-001.webp?w=200')).handled).toBe(false);
    expect((await sw.request('/api/v1/auth/email/start', { method: 'POST' })).handled).toBe(false);
    expect((await sw.request('/battle', { method: 'POST', mode: 'navigate' })).handled).toBe(false);
    expect(sw.calls).toEqual([]);
  });

  it('does not keep a response larger than its limit', async () => {
    const sw = boot(() => new Response('x', { headers: { 'content-length': String(300 * 1024 * 1024) } }));
    const r = await sw.request('/_astro/huge.abc123.js');
    expect(r.handled).toBe(true);
    expect(sw.cached('/_astro/huge.abc123.js')).toBe(false);
  });
});

describe('service worker: caches it does not own', () => {
  it('on activation deletes its own old caches (v2 held API answers) and nothing else', async () => {
    const sw = boot();
    await sw.seed('inspired-mile-v2', '/api/v1/auth/me', '{"email":"viola@example.test"}');
    await sw.seed('transformers-cache', MODEL_URL, 'weights');
    await sw.seed('kokoro-voices', 'https://huggingface.co/voice.bin', 'voice');
    await sw.lifecycle('install');
    await sw.lifecycle('activate');
    expect([...sw.stores.keys()].sort()).toEqual([CACHE, 'kokoro-voices', 'transformers-cache']);
    expect(sw.cached(MODEL_URL)).toBe(true);
    expect(sw.cached('/api/v1/auth/me')).toBe(false);
  });

  it('installs even when a file it wants to keep is missing', async () => {
    const sw = boot((call) => (call.url.endsWith('/favicon.svg') ? new Response('gone', { status: 404 }) : new Response('ok')));
    await sw.lifecycle('install');
    expect(sw.cached('/offline.html')).toBe(true);
    expect(sw.cached('/icons/20261120100034/favicon.svg')).toBe(false);
  });
});

describe('service worker: pages', () => {
  it('serves the page from the network even when it holds an older copy, and renews the copy', async () => {
    const sw = boot((call) => new Response(call.credentialed ? 'new deploy' : 'new deploy, anonymous'));
    await sw.seed(CACHE, '/battle', 'old deploy');
    const r = await sw.request('/battle', { mode: 'navigate' });
    expect(await r.response!.text()).toBe('new deploy');
    expect(await sw.text(CACHE, '/battle')).toBe('new deploy, anonymous');
  });

  it('asks for the copy with the kept ETag, and keeps what it has on 304', async () => {
    const sw = boot((call) => (call.headers['if-none-match'] === '"v1"' ? new Response(null, { status: 304 }) : new Response('page')));
    await sw.seed(CACHE, '/battle', 'kept v1', { etag: '"v1"' });
    await sw.request('/battle', { mode: 'navigate' });
    expect(sw.calls.filter((c) => !c.credentialed).map((c) => c.headers['if-none-match'])).toEqual(['"v1"']);
    expect(await sw.text(CACHE, '/battle')).toBe('kept v1');
  });

  it('offline, serves the copy it holds, and the offline page for one it does not', async () => {
    const sw = boot(() => {
      throw new TypeError('Failed to fetch');
    });
    await sw.seed(CACHE, '/battle', 'kept page');
    await sw.seed(CACHE, '/offline.html', 'offline page');
    expect(await (await sw.request('/battle?seed=3', { mode: 'navigate' })).response!.text()).toBe('kept page');
    expect(await (await sw.request('/theatre', { mode: 'navigate' })).response!.text()).toBe('offline page');
  });

  it('offline with nothing kept, answers 503 and not an exception', async () => {
    const sw = boot(() => {
      throw new TypeError('Failed to fetch');
    });
    expect((await sw.request('/theatre', { mode: 'navigate' })).response!.status).toBe(503);
  });

  it('does not keep an error page', async () => {
    const sw = boot(() => new Response('bad gateway', { status: 502 }));
    const r = await sw.request('/battle', { mode: 'navigate' });
    expect(r.response!.status).toBe(502);
    expect(sw.cached('/battle')).toBe(false);
  });
});

describe('service worker: assets', () => {
  it('serves a hashed build file from the cache without asking the network', async () => {
    const sw = boot();
    await sw.seed(CACHE, '/_astro/battle.Dk3f9a.js', 'cached js');
    const r = await sw.request('/_astro/battle.Dk3f9a.js');
    expect(await r.response!.text()).toBe('cached js');
    expect(sw.calls).toEqual([]);
  });

  it('fetches a build file it does not hold once, anonymously, and keeps it', async () => {
    const sw = boot();
    expect(await (await sw.request('/_astro/battle.Dk3f9a.js')).response!.text()).toBe('public');
    expect(await (await sw.request('/_astro/battle.Dk3f9a.js')).response!.text()).toBe('public');
    expect(sw.calls).toEqual([{ url: `${ORIGIN}/_astro/battle.Dk3f9a.js`, credentialed: false, headers: {} }]);
  });

  it('when the anonymous request is refused, sends the browser\'s own and stores nothing', async () => {
    const sw = boot((call) => (call.credentialed ? new Response('behind the cookie') : new Response('challenge', { status: 403 })));
    const r = await sw.request('/_astro/battle.Dk3f9a.js');
    expect(await r.response!.text()).toBe('behind the cookie');
    expect(sw.entries()).toEqual([]);
  });

  it('serves a card image at once and refreshes it for next time', async () => {
    const sw = boot(() => new Response('new art'));
    await sw.seed(CACHE, '/images/cards/DC-001.webp', 'old art');
    const r = await sw.request('/images/cards/DC-001.webp');
    expect(await r.response!.text()).toBe('old art');
    expect(await (await sw.request('/images/cards/DC-001.webp')).response!.text()).toBe('new art');
  });
});
