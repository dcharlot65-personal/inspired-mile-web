import { test, expect, type APIRequestContext, type CDPSession, type Page } from '@playwright/test';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { E2E } from './e2e-env';

/**
 * Passwordless sign-in, end to end: the real API on a real Postgres (tests/start-backend.sh),
 * passkeys through Chrome's virtual authenticator, email codes through DEV_EMAIL_LOG.
 *
 * Nothing here is mocked. The one request that is re-routed (the "no mail key" UI test)
 * is answered by a second real API that has email sign-in off.
 */

const API = `http://127.0.0.1:${E2E.apiPort}/api/v1`;
const API_NO_EMAIL = `http://127.0.0.1:${E2E.apiNoEmailPort}/api/v1`;
const API_LOG = path.join(E2E.workDir, 'api.log');
/** The same pages on a second origin whose /api is the email-off API. */
const NO_EMAIL_WEB = E2E.webNoEmailOrigin;
/** The JWT secret tests/start-backend.sh gives the test APIs. */
const E2E_JWT_SECRET = 'e2e-secret-not-for-production-0123456789abcdef';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let counter = 0;
function unique(): string {
  counter += 1;
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}${counter}`;
}

function uniqueEmail(tag: string): string {
  return `${tag}-${unique()}@example.test`;
}

/** Each test gets its own client address, so the per-IP limit of one cannot trip another. */
function uniqueIp(): string {
  const n = () => 1 + Math.floor(Math.random() * 253);
  return `10.${n()}.${n()}.${n()}`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Every code the API has logged for an address, oldest first. */
function loggedCodes(email: string): string[] {
  if (!existsSync(API_LOG)) return [];
  const re = new RegExp(`DEV_EMAIL_LOG sign-in code for ${escapeRegExp(email)} is (\\d{6})`, 'g');
  return [...readFileSync(API_LOG, 'utf8').matchAll(re)].map((m) => m[1]);
}

/** The newest code logged for an address, once `atLeast` codes have been logged for it. */
async function readCode(email: string, atLeast = 1): Promise<string> {
  let codes: string[] = [];
  await expect
    .poll(() => { codes = loggedCodes(email); return codes.length; }, {
      message: `the API should have logged ${atLeast} code(s) for ${email} in ${API_LOG}`,
      timeout: 10000,
    })
    .toBeGreaterThanOrEqual(atLeast);
  return codes[codes.length - 1];
}

function psqlBinary(): string {
  for (const candidate of [
    '/opt/homebrew/opt/postgresql@18/bin/psql',
    '/opt/homebrew/bin/psql',
    '/usr/local/bin/psql',
    '/usr/bin/psql',
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return 'psql';
}

/** Run SQL on the test database; rows come back as tab-less `|`-separated lines. */
function sql(statement: string): string {
  return execFileSync(
    psqlBinary(),
    ['-h', '127.0.0.1', '-p', String(E2E.pgPort), '-U', E2E.dbUser, '-d', E2E.dbName, '-At', '-v', 'ON_ERROR_STOP=1', '-c', statement],
    { encoding: 'utf8' },
  ).trim();
}

/** An answer from the API, read once. The same shape as Playwright's APIResponse where the tests use it. */
interface Answer {
  status(): number;
  json(): Promise<any>;
  text(): Promise<string>;
  headers(): Record<string, string>;
  /** The value of one cookie this answer sets, or null. */
  cookie(name: string): string | null;
}

/**
 * Call the API with Node's fetch: no cookie jar, so every cookie that is sent is one the
 * test chose to send. (Playwright's request contexts keep a jar, and a test about whose
 * session or whose code a request carries must not depend on what the jar holds.)
 */
async function call(
  method: string,
  url: string,
  opts: { body?: unknown; cookie?: string | null; headers?: Record<string, string> } = {},
): Promise<Answer> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.body !== undefined && !Object.keys(headers).some((h) => h.toLowerCase() === 'content-type')) {
    headers['Content-Type'] = 'application/json';
  }
  if (opts.cookie) headers.Cookie = opts.cookie;
  const res = await fetch(url, {
    method,
    headers,
    body: opts.body === undefined ? undefined : typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body),
    redirect: 'manual',
  });
  const text = await res.text();
  const setCookies = res.headers.getSetCookie();
  const flat: Record<string, string> = {};
  res.headers.forEach((value, name) => { if (name !== 'set-cookie') flat[name] = value; });
  if (setCookies.length) flat['set-cookie'] = setCookies.join('\n');
  return {
    status: () => res.status,
    json: async () => JSON.parse(text),
    text: async () => text,
    headers: () => flat,
    cookie: (name) => {
      for (const line of setCookies) {
        const match = line.match(new RegExp(`^${escapeRegExp(name)}=([^;]*)`));
        if (match) return match[1];
      }
      return null;
    },
  };
}

/**
 * A code is tied to the browser that asked for it (the `im_code` cookie). These API tests
 * play that browser: the cookie from asking is kept per address and sent back when the
 * code is submitted and when another code is asked for. `browser: 'other'` asks as somebody
 * else: no cookie is sent and the one that comes back is not kept.
 */
const requesterCookies = new Map<string, string>();

async function requestCode(
  _request: APIRequestContext,
  email: string,
  opts: { ip?: string; ageTier?: string | null; base?: string; browser?: 'same' | 'other' } = {},
): Promise<Answer> {
  const body: Record<string, unknown> = { email };
  if (opts.ageTier !== null) body.age_tier = opts.ageTier ?? 'adult';
  const mine = opts.browser !== 'other';
  const known = mine ? requesterCookies.get(email) : undefined;
  const res = await call('POST', `${opts.base ?? API}/auth/email/request`, {
    body,
    headers: { 'CF-Connecting-IP': opts.ip ?? uniqueIp() },
    cookie: known ? `im_code=${known}` : null,
  });
  const issued = res.cookie('im_code');
  if (mine && issued) requesterCookies.set(email, issued);
  return res;
}

/** Submit a code. `cookie` overrides whose browser this is: a value, or null for none. */
function verifyCode(
  _request: APIRequestContext,
  email: string,
  code: string,
  base = API,
  opts: { ip?: string; cookie?: string | null } = {},
): Promise<Answer> {
  const cookie = opts.cookie === undefined ? requesterCookies.get(email) : opts.cookie;
  return call('POST', `${base}/auth/email/verify`, {
    body: { email, code },
    headers: opts.ip ? { 'CF-Connecting-IP': opts.ip } : {},
    cookie: cookie ? `im_code=${cookie}` : null,
  });
}

/** A code that is certainly not `code`. */
function wrongCodeFor(code: string): string {
  return code === '000000' ? '000001' : '000000';
}

interface Authenticator { cdp: CDPSession; authenticatorId: string }

/** Chrome's virtual platform authenticator: resident keys, user verification, auto-approve. */
async function addVirtualAuthenticator(page: Page): Promise<Authenticator> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return { cdp, authenticatorId };
}

async function openSignIn(page: Page) {
  await page.locator('#auth-btn').click();
  await expect(page.locator('#auth-dropdown')).toBeVisible();
}

/** Drive the email-code sign-in through the UI. Ends just after the code is submitted. */
async function signInByEmailUi(page: Page, email: string) {
  await openSignIn(page);
  await expect(page.locator('#auth-email-btn')).toBeVisible();
  await page.locator('#auth-email-btn').click();
  await page.locator('#auth-email-input').fill(email);
  await page.locator('#auth-email-send').click();
  await expect(page.locator('#auth-step-code')).toBeVisible();
  await expect(page.locator('#auth-code-intro')).toContainText(email);
  const code = await readCode(email);
  await page.locator('#auth-code-input').fill(code);
  await page.locator('#auth-code-verify').click();
}

/** Ask the API who the browser is signed in as, from inside the page (its own cookie jar). */
async function me(page: Page) {
  const result = await page.evaluate(async () => {
    const res = await fetch('/api/v1/auth/me', { credentials: 'include' });
    return { status: res.status, body: await res.json().catch(() => null) };
  });
  return { status: () => result.status, json: async () => result.body };
}

test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({ 'CF-Connecting-IP': uniqueIp() });
});

// ---------------------------------------------------------------------------
// Harness self-check
// ---------------------------------------------------------------------------

test.describe('Auth harness', () => {
  test('the dev server proxies /api to the real API, on a real database', async ({ request }) => {
    const viaProxy = await request.get('/api/v1/health');
    expect(viaProxy.status()).toBe(200);
    expect(await viaProxy.text()).toBe('ok');
    // The migration ran: the new tables exist in the database the API uses.
    const tables = sql(
      "SELECT string_agg(table_name, ',' ORDER BY table_name) FROM information_schema.tables " +
      "WHERE table_name IN ('auth_challenges','email_login_codes','webauthn_credentials')",
    );
    expect(tables).toBe('auth_challenges,email_login_codes,webauthn_credentials');
  });
});

// ---------------------------------------------------------------------------
// Which methods are available
// ---------------------------------------------------------------------------

test.describe('Auth methods', () => {
  test('methods says email is available when the API can deliver codes', async ({ request }) => {
    const res = await request.get(`${API}/auth/methods`);
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ passkey: true, passkey_signup: true, email: true });
  });

  test('without a mail key the email endpoints answer 503 with a JSON error', async ({ request }) => {
    const methods = await request.get(`${API_NO_EMAIL}/auth/methods`);
    expect(await methods.json()).toEqual({ passkey: true, passkey_signup: true, email: false });

    const email = uniqueEmail('nokey');
    const asked = await requestCode(request, email, { base: API_NO_EMAIL });
    expect(asked.status()).toBe(503);
    expect(asked.headers()['content-type']).toContain('application/json');
    const body = await asked.json();
    expect(body.error).toBe('email_sign_in_unavailable');
    expect(typeof body.message).toBe('string');

    const verified = await verifyCode(request, email, '123456', API_NO_EMAIL);
    expect(verified.status()).toBe(503);
    expect((await verified.json()).error).toBe('email_sign_in_unavailable');

    // Nothing was stored or logged for the address.
    expect(sql(`SELECT COUNT(*) FROM email_login_codes WHERE email = '${email}'`)).toBe('0');
    expect(loggedCodes(email)).toEqual([]);
  });

  test('with no mail key the UI shows email nowhere, and still offers an account', async ({ page }) => {
    // The second origin: same pages, in front of the API that has email off.
    await page.goto(`${NO_EMAIL_WEB}/`);
    await openSignIn(page);
    await expect(page.locator('#auth-passkey-btn')).toBeVisible();
    await expect(page.locator('#auth-create-btn')).toBeVisible();
    await expect(page.locator('#auth-create-btn')).toHaveText(/Create an account with a passkey/);
    await expect(page.locator('#auth-email-btn')).toBeHidden();
    await expect(page.locator('#auth-email-hint')).toBeHidden();
    // No offer of email anywhere on the panel a visitor first sees: the only mention is
    // the note that says the old ways in are off (tested below).
    const offered = await page.locator('#auth-step-choose button:visible').allInnerTexts();
    expect(offered.join(' ')).not.toMatch(/e-?mail/i);
  });

  test('with email off, the panel says an older Google or email account cannot be opened', async ({ page }) => {
    // Such an account has no passkey, and its only way in (a code to its address) answers
    // 503. Offering "create an account" without saying so would pass a new, empty account
    // off as the way back to the old one.
    await page.goto(`${NO_EMAIL_WEB}/`);
    await openSignIn(page);
    const note = page.locator('#auth-legacy-note');
    await expect(note).toBeVisible();
    await expect(note).toContainText('Google or an email address');
    await expect(note).toContainText('cannot be opened yet');
    await expect(note).toContainText('new, empty one');

    // Where email works there is nothing to warn about.
    await page.goto('/');
    await openSignIn(page);
    await expect(page.locator('#auth-email-btn')).toBeVisible();
    await expect(page.locator('#auth-legacy-note')).toBeHidden();
  });

  test('the UI offers email sign-in when the API can deliver codes', async ({ page }) => {
    await page.goto('/');
    await openSignIn(page);
    await expect(page.locator('#auth-passkey-btn')).toBeVisible();
    await expect(page.locator('#auth-passkey-btn')).toHaveText(/Sign in with a passkey/);
    await expect(page.locator('#auth-email-btn')).toBeVisible();
    await expect(page.locator('#auth-email-btn')).toHaveText(/Email me a code/);
    await expect(page.locator('#auth-create-btn')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Email one-time code (API)
// ---------------------------------------------------------------------------

test.describe('Email code API', () => {
  test('a code creates an account, sets the session cookie, and works once', async ({ request }) => {
    const email = uniqueEmail('new');
    const asked = await requestCode(request, email, { ageTier: 'teen' });
    expect(asked.status()).toBe(200);
    expect(await asked.json()).toEqual({ ok: true, expires_in_seconds: 600 });

    const code = await readCode(email);
    expect(code).toMatch(/^\d{6}$/);

    const verified = await verifyCode(request, email, code);
    expect(verified.status()).toBe(200);
    const body = await verified.json();
    expect(body.user.email).toBe(email);
    expect(body.user.auth_provider).toBe('email');
    // The public username is generated, not taken from the address.
    expect(body.user.username).toMatch(/^bard-[0-9a-f]{12}$/);
    expect(body.is_new_user).toBe(true);
    expect(body.passkey_count).toBe(0);

    const setCookie = verified.headers()['set-cookie'] ?? '';
    expect(setCookie).toContain('im_token=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=Strict');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).not.toMatch(/Domain=/i);

    // The age tier given with the request is stored on the new account.
    expect(sql(`SELECT age_tier FROM users WHERE email = '${email}'`)).toBe('teen');

    // Single use: the same code is refused the second time.
    const again = await verifyCode(request, email, code);
    expect(again.status()).toBe(401);
    expect((await again.json()).error).toBe('invalid_code');
  });

  test('the code is stored hashed and expires ten minutes after it is issued', async ({ request }) => {
    const email = uniqueEmail('hash');
    expect((await requestCode(request, email)).status()).toBe(200);
    const code = await readCode(email);

    const [hash, lifetime] = sql(
      `SELECT code_hash, ROUND(EXTRACT(EPOCH FROM (expires_at - created_at))) FROM email_login_codes WHERE email = '${email}'`,
    ).split('|');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(code);
    expect(lifetime).toBe('600');
  });

  test('an expired code is refused', async ({ request }) => {
    const email = uniqueEmail('expired');
    expect((await requestCode(request, email)).status()).toBe(200);
    const code = await readCode(email);
    // Age the code past its expiry in the database, then present the right code.
    sql(`UPDATE email_login_codes SET expires_at = NOW() - INTERVAL '1 second' WHERE email = '${email}'`);
    const verified = await verifyCode(request, email, code);
    expect(verified.status()).toBe(401);
    expect((await verified.json()).error).toBe('invalid_code');
    expect(sql(`SELECT COUNT(*) FROM users WHERE email = '${email}'`)).toBe('0');
  });

  test('five wrong guesses kill a code, even for the right guess', async ({ request }) => {
    const email = uniqueEmail('attempts');
    expect((await requestCode(request, email)).status()).toBe(200);
    const code = await readCode(email);
    for (let i = 0; i < 5; i++) {
      const miss = await verifyCode(request, email, wrongCodeFor(code));
      expect(miss.status(), `wrong guess ${i + 1}`).toBe(401);
    }
    expect(sql(`SELECT attempts FROM email_login_codes WHERE email = '${email}'`)).toBe('5');
    const late = await verifyCode(request, email, code);
    expect(late.status()).toBe(401);
    expect(sql(`SELECT COUNT(*) FROM users WHERE email = '${email}'`)).toBe('0');
  });

  test('four wrong guesses still leave the right code working', async ({ request }) => {
    const email = uniqueEmail('attempts-ok');
    expect((await requestCode(request, email)).status()).toBe(200);
    const code = await readCode(email);
    for (let i = 0; i < 4; i++) {
      expect((await verifyCode(request, email, wrongCodeFor(code))).status()).toBe(401);
    }
    expect((await verifyCode(request, email, code)).status()).toBe(200);
  });

  test('asking for a new code withdraws the old one', async ({ request }) => {
    const email = uniqueEmail('newest');
    expect((await requestCode(request, email)).status()).toBe(200);
    const first = await readCode(email, 1);
    expect((await requestCode(request, email)).status()).toBe(200);
    const second = await readCode(email, 2);
    // (The two codes are random and may, one time in a million, be equal.)
    test.skip(first === second, 'both codes happened to be equal');
    expect((await verifyCode(request, email, first)).status()).toBe(401);
    expect((await verifyCode(request, email, second)).status()).toBe(200);
  });

  test('a code for one address does not open another', async ({ request }) => {
    const mine = uniqueEmail('mine');
    const theirs = uniqueEmail('theirs');
    expect((await requestCode(request, mine)).status()).toBe(200);
    expect((await requestCode(request, theirs)).status()).toBe(200);
    const myCode = await readCode(mine);
    const theirCode = await readCode(theirs);
    test.skip(myCode === theirCode, 'both codes happened to be equal');
    expect((await verifyCode(request, theirs, myCode)).status()).toBe(401);
  });

  test('one network may ask for three codes for an address in the window, not four', async ({ request }) => {
    const email = uniqueEmail('per-email');
    const ip = uniqueIp();
    for (let i = 0; i < 3; i++) {
      expect((await requestCode(request, email, { ip })).status(), `request ${i + 1}`).toBe(200);
    }
    const fourth = await requestCode(request, email, { ip });
    expect(fourth.status()).toBe(429);
    expect((await fourth.json()).error).toBe('too_many_requests');
    // The refused request issued nothing.
    expect(sql(`SELECT COUNT(*) FROM email_login_codes WHERE email = '${email}'`)).toBe('3');
  });

  test('one client address may ask for ten codes in the window, not eleven', async ({ request }) => {
    const ip = uniqueIp();
    for (let i = 0; i < 10; i++) {
      expect((await requestCode(request, uniqueEmail('per-ip'), { ip })).status(), `request ${i + 1}`).toBe(200);
    }
    const eleventh = await requestCode(request, uniqueEmail('per-ip'), { ip });
    expect(eleventh.status()).toBe(429);
    expect((await eleventh.json()).error).toBe('too_many_requests');
    // Another client is not affected.
    expect((await requestCode(request, uniqueEmail('per-ip-other'))).status()).toBe(200);
  });

  test('the answer does not reveal whether an address has an account', async ({ request }) => {
    const known = uniqueEmail('known');
    expect((await requestCode(request, known)).status()).toBe(200);
    expect((await verifyCode(request, known, await readCode(known))).status()).toBe(200);
    expect(sql(`SELECT COUNT(*) FROM users WHERE email = '${known}'`)).toBe('1');

    const forKnown = await requestCode(request, known);
    const forUnknown = await requestCode(request, uniqueEmail('unknown'));
    expect(forKnown.status()).toBe(forUnknown.status());
    expect(await forKnown.text()).toBe(await forUnknown.text());

    // Nor does a wrong code: same answer with and without an account.
    const wrongKnown = await verifyCode(request, known, wrongCodeFor(await readCode(known, 2)));
    const neverAsked = await verifyCode(request, uniqueEmail('never-asked'), '123456');
    expect(wrongKnown.status()).toBe(neverAsked.status());
    expect(await wrongKnown.text()).toBe(await neverAsked.text());
  });

  test('no address is accepted without an age tier of adult or teen', async ({ request }) => {
    for (const ageTier of [null, 'unknown', 'blocked', 'child', '']) {
      const email = uniqueEmail('age');
      const res = await requestCode(request, email, { ageTier });
      expect(res.status(), `age_tier=${JSON.stringify(ageTier)}`).toBe(403);
      expect((await res.json()).error).toBe('age_required');
      expect(sql(`SELECT COUNT(*) FROM email_login_codes WHERE email = '${email}'`)).toBe('0');
      expect(loggedCodes(email)).toEqual([]);
    }
  });

  test('a malformed address is refused', async ({ request }) => {
    for (const bad of ['not-an-email', 'a@b', 'two@@example.test', 'x@example.test,y@example.test']) {
      const res = await requestCode(request, bad);
      expect(res.status(), bad).toBe(400);
      expect((await res.json()).error).toBe('invalid_email');
    }
  });

  test('an account made with Google is reached by its email, whatever its case', async ({ request }) => {
    const tag = unique();
    const stored = `Legacy.${tag}@Example.test`;
    const username = `legacy${tag}`.slice(0, 32);
    const id = sql(
      `INSERT INTO users (username, email, google_id, google_email, auth_provider) ` +
      `VALUES ('${username}', '${stored}', 'google-${tag}', '${stored}', 'google') RETURNING id`,
    ).split('\n')[0];

    const typed = stored.toLowerCase();
    expect((await requestCode(request, typed)).status()).toBe(200);
    const verified = await verifyCode(request, typed, await readCode(typed));
    expect(verified.status()).toBe(200);
    const body = await verified.json();
    expect(body.user.id).toBe(id);
    expect(body.user.username).toBe(username);
    expect(body.is_new_user).toBe(false);
    // No second account was made for the lower-cased spelling.
    expect(sql(`SELECT COUNT(*) FROM users WHERE lower(email) = '${typed}'`)).toBe('1');
  });
});

// ---------------------------------------------------------------------------
// Session endpoints
// ---------------------------------------------------------------------------

test.describe('Session API', () => {
  test('me and the passkey routes need a session', async ({ request }) => {
    const anonymous = await request.get(`${API}/auth/me`);
    expect(anonymous.status()).toBe(401);
    expect((await anonymous.json()).error).toBe('not_signed_in');

    for (const [method, route] of [
      ['post', '/auth/passkey/register/begin'],
      ['get', '/auth/passkeys'],
      ['delete', '/auth/passkeys/00000000-0000-0000-0000-000000000000'],
    ] as const) {
      const res = await request[method](`${API}${route}`);
      expect(res.status(), route).toBe(401);
    }
    const finish = await request.post(`${API}/auth/passkey/register/finish`, {
      data: {
        challenge_id: '00000000-0000-0000-0000-000000000000',
        credential: { id: 'AA', rawId: 'AA', type: 'public-key', response: { attestationObject: 'AA', clientDataJSON: 'AA' } },
      },
    });
    expect(finish.status()).toBe(401);
  });

  test('a forged session cookie is refused', async ({ request, playwright }) => {
    // A real account, so that only the signature stands between a forger and its session.
    const email = uniqueEmail('forge');
    expect((await requestCode(request, email)).status()).toBe(200);
    const { user } = await (await verifyCode(request, email, await readCode(email))).json();

    const sessionToken = (secret: string) => {
      const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
      const now = Math.floor(Date.now() / 1000);
      const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, username: user.username, sid, iat: now, exp: now + 3600 })}`;
      return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
    };
    // The token names the server-side session the sign-in above created.
    const sid = sql(`SELECT id FROM auth_sessions WHERE user_id = '${user.id}'`);
    expect(sid).toMatch(/^[0-9a-f-]{36}$/);
    // A context of its own: no cookie from the sign-in above rides along.
    const anonymous = await playwright.request.newContext();
    const meWith = (token: string) =>
      anonymous.get(`${API}/auth/me`, { headers: { Cookie: `im_token=${token}` } });

    // Control: the same token signed with the server's (test) secret is a valid session,
    // so the refusals below are about the signature and nothing else.
    const genuine = await meWith(sessionToken(E2E_JWT_SECRET));
    expect(genuine.status()).toBe(200);
    expect((await genuine.json()).user.id).toBe(user.id);

    expect((await meWith(sessionToken('some-other-secret'))).status()).toBe(401);
    expect((await meWith('not.a.token')).status()).toBe(401);
    // The old development secret, which every checkout used to fall back to, signs nothing.
    expect((await meWith(sessionToken('dev-secret-change-in-production'))).status()).toBe(401);
    await anonymous.dispose();
  });

  test('Google sign-in is gone', async ({ request }) => {
    const res = await request.post(`${API}/auth/google`, { data: { id_token: 'x' } });
    expect(res.status()).toBe(404);
  });

  test('a passkey sign-in cannot be finished without a live challenge', async ({ request }) => {
    const res = await request.post(`${API}/auth/passkey/login/finish`, {
      data: {
        challenge_id: '00000000-0000-0000-0000-000000000000',
        credential: {
          id: 'AA', rawId: 'AA', type: 'public-key',
          response: { authenticatorData: 'AA', clientDataJSON: 'AA', signature: 'AA', userHandle: 'AA' },
        },
      },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBe('challenge_expired');
  });
});

// ---------------------------------------------------------------------------
// The whole flow in a browser
// ---------------------------------------------------------------------------

test.describe('Sign-in UI', () => {
  test('email code signs in, a passkey is added, and the passkey then signs in alone', async ({ page }) => {
    const email = uniqueEmail('flow');
    await page.goto('/');
    const { cdp, authenticatorId } = await addVirtualAuthenticator(page);

    // 1. Create the account with an emailed code.
    await signInByEmailUi(page, email);
    await expect(page.locator('#user-badge')).toBeVisible();
    const afterEmail = await me(page);
    expect(afterEmail.status()).toBe(200);
    const account = (await afterEmail.json()).user;
    expect(account.email).toBe(email);

    // 2. The passkey offer follows an email sign-in. Accept it.
    await expect(page.locator('#auth-passkey-offer')).toBeVisible();
    await expect(page.locator('#auth-passkey-offer')).toContainText('Add a passkey to this device');
    await page.locator('#auth-passkey-add').click();
    await expect(page.locator('#auth-user-menu')).toBeVisible();
    await expect(page.locator('#auth-passkey-list li')).toHaveCount(1);
    await expect(page.locator('#auth-menu-message')).toContainText('Passkey added');

    // The authenticator holds a discoverable credential for this account and this RP.
    const { credentials } = await cdp.send('WebAuthn.getCredentials', { authenticatorId });
    expect(credentials).toHaveLength(1);
    expect(credentials[0].isResidentCredential).toBe(true);
    expect(credentials[0].rpId).toBe('localhost');
    // Its user handle is the account id (a UUID as 16 raw bytes).
    const handleHex = Buffer.from(credentials[0].userHandle!, 'base64').toString('hex');
    expect(handleHex).toBe(account.id.replace(/-/g, ''));
    expect(sql(`SELECT COUNT(*) FROM webauthn_credentials WHERE user_id = '${account.id}'`)).toBe('1');

    // 3. Sign out: the session is gone.
    await page.locator('#auth-logout-btn').click();
    await expect(page.locator('#auth-btn')).toBeVisible();
    await expect(page.locator('#user-badge')).toBeHidden();
    expect((await me(page)).status()).toBe(401);

    // 4. Sign in with the passkey alone: no email, no username typed.
    await openSignIn(page);
    const finishRequest = page.waitForRequest((r) => r.url().endsWith('/auth/passkey/login/finish'));
    await page.locator('#auth-passkey-btn').click();
    await expect(page.locator('#user-badge')).toBeVisible();
    const afterPasskey = await me(page);
    expect(afterPasskey.status()).toBe(200);
    const again = await afterPasskey.json();
    expect(again.user.id).toBe(account.id);
    expect(again.passkey_count).toBe(1);
    expect(sql(`SELECT last_used_at IS NOT NULL FROM webauthn_credentials WHERE user_id = '${account.id}'`)).toBe('t');

    // 5. The signed assertion cannot be replayed: its challenge was used up.
    const replay = await page.request.post(`${API}/auth/passkey/login/finish`, {
      data: JSON.parse((await finishRequest).postData()!),
    });
    expect(replay.status()).toBe(400);
    expect((await replay.json()).error).toBe('challenge_expired');

    // 6. The session survives a reload (the cookie, not page state, carries it).
    await page.reload();
    await expect(page.locator('#user-badge')).toBeVisible();
  });

  test('a removed passkey no longer signs in', async ({ page }) => {
    const email = uniqueEmail('remove');
    await page.goto('/');
    await addVirtualAuthenticator(page);
    await signInByEmailUi(page, email);
    await page.locator('#auth-passkey-add').click();
    await expect(page.locator('#auth-passkey-list li')).toHaveCount(1);

    // Remove it from the signed-in menu: first click asks, second click removes.
    const remove = page.locator('#auth-passkey-list li button');
    await remove.click();
    await expect(remove).toHaveText('Remove?');
    await expect(page.locator('#auth-passkey-list li')).toHaveCount(1);
    await remove.click();
    await expect(page.locator('#auth-passkey-list li')).toHaveCount(0);
    await expect(page.locator('#auth-passkey-empty')).toBeVisible();
    expect(sql(`SELECT COUNT(*) FROM webauthn_credentials c JOIN users u ON u.id = c.user_id WHERE u.email = '${email}'`)).toBe('0');

    await page.locator('#auth-logout-btn').click();
    await expect(page.locator('#auth-btn')).toBeVisible();

    // The authenticator still holds the credential and signs happily; the server refuses it.
    await openSignIn(page);
    await page.locator('#auth-passkey-btn').click();
    await expect(page.locator('#auth-error')).toBeVisible();
    await expect(page.locator('#auth-error')).toContainText('not accepted');
    await expect(page.locator('#user-badge')).toBeHidden();
    expect((await me(page)).status()).toBe(401);
  });

  test('declining the passkey offer leaves the account signed in with none', async ({ page }) => {
    const email = uniqueEmail('skip');
    await page.goto('/');
    await addVirtualAuthenticator(page);
    await signInByEmailUi(page, email);
    await expect(page.locator('#auth-passkey-offer')).toBeVisible();
    await page.locator('#auth-passkey-skip').click();
    await expect(page.locator('#auth-dropdown')).toBeHidden();
    await expect(page.locator('#user-badge')).toBeVisible();

    // The menu still lets the passkey be added later.
    await page.locator('#user-badge').click();
    await expect(page.locator('#auth-user-menu')).toBeVisible();
    await expect(page.locator('#auth-passkey-empty')).toBeVisible();
    await expect(page.locator('#auth-passkey-list li')).toHaveCount(0);
    await page.locator('#auth-passkey-add-menu').click();
    await expect(page.locator('#auth-passkey-list li')).toHaveCount(1);
  });

  test('a wrong code shows an error and does not sign in', async ({ page }) => {
    const email = uniqueEmail('wrong-ui');
    await page.goto('/');
    await openSignIn(page);
    await page.locator('#auth-email-btn').click();
    await page.locator('#auth-email-input').fill(email);
    await page.locator('#auth-email-send').click();
    await expect(page.locator('#auth-step-code')).toBeVisible();
    const code = await readCode(email);
    await page.locator('#auth-code-input').fill(wrongCodeFor(code));
    await page.locator('#auth-code-verify').click();
    await expect(page.locator('#auth-error')).toBeVisible();
    await expect(page.locator('#auth-error')).toContainText('not right');
    await expect(page.locator('#user-badge')).toBeHidden();
    expect((await me(page)).status()).toBe(401);

    // The right code still works afterwards.
    await page.locator('#auth-code-input').fill(code);
    await page.locator('#auth-code-verify').click();
    await expect(page.locator('#user-badge')).toBeVisible();
  });

  test('with no authenticator, the passkey button reports it and nobody is signed in', async ({ page }) => {
    await page.goto('/');
    // WebAuthn is on, but the only authenticator has no credential for this site.
    await addVirtualAuthenticator(page);
    await openSignIn(page);
    await page.locator('#auth-passkey-btn').click();
    await expect(page.locator('#auth-error, #auth-notice').filter({ visible: true })).toHaveCount(1);
    await expect(page.locator('#user-badge')).toBeHidden();
    expect((await me(page)).status()).toBe(401);
  });

  test('a browser without WebAuthn gets email sign-in only, and no passkey offer', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'PublicKeyCredential', { value: undefined, configurable: true });
    });
    const email = uniqueEmail('nowebauthn');
    await page.goto('/');
    await openSignIn(page);
    await expect(page.locator('#auth-passkey-btn')).toBeHidden();
    await expect(page.locator('#auth-create-btn')).toBeHidden();
    await expect(page.locator('#auth-passkey-unsupported')).toBeVisible();
    await expect(page.locator('#auth-email-btn')).toBeVisible();

    await page.locator('#auth-email-btn').click();
    await page.locator('#auth-email-input').fill(email);
    await page.locator('#auth-email-send').click();
    await expect(page.locator('#auth-step-code')).toBeVisible();
    await page.locator('#auth-code-input').fill(await readCode(email));
    await page.locator('#auth-code-verify').click();
    await expect(page.locator('#user-badge')).toBeVisible();
    await expect(page.locator('#auth-passkey-offer')).toBeHidden();

    await page.locator('#user-badge').click();
    await expect(page.locator('#auth-user-menu')).toBeVisible();
    await expect(page.locator('#auth-passkey-add-menu')).toBeHidden();
  });
});

// ---------------------------------------------------------------------------
// Age gate: no email address from a visitor of unknown age or under 13
// ---------------------------------------------------------------------------

test.describe('Sign-in and the age gate', () => {
  // Start with no stored age. /about is a legal page: the gate does not cover it, so the
  // sign-in menu is reachable there by a visitor who has not passed the gate.
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const stored of [null, 'blocked', 'teen']) {
    test(`age state ${JSON.stringify(stored)}: the email step is refused and nothing is sent`, async ({ page }) => {
      if (stored) {
        await page.addInitScript((value) => localStorage.setItem('inspired-mile-age-verified', value), stored);
      }
      const emailCalls: string[] = [];
      page.on('request', (r) => {
        if (r.url().includes('/auth/email/') || r.url().includes('/auth/passkey/signup/')) emailCalls.push(r.url());
      });

      await page.goto('/about');
      await addVirtualAuthenticator(page);
      await openSignIn(page);

      // Creating an account with a passkey is refused the same way, at the button...
      await page.locator('#auth-create-btn').click();
      await expect(page.locator('#auth-notice')).toContainText('confirm your age');
      await expect(page.locator('#auth-step-create')).toBeHidden();
      // ...and again by the function behind it, if the hidden step is revealed by hand.
      await page.evaluate(() => {
        document.getElementById('auth-step-choose')!.classList.add('hidden');
        document.getElementById('auth-step-create')!.classList.remove('hidden');
      });
      await page.locator('#auth-create-confirm').click();
      await expect(page.locator('#auth-error')).toContainText('confirm your age');
      await expect(page.locator('#user-badge')).toBeHidden();
      expect(emailCalls).toEqual([]);
      await page.evaluate(() => {
        document.getElementById('auth-step-create')!.classList.add('hidden');
        document.getElementById('auth-step-choose')!.classList.remove('hidden');
      });

      await expect(page.locator('#auth-email-btn')).toBeVisible();
      await page.locator('#auth-email-btn').click();

      await expect(page.locator('#auth-notice')).toBeVisible();
      await expect(page.locator('#auth-notice')).toContainText('confirm your age');
      // No field to type an address into, and no request made.
      await expect(page.locator('#auth-step-email')).toBeHidden();
      await expect(page.locator('#auth-email-input')).toBeHidden();
      expect(emailCalls).toEqual([]);

      // Second line of defence: get past the button anyway (reveal the hidden form by
      // hand and submit an address). The sender itself must refuse, before any request.
      await page.evaluate(() => {
        document.getElementById('auth-notice')!.classList.add('hidden');
        document.getElementById('auth-step-choose')!.classList.add('hidden');
        document.getElementById('auth-step-email')!.classList.remove('hidden');
      });
      await page.locator('#auth-email-input').fill(uniqueEmail('underage'));
      await page.locator('#auth-email-send').click();
      await expect(page.locator('#auth-error')).toBeVisible();
      await expect(page.locator('#auth-error')).toContainText('confirm your age');
      await expect(page.locator('#auth-step-code')).toBeHidden();
      expect(emailCalls).toEqual([]);
    });
  }

  for (const stored of ['adult', 'teen-consented']) {
    test(`age state "${stored}": the email step opens`, async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem('inspired-mile-age-verified', value), stored);
      await page.goto('/about');
      await openSignIn(page);
      await page.locator('#auth-email-btn').click();
      await expect(page.locator('#auth-step-email')).toBeVisible();
      await expect(page.locator('#auth-email-input')).toBeVisible();
      await expect(page.locator('#auth-notice')).toBeHidden();
    });
  }

  test('a teen with consent signs in and the account is stored as teen', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('inspired-mile-age-verified', 'teen-consented'));
    const email = uniqueEmail('teen');
    await page.goto('/about');
    const sent = page.waitForRequest((r) => r.url().endsWith('/auth/email/request'));
    await signInByEmailUi(page, email);
    expect(JSON.parse((await sent).postData()!)).toEqual({ email, age_tier: 'teen' });
    await expect(page.locator('#user-badge')).toBeVisible();
    expect(sql(`SELECT age_tier FROM users WHERE email = '${email}'`)).toBe('teen');
  });

  test('the age gate still covers the home page for a visitor of unknown age', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#age-gate')).toBeVisible();
    // The gate sits above the navigation, sign-in button included.
    const topmost = await page.evaluate(() => {
      const btn = document.getElementById('auth-btn')!.getBoundingClientRect();
      const el = document.elementFromPoint(btn.left + btn.width / 2, btn.top + btn.height / 2);
      return el ? !!el.closest('#age-gate') : false;
    });
    expect(topmost).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Accounts made with a passkey alone
// ---------------------------------------------------------------------------

/** POST JSON from inside the page, with the page's own session cookie. */
async function postFromPage(page: Page, route: string, body: unknown) {
  return page.evaluate(async ([url, data]) => {
    const res = await fetch(url as string, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  }, [`/api/v1${route}`, body] as const);
}

async function createAccountWithPasskey(page: Page) {
  await openSignIn(page);
  await page.locator('#auth-create-btn').click();
  await expect(page.locator('#auth-step-create')).toBeVisible();
  await page.locator('#auth-create-confirm').click();
  await expect(page.locator('#auth-recovery-nudge')).toBeVisible();
}

async function signOutUi(page: Page) {
  if (await page.locator('#auth-dropdown').isHidden()) await page.locator('#user-badge').click();
  await page.locator('#auth-logout-btn').click();
  await expect(page.locator('#auth-btn')).toBeVisible();
}

function signupBegin(request: APIRequestContext, opts: { ip?: string; ageTier?: string | null; base?: string } = {}) {
  const data: Record<string, unknown> = {};
  if (opts.ageTier !== null) data.age_tier = opts.ageTier ?? 'adult';
  return request.post(`${opts.base ?? API_NO_EMAIL}/auth/passkey/signup/begin`, {
    data,
    headers: { 'CF-Connecting-IP': opts.ip ?? uniqueIp() },
  });
}

test.describe('Passkey-only accounts, with email off', () => {
  test('sign up, sign out, sign in, add a second passkey, delete the first: no email anywhere', async ({ page }) => {
    await page.goto(`${NO_EMAIL_WEB}/`);
    const first = await addVirtualAuthenticator(page);
    const { cdp } = first;
    const usersBefore = Number(sql('SELECT COUNT(*) FROM users'));

    // 1. Create the account. The warning comes before the account does.
    await openSignIn(page);
    await page.locator('#auth-create-btn').click();
    await expect(page.locator('#auth-step-create')).toBeVisible();
    await expect(page.locator('#auth-create-warning')).toContainText('add a second passkey so you can get back in');
    expect(await page.locator('#auth-step-create').innerText()).not.toMatch(/or an e-?mail/i);
    const begin = page.waitForRequest((r) => r.url().endsWith('/auth/passkey/signup/begin'));
    const finish = page.waitForRequest((r) => r.url().endsWith('/auth/passkey/signup/finish'));
    await page.locator('#auth-create-confirm').click();
    // All that is sent to start an account is the age tier: no name, no address.
    expect(JSON.parse((await begin).postData()!)).toEqual({ age_tier: 'adult' });
    expect(Object.keys(JSON.parse((await finish).postData()!)).sort()).toEqual(['challenge_id', 'credential', 'name']);

    // 2. Signed in at once, and told plainly that one passkey is the only way in.
    await expect(page.locator('#auth-recovery-nudge')).toBeVisible();
    await expect(page.locator('#auth-nudge-body')).toContainText('one passkey is the only way into this account');
    await expect(page.locator('#auth-nudge-body')).toContainText('Add a second passkey so you can get back in');
    await expect(page.locator('#auth-nudge-email')).toBeHidden();
    await expect(page.locator('#user-badge')).toBeVisible();
    const created = await (await me(page)).json();
    expect(created.user.email).toBeNull();
    expect(created.user.auth_provider).toBe('passkey');
    expect(created.user.username).toMatch(/^bard-[0-9a-f]{12}$/);
    expect(created.passkey_count).toBe(1);
    const id = created.user.id;
    expect(Number(sql('SELECT COUNT(*) FROM users'))).toBe(usersBefore + 1);
    expect(sql(`SELECT email IS NULL, age_tier, display_name IS NULL, avatar_url IS NULL FROM users WHERE id = '${id}'`)).toBe('t|adult|t|t');
    // The authenticator's user handle is the new account's id.
    const held = await cdp.send('WebAuthn.getCredentials', { authenticatorId: first.authenticatorId });
    expect(held.credentials).toHaveLength(1);
    expect(held.credentials[0].isResidentCredential).toBe(true);
    expect(Buffer.from(held.credentials[0].userHandle!, 'base64').toString('hex')).toBe(id.replace(/-/g, ''));

    // 3. "Later": the menu keeps the warning, shows no email section, and will not
    //    delete the only passkey.
    await page.locator('#auth-nudge-later').click();
    await expect(page.locator('#auth-dropdown')).toBeHidden();
    await page.locator('#user-badge').click();
    await expect(page.locator('#auth-user-menu')).toBeVisible();
    await expect(page.locator('#auth-passkey-list li')).toHaveCount(1);
    await expect(page.locator('#auth-recovery-warning')).toBeVisible();
    await expect(page.locator('#auth-recovery-warning')).toContainText('One passkey is your only way in');
    await expect(page.locator('#auth-email-section')).toBeHidden();
    expect(await page.locator('#auth-user-menu').innerText()).not.toMatch(/e-?mail/i);
    const onlyRemove = page.locator('#auth-passkey-list li button');
    await onlyRemove.click();
    await onlyRemove.click();
    await expect(page.locator('#auth-menu-message')).toContainText('only way to sign in');
    await expect(page.locator('#auth-passkey-list li')).toHaveCount(1);
    expect(sql(`SELECT COUNT(*) FROM webauthn_credentials WHERE user_id = '${id}'`)).toBe('1');
    // Email cannot be added here either: the server has no way to send a code.
    expect((await postFromPage(page, '/auth/email/add/request', { email: uniqueEmail('nomail') })).status).toBe(503);

    // 4. Sign out, then sign in with the passkey alone.
    await signOutUi(page);
    expect((await me(page)).status()).toBe(401);
    await openSignIn(page);
    await page.locator('#auth-passkey-btn').click();
    await expect(page.locator('#user-badge')).toBeVisible();
    expect((await (await me(page)).json()).user.id).toBe(id);

    // 5. Add a second passkey, on another authenticator.
    await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId: first.authenticatorId });
    const second = await cdp.send('WebAuthn.addVirtualAuthenticator', {
      options: { protocol: 'ctap2', transport: 'usb', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
    });
    await page.locator('#user-badge').click();
    await expect(page.locator('#auth-passkey-list li')).toHaveCount(1);
    await page.locator('#auth-passkey-add-menu').click();
    await expect(page.locator('#auth-passkey-list li')).toHaveCount(2);
    await expect(page.locator('#auth-recovery-warning')).toBeHidden();
    expect(sql(`SELECT COUNT(*) FROM webauthn_credentials WHERE user_id = '${id}'`)).toBe('2');

    // 6. Now the first passkey can go.
    const firstRemove = page.locator('#auth-passkey-list li').first().locator('button');
    await firstRemove.click();
    await firstRemove.click();
    await expect(page.locator('#auth-passkey-list li')).toHaveCount(1);
    await expect(page.locator('#auth-recovery-warning')).toBeVisible();
    expect(sql(`SELECT COUNT(*) FROM webauthn_credentials WHERE user_id = '${id}'`)).toBe('1');

    // 7. The second passkey signs in to the same account.
    await signOutUi(page);
    await openSignIn(page);
    await page.locator('#auth-passkey-btn').click();
    await expect(page.locator('#user-badge')).toBeVisible();
    expect((await (await me(page)).json()).user.id).toBe(id);
    const used = await cdp.send('WebAuthn.getCredentials', { authenticatorId: second.authenticatorId });
    expect(used.credentials[0].signCount).toBeGreaterThan(0);
  });

  test('an account cannot be started without an age tier of adult or teen', async ({ request }) => {
    const attemptsBefore = sql('SELECT COUNT(*) FROM signup_attempts');
    const challengesBefore = sql("SELECT COUNT(*) FROM auth_challenges WHERE kind = 'signup'");
    for (const ageTier of [null, 'unknown', 'blocked', 'child', '']) {
      const res = await signupBegin(request, { ageTier });
      expect(res.status(), `age_tier=${JSON.stringify(ageTier)}`).toBe(403);
      expect((await res.json()).error).toBe('age_required');
    }
    expect(sql('SELECT COUNT(*) FROM signup_attempts')).toBe(attemptsBefore);
    expect(sql("SELECT COUNT(*) FROM auth_challenges WHERE kind = 'signup'")).toBe(challengesBefore);
  });

  test('nothing is written to users unless the passkey verifies', async ({ request }) => {
    const usersBefore = sql('SELECT COUNT(*) FROM users');
    const begun = await signupBegin(request, { ageTier: 'teen' });
    expect(begun.status()).toBe(200);
    const { challenge_id, options } = await begun.json();
    // Usernameless and discoverable, with a random handle and a generated name.
    expect(options.authenticatorSelection.residentKey).toBe('required');
    expect(options.user.name).toMatch(/^bard-[0-9a-f]{12}$/);
    expect(sql('SELECT COUNT(*) FROM users')).toBe(usersBefore);
    expect(sql(`SELECT kind, user_id IS NULL FROM auth_challenges WHERE id = '${challenge_id}'`)).toBe('signup|t');

    const bogus = {
      challenge_id,
      credential: { id: 'AA', rawId: 'AA', type: 'public-key', response: { attestationObject: 'AA', clientDataJSON: 'AA' } },
    };
    const refused = await request.post(`${API_NO_EMAIL}/auth/passkey/signup/finish`, { data: bogus });
    expect(refused.status()).toBe(400);
    expect((await refused.json()).error).toBe('passkey_not_registered');
    expect(refused.headers()['set-cookie']).toBeUndefined();
    expect(sql('SELECT COUNT(*) FROM users')).toBe(usersBefore);
    expect(sql(`SELECT COUNT(*) FROM users WHERE username = '${options.user.name}'`)).toBe('0');

    // The challenge was used up by that attempt.
    const again = await request.post(`${API_NO_EMAIL}/auth/passkey/signup/finish`, { data: bogus });
    expect(again.status()).toBe(400);
    expect((await again.json()).error).toBe('challenge_expired');
  });

  test('a sign-up challenge that has expired creates nothing', async ({ page }) => {
    await page.goto(`${NO_EMAIL_WEB}/`);
    await addVirtualAuthenticator(page);
    const usersBefore = sql('SELECT COUNT(*) FROM users');

    // The ceremony by hand, so the challenge can be aged between its two halves.
    const begun = await postFromPage(page, '/auth/passkey/signup/begin', { age_tier: 'adult' });
    expect(begun.status).toBe(200);
    sql(`UPDATE auth_challenges SET expires_at = NOW() - INTERVAL '1 second' WHERE id = '${begun.body.challenge_id}'`);
    const credential = await page.evaluate(async (options) => {
      const publicKey = (PublicKeyCredential as any).parseCreationOptionsFromJSON(options);
      const made = (await navigator.credentials.create({ publicKey })) as any;
      return made.toJSON();
    }, begun.body.options);
    // A genuine passkey for this very challenge: only its age is wrong.
    const finished = await postFromPage(page, '/auth/passkey/signup/finish', {
      challenge_id: begun.body.challenge_id, credential, name: 'late',
    });
    expect(finished.status).toBe(400);
    expect(finished.body.error).toBe('challenge_expired');
    expect(sql('SELECT COUNT(*) FROM users')).toBe(usersBefore);
    expect((await me(page)).status()).toBe(401);

    // Control: the same steps without the ageing do create the account.
    const fresh = await postFromPage(page, '/auth/passkey/signup/begin', { age_tier: 'adult' });
    const freshCredential = await page.evaluate(async (options) => {
      const publicKey = (PublicKeyCredential as any).parseCreationOptionsFromJSON(options);
      const made = (await navigator.credentials.create({ publicKey })) as any;
      return made.toJSON();
    }, fresh.body.options);
    const ok = await postFromPage(page, '/auth/passkey/signup/finish', {
      challenge_id: fresh.body.challenge_id, credential: freshCredential, name: 'in time',
    });
    expect(ok.status).toBe(200);
    expect(Number(sql('SELECT COUNT(*) FROM users'))).toBe(Number(usersBefore) + 1);
  });

  test('begun sign-ups do not use up the account budget: the forty-first begin is still served', async ({ request }) => {
    // A class behind one address where pupils cancel the prompt and try again. Begins used
    // to count against the forty an hour, so the school was locked out by its own retries.
    const ip = uniqueIp();
    for (let i = 0; i < 41; i++) {
      expect((await signupBegin(request, { ip })).status(), `begin ${i + 1}`).toBe(200);
    }
    const key = ip.replace(/\.\d+$/, '.0/24');
    expect(sql(`SELECT COUNT(*) FILTER (WHERE NOT completed), COUNT(*) FILTER (WHERE completed) FROM signup_attempts WHERE ip = '${key}'`)).toBe('41|0');
  });

  test('begins are still bounded: two hundred an hour from one network', async ({ request }) => {
    const ip = uniqueIp();
    const key = ip.replace(/\.\d+$/, '.0/24');
    // 199 on record (written directly: only their count matters), then one real begin.
    sql(`INSERT INTO signup_attempts (ip, completed) SELECT '${key}', FALSE FROM generate_series(1, 199)`);
    expect((await signupBegin(request, { ip })).status()).toBe(200);
    const over = await signupBegin(request, { ip });
    expect(over.status()).toBe(429);
    expect((await over.json()).error).toBe('too_many_requests');
    expect((await signupBegin(request)).status()).toBe(200);
  });

  test('a browser without WebAuthn is told so, with no mention of email', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'PublicKeyCredential', { value: undefined, configurable: true });
    });
    await page.goto(`${NO_EMAIL_WEB}/`);
    await openSignIn(page);
    await expect(page.locator('#auth-passkey-btn')).toBeHidden();
    await expect(page.locator('#auth-create-btn')).toBeHidden();
    await expect(page.locator('#auth-email-btn')).toBeHidden();
    await expect(page.locator('#auth-passkey-unsupported')).toBeVisible();
    await expect(page.locator('#auth-passkey-unsupported')).toContainText('cannot use passkeys');
    expect(await page.locator('#auth-passkey-unsupported').innerText()).not.toMatch(/e-?mail/i);
  });
});

test.describe('Passkey-only accounts, with email on', () => {
  test('a recovery email is stored only after its code comes back, and then unlocks the last passkey', async ({ page, request }) => {
    await page.goto('/');
    await addVirtualAuthenticator(page);
    await createAccountWithPasskey(page);
    const id = (await (await me(page)).json()).user.id;
    await expect(page.locator('#auth-nudge-body')).toContainText('Add a second passkey or an email so you can get back in');
    await expect(page.locator('#auth-nudge-email')).toBeVisible();

    // A code issued for signing in does not add an email.
    const address = uniqueEmail('recovery');
    expect((await requestCode(request, address)).status()).toBe(200);
    const loginCode = await readCode(address, 1);
    expect((await postFromPage(page, '/auth/email/add/verify', { email: address, code: loginCode })).status).toBe(401);
    expect(sql(`SELECT email IS NULL FROM users WHERE id = '${id}'`)).toBe('t');

    // An address that is already another account's: the code is sent all the same, and
    // only someone holding that code learns the address is taken.
    const taken = uniqueEmail('taken');
    expect((await requestCode(request, taken)).status()).toBe(200);
    expect((await verifyCode(request, taken, await readCode(taken, 1))).status()).toBe(200);
    const askTaken = await postFromPage(page, '/auth/email/add/request', { email: taken });
    const askFree = await postFromPage(page, '/auth/email/add/request', { email: uniqueEmail('free') });
    expect(askTaken).toEqual(askFree);
    expect(askTaken.status).toBe(200);
    const refused = await postFromPage(page, '/auth/email/add/verify', { email: taken, code: await readCode(taken, 2) });
    expect(refused.status).toBe(409);
    expect(refused.body.error).toBe('email_in_use');
    expect(sql(`SELECT email IS NULL FROM users WHERE id = '${id}'`)).toBe('t');

    // Through the UI: asking stores nothing; the code does.
    await page.locator('#auth-nudge-email').click();
    await expect(page.locator('#auth-add-email-form')).toBeVisible();
    await page.locator('#auth-add-email-input').fill(address);
    await page.locator('#auth-add-email-send').click();
    await expect(page.locator('#auth-add-code-form')).toBeVisible();
    await expect(page.locator('#auth-add-code-intro')).toContainText(address);
    expect(sql(`SELECT email IS NULL FROM users WHERE id = '${id}'`)).toBe('t');
    const addCode = await readCode(address, 2);
    await page.locator('#auth-add-code-input').fill(wrongCodeFor(addCode));
    await page.locator('#auth-add-code-verify').click();
    await expect(page.locator('#auth-email-message')).toContainText('not right');
    expect(sql(`SELECT email IS NULL FROM users WHERE id = '${id}'`)).toBe('t');
    await page.locator('#auth-add-code-input').fill(addCode);
    await page.locator('#auth-add-code-verify').click();
    await expect(page.locator('#auth-email-message')).toContainText('Email added');
    await expect(page.locator('#auth-recovery-email')).toHaveText(address);
    await expect(page.locator('#auth-recovery-warning')).toBeHidden();
    expect(sql(`SELECT email FROM users WHERE id = '${id}'`)).toBe(address);

    // With a verified email as the way back, the last passkey may be removed...
    const remove = page.locator('#auth-passkey-list li button');
    await remove.click();
    await remove.click();
    await expect(page.locator('#auth-passkey-list li')).toHaveCount(0);

    // ...and the email signs in to the same account.
    await signOutUi(page);
    await signInByEmailUi(page, address);
    await expect(page.locator('#user-badge')).toBeVisible();
    const back = await (await me(page)).json();
    expect(back.user.id).toBe(id);
    expect(back.user.email).toBe(address);
  });

  test('adding an email needs a session', async ({ request }) => {
    const ask = await request.post(`${API}/auth/email/add/request`, { data: { email: uniqueEmail('anon') } });
    expect(ask.status()).toBe(401);
    const confirm = await request.post(`${API}/auth/email/add/verify`, { data: { email: uniqueEmail('anon'), code: '123456' } });
    expect(confirm.status()).toBe(401);
  });
});

// ===========================================================================
// Security hardening (review of 2026-11-16). Every test below failed on main as it stood
// before the fixes; what each one is about is in its first comment.
// ===========================================================================

const INTERNAL_MESSAGE = 'Something went wrong on our side. Please try again.';

/** An account made by emailed code, straight through the API, with its session cookie. */
async function emailAccount(ageTier: 'adult' | 'teen' = 'adult', email = uniqueEmail('acct')) {
  // Counted before asking: the new code is the next one the log shows for this address.
  const before = loggedCodes(email).length;
  const asked = await requestCode(null as never, email, { ageTier });
  expect(asked.status()).toBe(200);
  const verified = await verifyCode(null as never, email, await readCode(email, before + 1));
  expect(verified.status()).toBe(200);
  const token = verified.cookie('im_token');
  expect(token, 'the sign-in sets the session cookie').toBeTruthy();
  return { email, user: (await verified.json()).user, cookie: `im_token=${token}` };
}

/** Any request from inside the page, with the page's own cookies. */
async function fetchFromPage(page: Page, method: string, route: string, body?: unknown) {
  return page.evaluate(async ([m, url, data]) => {
    const res = await fetch(url as string, {
      method: m as string,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: data === null ? undefined : JSON.stringify(data),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  }, [method, `/api/v1${route}`, body ?? null] as const);
}

/**
 * Make a passkey for a begun registration, with the page's virtual authenticator.
 *
 * Chrome's virtual authenticator holds only a few discoverable credentials (the fourth
 * create fails with NotAllowedError). A test that makes many accounts passes `forget`: the
 * authenticator then drops the credential once the attestation exists, which is all the
 * server needs to finish the sign-up. Such an account cannot be signed in to again.
 */
async function createCredential(page: Page, options: unknown, forget?: Authenticator) {
  const credential = await page.evaluate(async (o) => {
    const publicKey = (PublicKeyCredential as any).parseCreationOptionsFromJSON(o);
    const made = (await navigator.credentials.create({ publicKey })) as any;
    return made.toJSON();
  }, options);
  if (forget) await forget.cdp.send('WebAuthn.clearCredentials', { authenticatorId: forget.authenticatorId });
  return credential;
}

/** Sign up with a passkey through the API, from inside the page. */
async function signUpFromPage(page: Page, forget?: Authenticator) {
  const begun = await postFromPage(page, '/auth/passkey/signup/begin', { age_tier: 'adult' });
  if (begun.status !== 200) return begun;
  const credential = await createCredential(page, begun.body.options, forget);
  return postFromPage(page, '/auth/passkey/signup/finish', {
    challenge_id: begun.body.challenge_id, credential, name: 'e2e',
  });
}

/** Make the page's session look as if its user last proved who they are `minutes` ago. */
function ageProof(userId: string, minutes: number) {
  sql(`UPDATE auth_sessions SET verified_at = NOW() - INTERVAL '${minutes} minutes' WHERE user_id = '${userId}'`);
}

const meStatus = async (cookie: string) => (await call('GET', `${API}/auth/me`, { cookie })).status();

// ---------------------------------------------------------------------------
// Start-up: no session secret, no server
// ---------------------------------------------------------------------------

test.describe('Hardening: the session secret', () => {
  /** Start the real binary with this environment and report how it ended. */
  function startApi(env: Record<string, string>) {
    const bin = readFileSync(path.join(E2E.workDir, 'api-bin'), 'utf8').trim();
    expect(existsSync(bin), `${bin} (written by tests/start-backend.sh)`).toBe(true);
    // An empty working directory: no .env to pick a secret up from.
    const cwd = execFileSync('mktemp', ['-d'], { encoding: 'utf8' }).trim();
    const done = spawnSync(bin, [], {
      cwd,
      env: {
        PATH: process.env.PATH ?? '',
        // Nothing listens here: a server that gets past its configuration fails at the database.
        DATABASE_URL: 'postgres://nobody@127.0.0.1:9/none',
        PORT: '9',
        WEBAUTHN_RP_ID: 'localhost',
        WEBAUTHN_ORIGIN: 'http://localhost:4399',
        ...env,
      },
      encoding: 'utf8',
      timeout: 20000,
    });
    return { status: done.status, stderr: done.stderr ?? '' };
  }

  test('the API refuses to start without a JWT_SECRET, with a short one, or with the old constant', async () => {
    const none = startApi({});
    expect(none.status).toBe(2);
    expect(none.stderr).toContain('FATAL: invalid configuration');
    expect(none.stderr).toContain('JWT_SECRET is not set');

    const old = startApi({ JWT_SECRET: 'dev-secret-change-in-production' });
    expect(old.status).toBe(2);
    expect(old.stderr).toContain('old development constant');

    const short = startApi({ JWT_SECRET: 'only-thirty-one-bytes-long-0123' });
    expect(short.status).toBe(2);
    expect(short.stderr).toContain('at least 32');

    // Control: with a real secret the configuration is accepted, and the process goes on
    // to fail at the database instead (nothing listens on that port).
    const good = startApi({ JWT_SECRET: E2E_JWT_SECRET });
    expect(good.stderr).not.toContain('invalid configuration');
    expect(good.status).not.toBe(2);
    expect(good.stderr).toMatch(/Failed to connect to PostgreSQL/);
  });

  test('the development flag lifts the rule on localhost only', async () => {
    const dev = startApi({ DEV_INSECURE_JWT_SECRET: '1' });
    expect(dev.stderr).not.toContain('invalid configuration');
    expect(dev.stderr).toContain('using a random secret');
    expect(dev.stderr).toMatch(/Failed to connect to PostgreSQL/);

    const prod = startApi({
      DEV_INSECURE_JWT_SECRET: '1',
      WEBAUTHN_RP_ID: 'inspiredmile.com',
      WEBAUTHN_ORIGIN: 'https://sonnetman.inspiredmile.com',
    });
    expect(prod.status).toBe(2);
    expect(prod.stderr).toContain('local development');
  });

  test('email codes are hashed with a key of their own, not the session secret', async ({ request }) => {
    const email = uniqueEmail('hmac');
    expect((await requestCode(request, email)).status()).toBe(200);
    const code = await readCode(email);
    const stored = sql(`SELECT code_hash FROM email_login_codes WHERE email = '${email}'`);
    const mac = (key: string) =>
      createHmac('sha256', key).update(`inspired-mile:email-code:v1\0${email}\0${code}`).digest('hex');
    // What main stored: the code's HMAC under the very secret that signs sessions.
    expect(stored).not.toBe(mac(E2E_JWT_SECRET));
    // What is stored now: the HMAC under a key derived from it for this purpose alone.
    const derived = createHmac('sha256', E2E_JWT_SECRET).update('inspired-mile:derived-key:v1\0email-code').digest('hex');
    expect(stored).toBe(mac(derived));
  });
});

// ---------------------------------------------------------------------------
// Sessions end on the server
// ---------------------------------------------------------------------------

test.describe('Hardening: sessions end on the server', () => {
  test('a correctly signed token is refused unless it names a live session', async () => {
    const { user } = await emailAccount();
    const token = (claims: object) => {
      const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
      const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(claims)}`;
      return `im_token=${body}.${createHmac('sha256', E2E_JWT_SECRET).update(body).digest('base64url')}`;
    };
    const now = Math.floor(Date.now() / 1000);
    const base = { sub: user.id, username: user.username, iat: now, exp: now + 3600 };
    const sid = sql(`SELECT id FROM auth_sessions WHERE user_id = '${user.id}'`);

    // Control: with the real session id, the hand-made token works.
    expect(await meStatus(token({ ...base, sid }))).toBe(200);
    // The shape of every token issued before sessions were kept server-side.
    expect(await meStatus(token(base))).toBe(401);
    // A session that never existed.
    expect(await meStatus(token({ ...base, sid: '00000000-0000-4000-8000-000000000000' }))).toBe(401);
    // Somebody else's session id does not make a token for this user.
    const other = await emailAccount();
    const otherSid = sql(`SELECT id FROM auth_sessions WHERE user_id = '${other.user.id}'`);
    expect(await meStatus(token({ ...base, sid: otherSid }))).toBe(401);
    // And the routes behind the middleware check the same thing.
    expect((await call('GET', `${API}/credits`, { cookie: token(base) })).status()).toBe(401);
    expect((await call('GET', `${API}/credits`, { cookie: token({ ...base, sid }) })).status()).toBe(200);
  });

  test('signing out ends the session for a copy of the cookie too', async () => {
    const { user, cookie } = await emailAccount();
    expect(await meStatus(cookie)).toBe(200);
    expect((await call('GET', `${API}/credits`, { cookie })).status()).toBe(200);

    const out = await call('POST', `${API}/auth/logout`, { cookie, headers: { 'Content-Type': 'application/json' } });
    expect(out.status()).toBe(200);
    expect(out.headers()['set-cookie']).toMatch(/im_token=;.*Max-Age=0/);

    // The cookie value was never thrown away by this "browser": it must be dead anyway.
    expect(await meStatus(cookie)).toBe(401);
    expect((await call('GET', `${API}/credits`, { cookie })).status()).toBe(401);
    expect(sql(`SELECT revoked_at IS NOT NULL FROM auth_sessions WHERE user_id = '${user.id}'`)).toBe('t');
  });

  test('"sign out everywhere" ends every session of the account, and nobody else\'s', async () => {
    const first = await emailAccount();
    const second = await emailAccount('adult', first.email);
    expect(second.user.id).toBe(first.user.id);
    expect(second.cookie).not.toBe(first.cookie);
    const bystander = await emailAccount();

    // Signing out of one browser leaves the other signed in...
    const one = await call('POST', `${API}/auth/logout`, { cookie: first.cookie, headers: { 'Content-Type': 'application/json' } });
    expect(one.status()).toBe(200);
    expect(await meStatus(first.cookie)).toBe(401);
    expect(await meStatus(second.cookie)).toBe(200);

    // ...and "everywhere" ends them all.
    const third = await emailAccount('adult', first.email);
    const all = await call('POST', `${API}/auth/logout/all`, { cookie: second.cookie, headers: { 'Content-Type': 'application/json' } });
    expect(all.status()).toBe(200);
    expect(await meStatus(second.cookie)).toBe(401);
    expect(await meStatus(third.cookie)).toBe(401);
    expect(await meStatus(bystander.cookie)).toBe(200);
    expect((await call('POST', `${API}/auth/logout/all`, { headers: { 'Content-Type': 'application/json' } })).status()).toBe(401);
  });

  test('the menu\'s "sign out on every device" signs out another browser', async ({ page }) => {
    const email = uniqueEmail('everywhere');
    await page.goto('/');
    await signInByEmailUi(page, email);
    await expect(page.locator('#user-badge')).toBeVisible();
    const elsewhere = await emailAccount('adult', email);
    expect(await meStatus(elsewhere.cookie)).toBe(200);

    if (await page.locator('#auth-passkey-offer').isVisible()) await page.locator('#auth-passkey-skip').click();
    await page.locator('#user-badge').click();
    await expect(page.locator('#auth-logout-all-btn')).toBeVisible();
    await expect(page.locator('#auth-logout-all-btn')).toHaveText('Sign out on every device');
    await page.locator('#auth-logout-all-btn').click();
    await expect(page.locator('#auth-btn')).toBeVisible();
    expect((await me(page)).status()).toBe(401);
    expect(await meStatus(elsewhere.cookie)).toBe(401);
  });

  test('removing a passkey ends the account\'s other sessions and keeps this one', async ({ page }) => {
    const email = uniqueEmail('lost-device');
    await page.goto('/');
    await addVirtualAuthenticator(page);
    await signInByEmailUi(page, email);
    await page.locator('#auth-passkey-add').click();
    await expect(page.locator('#auth-passkey-list li')).toHaveCount(1);
    const elsewhere = await emailAccount('adult', email);
    expect(await meStatus(elsewhere.cookie)).toBe(200);

    const remove = page.locator('#auth-passkey-list li button');
    await remove.click();
    await remove.click();
    await expect(page.locator('#auth-passkey-list li')).toHaveCount(0);
    expect(await meStatus(elsewhere.cookie)).toBe(401);
    expect((await me(page)).status()).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// A session cookie alone does not change how an account is signed in to
// ---------------------------------------------------------------------------

test.describe('Hardening: a fresh proof before sign-in methods change', () => {
  test('a stale session can neither add nor remove a passkey; a passkey check makes it fresh', async ({ page }) => {
    // The shared-computer case: signed in a while ago, and somebody else is at the keyboard.
    await page.goto(`${NO_EMAIL_WEB}/`);
    await addVirtualAuthenticator(page);
    const created = await signUpFromPage(page);
    expect(created.status).toBe(200);
    const id = created.body.user.id;
    const passkeyId = sql(`SELECT id FROM webauthn_credentials WHERE user_id = '${id}'`);

    // Just signed up: the session is fresh, and beginning a registration is allowed.
    expect((await fetchFromPage(page, 'POST', '/auth/passkey/register/begin')).status).toBe(200);

    ageProof(id, 6);
    const add = await fetchFromPage(page, 'POST', '/auth/passkey/register/begin');
    expect(add.status).toBe(403);
    expect(add.body.error).toBe('reauth_required');
    const del = await fetchFromPage(page, 'DELETE', `/auth/passkeys/${passkeyId}`);
    expect(del.status).toBe(403);
    expect(del.body.error).toBe('reauth_required');
    expect(sql(`SELECT COUNT(*) FROM webauthn_credentials WHERE user_id = '${id}'`)).toBe('1');
    // Everything else still works: the session itself is not in doubt.
    expect((await me(page)).status()).toBe(200);
    expect((await fetchFromPage(page, 'GET', '/auth/passkeys')).status).toBe(200);

    // The proof: an assertion by a passkey of this account, with user verification.
    const begun = await fetchFromPage(page, 'POST', '/auth/passkey/verify/begin');
    expect(begun.status).toBe(200);
    expect(begun.body.options.userVerification).toBe('required');
    expect(begun.body.options.allowCredentials).toHaveLength(1);
    const assertion = await page.evaluate(async (o) => {
      const publicKey = (PublicKeyCredential as any).parseRequestOptionsFromJSON(o);
      const got = (await navigator.credentials.get({ publicKey })) as any;
      return got.toJSON();
    }, begun.body.options);
    const finished = await fetchFromPage(page, 'POST', '/auth/passkey/verify/finish', {
      challenge_id: begun.body.challenge_id, credential: assertion,
    });
    expect(finished.status).toBe(200);
    expect(finished.body).toEqual({ ok: true, fresh_for_seconds: 300 });
    // Single use, like every other ceremony.
    const replay = await fetchFromPage(page, 'POST', '/auth/passkey/verify/finish', {
      challenge_id: begun.body.challenge_id, credential: assertion,
    });
    expect(replay.status).toBe(400);

    expect((await fetchFromPage(page, 'POST', '/auth/passkey/register/begin')).status).toBe(200);
    // Still the last passkey with email off, so it stays; but the refusal is no longer about proof.
    const last = await fetchFromPage(page, 'DELETE', `/auth/passkeys/${passkeyId}`);
    expect(last.status).toBe(409);
    expect(last.body.error).toBe('last_sign_in_method');
  });

  test('in the menu, a stale session is asked for its passkey before one is removed', async ({ page }) => {
    await page.goto(`${NO_EMAIL_WEB}/`);
    const first = await addVirtualAuthenticator(page);
    const { cdp } = first;
    await createAccountWithPasskey(page);
    const id = (await (await me(page)).json()).user.id;
    await page.locator('#auth-nudge-later').click();
    await page.locator('#user-badge').click();
    await expect(page.locator('#auth-passkey-list li')).toHaveCount(1);

    // A second passkey on a second authenticator, added while the sign-up is still fresh:
    // no proof is asked for.
    await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId: first.authenticatorId });
    const second = await cdp.send('WebAuthn.addVirtualAuthenticator', {
      options: { protocol: 'ctap2', transport: 'usb', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
    });
    const proofs: string[] = [];
    page.on('request', (r) => { if (r.url().includes('/auth/passkey/verify/')) proofs.push(r.url()); });
    await page.locator('#auth-passkey-add-menu').click();
    await expect(page.locator('#auth-passkey-list li')).toHaveCount(2);
    expect(proofs).toEqual([]);

    // Later, the same browser, the same cookie: removing a passkey now asks for one first.
    ageProof(id, 30);
    const proof = page.waitForResponse((r) => r.url().endsWith('/auth/passkey/verify/finish'));
    const remove = page.locator('#auth-passkey-list li').first().locator('button');
    await remove.click();
    await remove.click();
    expect((await proof).status()).toBe(200);
    await expect(page.locator('#auth-passkey-list li')).toHaveCount(1);
    expect(sql(`SELECT COUNT(*) FROM webauthn_credentials WHERE user_id = '${id}'`)).toBe('1');
    // The proof was an assertion by the passkey that is present: its counter moved.
    const { credentials } = await cdp.send('WebAuthn.getCredentials', { authenticatorId: second.authenticatorId });
    expect(credentials[0].signCount).toBeGreaterThan(0);
    expect(sql(`SELECT verified_at > NOW() - INTERVAL '1 minute' FROM auth_sessions WHERE user_id = '${id}' AND revoked_at IS NULL`)).toBe('t');
  });

  test('without the passkey there is no proof: a stale session with no authenticator cannot add one', async ({ page }) => {
    await page.goto(`${NO_EMAIL_WEB}/`);
    const { cdp, authenticatorId } = await addVirtualAuthenticator(page);
    await createAccountWithPasskey(page);
    const id = (await (await me(page)).json()).user.id;
    await page.locator('#auth-nudge-later').click();
    await page.locator('#user-badge').click();

    // The owner's authenticator leaves with the owner; a stranger brings their own.
    await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
    await cdp.send('WebAuthn.addVirtualAuthenticator', {
      options: { protocol: 'ctap2', transport: 'usb', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
    });
    ageProof(id, 30);
    await page.locator('#auth-passkey-add-menu').click();
    await expect(page.locator('#auth-menu-message')).toBeVisible();
    await expect(page.locator('#auth-passkey-list li')).toHaveCount(1);
    expect(sql(`SELECT COUNT(*) FROM webauthn_credentials WHERE user_id = '${id}'`)).toBe('1');
  });

  test('adding a recovery email needs the proof too, and an email-only account has none to give', async ({ page }) => {
    await page.goto('/');
    await addVirtualAuthenticator(page);
    await createAccountWithPasskey(page);
    const id = (await (await me(page)).json()).user.id;

    ageProof(id, 6);
    const address = uniqueEmail('stale-add');
    const refused = await postFromPage(page, '/auth/email/add/request', { email: address });
    expect(refused.status).toBe(403);
    expect(refused.body.error).toBe('reauth_required');
    expect(sql(`SELECT COUNT(*) FROM email_login_codes WHERE email = '${address}'`)).toBe('0');
    expect(loggedCodes(address)).toEqual([]);

    // Through the menu the passkey is asked for, and then the code is sent.
    const proof = page.waitForResponse((r) => r.url().endsWith('/auth/passkey/verify/finish'));
    await page.locator('#auth-nudge-email').click();
    await page.locator('#auth-add-email-input').fill(address);
    await page.locator('#auth-add-email-send').click();
    expect((await proof).status()).toBe(200);
    await expect(page.locator('#auth-add-code-form')).toBeVisible();
    await readCode(address);

    // An account with no passkey at all: its proof is a new emailed code, so a stale
    // session gets no further.
    const emailOnly = await emailAccount();
    ageProof(emailOnly.user.id, 6);
    const add = await call('POST', `${API}/auth/passkey/register/begin`, { cookie: emailOnly.cookie, body: {} });
    expect(add.status()).toBe(403);
    expect((await add.json()).error).toBe('reauth_required');
    const verify = await call('POST', `${API}/auth/passkey/verify/begin`, { cookie: emailOnly.cookie, body: {} });
    expect(verify.status()).toBe(409);
    expect((await verify.json()).error).toBe('reauth_unavailable');
    // Signing in again by code is that proof.
    const back = await emailAccount('adult', emailOnly.email);
    expect((await call('POST', `${API}/auth/passkey/register/begin`, { cookie: back.cookie, body: {} })).status()).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Cookie and sign-out
// ---------------------------------------------------------------------------

test.describe('Hardening: the cookie and sign-out', () => {
  test('a form posted from another site cannot sign anyone out', async () => {
    const { cookie } = await emailAccount();
    // What an auto-submitting <form method="post"> on another site produces.
    const form = await call('POST', `${API}/auth/logout`, {
      cookie, body: '', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    expect(form.status()).toBe(403);
    expect((await form.json()).error).toBe('cross_site_request');
    // Not even a clearing cookie comes back: that alone would sign the browser out.
    expect(form.headers()['set-cookie']).toBeUndefined();

    const plain = await call('POST', `${API}/auth/logout`, { cookie, body: 'x', headers: { 'Content-Type': 'text/plain' } });
    expect(plain.status()).toBe(403);
    expect(plain.headers()['set-cookie']).toBeUndefined();
    const bare = await call('POST', `${API}/auth/logout`, { cookie });
    expect(bare.status()).toBe(403);
    // A browser labels a cross-site request; that label is refused whatever else it carries.
    const labelled = await call('POST', `${API}/auth/logout`, {
      cookie, headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'cross-site' },
    });
    expect(labelled.status()).toBe(403);
    const everywhere = await call('POST', `${API}/auth/logout/all`, {
      cookie, body: '', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    expect(everywhere.status()).toBe(403);

    // Through all of that the session lived.
    expect(await meStatus(cookie)).toBe(200);
    // The page's own request (JSON content type, same origin) does sign out.
    const own = await call('POST', `${API}/auth/logout`, {
      cookie, headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin' },
    });
    expect(own.status()).toBe(200);
    expect(await meStatus(cookie)).toBe(401);
  });

  test('the session cookie is HttpOnly, Secure, SameSite=Strict and host-only', async () => {
    const email = uniqueEmail('cookie');
    expect((await requestCode(null as never, email)).status()).toBe(200);
    const verified = await verifyCode(null as never, email, await readCode(email));
    const line = (verified.headers()['set-cookie'] ?? '').split('\n').find((l) => l.startsWith('im_token=')) ?? '';
    const attributes = line.split(';').slice(1).map((a) => a.trim().toLowerCase());
    expect(attributes).toContain('httponly');
    expect(attributes).toContain('secure');
    expect(attributes).toContain('samesite=strict');
    expect(attributes).toContain('path=/');
    expect(attributes.some((a) => a.startsWith('domain='))).toBe(false);
    // (On an https origin the name carries the __Host- prefix; browsers refuse that prefix
    // over http, so here, on localhost, it is the plain name. The unit tests cover the choice.)
  });
});

// ---------------------------------------------------------------------------
// Whose address is it, and how wide is a limit
// ---------------------------------------------------------------------------

test.describe('Hardening: client address and limits by network', () => {
  test('ten codes an hour for a whole IPv6 /64, not for each of its addresses', async ({ request }) => {
    const hex = () => (1 + Math.floor(Math.random() * 0xfffe)).toString(16);
    const net = `2001:db8:${hex()}:${hex()}`;
    for (let i = 1; i <= 10; i++) {
      const res = await requestCode(request, uniqueEmail('v6'), { ip: `${net}:${hex()}:${hex()}:${hex()}:${i.toString(16)}` });
      expect(res.status(), `request ${i}`).toBe(200);
    }
    // An eleventh address in the same /64 is the same client.
    const over = await requestCode(request, uniqueEmail('v6'), { ip: `${net}:ffff:ffff:ffff:ffff` });
    expect(over.status()).toBe(429);
    expect((await over.json()).error).toBe('too_many_requests');
    // The neighbouring /64 is somebody else.
    const neighbour = uniqueEmail('v6-other');
    expect((await requestCode(request, neighbour, { ip: `2001:db8:${hex()}:1::1` })).status()).toBe(200);
    expect(sql(`SELECT DISTINCT ip FROM email_login_codes WHERE email LIKE 'v6-%' AND ip LIKE '${net}%'`)).toBe(`${net}::/64`);
  });

  test('forwarding headers are believed from a trusted proxy and ignored from anyone else', async ({ request }) => {
    // The test APIs trust loopback, as production trusts the hosts its proxies are on:
    // through it, the header names the client.
    const viaProxy = uniqueEmail('proxy');
    const claimed = uniqueIp();
    expect((await requestCode(request, viaProxy, { ip: claimed })).status()).toBe(200);
    expect(sql(`SELECT ip FROM email_login_codes WHERE email = '${viaProxy}'`)).toBe(claimed);

    // The same binary on the same database, told that its only proxy is somewhere else.
    // This test's requests then come from a peer that is not a proxy, which is what any
    // device on the LAN or the tailnet is when it talks to the port directly.
    const bin = readFileSync(path.join(E2E.workDir, 'api-bin'), 'utf8').trim();
    const port = await new Promise<number>((resolve, reject) => {
      const probe = net.createServer();
      probe.once('error', reject);
      probe.listen(0, '127.0.0.1', () => {
        const { port: free } = probe.address() as net.AddressInfo;
        probe.close(() => resolve(free));
      });
    });
    // Warnings from tracing go to stdout, start-up notices to stderr: both are "the log".
    let log = '';
    const api = spawn(bin, [], {
      cwd: path.resolve('backend'),
      env: {
        PATH: process.env.PATH ?? '',
        DATABASE_URL: `postgres://${E2E.dbUser}@127.0.0.1:${E2E.pgPort}/${E2E.dbName}`,
        JWT_SECRET: E2E_JWT_SECRET,
        PORT: String(port),
        CORS_ORIGIN: E2E.webOrigin,
        WEBAUTHN_RP_ID: 'localhost',
        WEBAUTHN_ORIGIN: E2E.webOrigin,
        DEV_EMAIL_LOG: '1',
        RATE_LIMIT_PER_MINUTE: '100000',
        DB_MAX_CONNECTIONS: '3',
        TRUSTED_PROXIES: '203.0.113.99',
        RUST_LOG: 'warn',
        NO_COLOR: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    api.stdout!.on('data', (chunk) => { log += String(chunk); });
    api.stderr!.on('data', (chunk) => { log += String(chunk); });
    try {
      await expect
        .poll(async () => {
          try { return (await fetch(`http://127.0.0.1:${port}/api/v1/health`)).status; } catch { return 0; }
        }, { message: `the second API should come up on :${port}`, timeout: 30000 })
        .toBe(200);

      const direct = uniqueEmail('direct');
      const spoofed = uniqueIp();
      const res = await call('POST', `http://127.0.0.1:${port}/api/v1/auth/email/request`, {
        body: { email: direct, age_tier: 'adult' },
        headers: { 'CF-Connecting-IP': spoofed, 'X-Forwarded-For': spoofed },
      });
      expect(res.status()).toBe(200);
      // Counted against the socket's address, whatever the headers claimed.
      expect(sql(`SELECT ip FROM email_login_codes WHERE email = '${direct}'`)).toBe('127.0.0.1');
      // And the server says which peer it did not believe, so a proxy left out of
      // TRUSTED_PROXIES by mistake is found in the log, not by its visitors.
      await expect.poll(() => log).toContain('not in TRUSTED_PROXIES');
      expect(log).toMatch(/ignored CF-Connecting-IP \/ X-Forwarded-For from 127\.0\.0\.1/);
    } finally {
      api.kill('SIGTERM');
    }
  });
});

// ---------------------------------------------------------------------------
// Sign-up accounting
// ---------------------------------------------------------------------------

test.describe('Hardening: sign-up accounting', () => {
  test('forty accounts an hour for one /24, counted when created and checked under a lock', async ({ page }) => {
    test.setTimeout(180000);
    const n = () => 1 + Math.floor(Math.random() * 253);
    const subnet = `10.${n()}.${n()}`;
    const key = `${subnet}.0/24`;
    // The browser's address for the whole test, set before the page exists.
    await page.context().setExtraHTTPHeaders({ 'CF-Connecting-IP': `${subnet}.7` });
    await page.goto(`${NO_EMAIL_WEB}/`);
    const authenticator = await addVirtualAuthenticator(page);

    // Thirty-eight accounts.
    for (let i = 1; i <= 38; i++) {
      const made = await signUpFromPage(page, authenticator);
      expect(made.status, `sign-up ${i}`).toBe(200);
    }
    expect(sql(`SELECT COUNT(*) FROM signup_attempts WHERE ip = '${key}' AND completed`)).toBe('38');

    // Four more get as far as a verified passkey, then finish at the same moment. Two
    // places are left; a count-then-insert without a lock would let all four in.
    const pending: { challenge_id: string; credential: unknown; name: string }[] = [];
    for (let i = 39; i <= 42; i++) {
      const begun = await postFromPage(page, '/auth/passkey/signup/begin', { age_tier: 'adult' });
      expect(begun.status, `begin ${i}`).toBe(200);
      pending.push({
        challenge_id: begun.body.challenge_id,
        credential: await createCredential(page, begun.body.options, authenticator),
        name: 'race',
      });
    }
    const usersBefore = Number(sql('SELECT COUNT(*) FROM users'));
    const statuses = await page.evaluate(async (bodies) => Promise.all(bodies.map(async (body) => {
      const res = await fetch('/api/v1/auth/passkey/signup/finish', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      return res.status;
    })), pending);
    expect([...statuses].sort()).toEqual([200, 200, 429, 429]);
    expect(Number(sql('SELECT COUNT(*) FROM users'))).toBe(usersBefore + 2);
    expect(sql(`SELECT COUNT(*) FROM signup_attempts WHERE ip = '${key}' AND completed`)).toBe('40');

    // The network is now refused before the prompt, also from an address of the /24 that
    // has not been used yet (the budget is the network's, not the address's)...
    for (const address of [`${subnet}.7`, `${subnet}.250`]) {
      const over = await call('POST', `${API_NO_EMAIL}/auth/passkey/signup/begin`, {
        body: { age_tier: 'adult' }, headers: { 'CF-Connecting-IP': address },
      });
      expect(over.status(), address).toBe(429);
      expect((await over.json()).error).toBe('too_many_requests');
    }
    // ...and the /24 next door is not.
    const nextDoor = await call('POST', `${API_NO_EMAIL}/auth/passkey/signup/begin`, {
      body: { age_tier: 'adult' }, headers: { 'CF-Connecting-IP': `10.${n()}.254.7` },
    });
    expect(nextDoor.status()).toBe(200);
  });

  test('a site-wide ceiling stops sign-ups for everyone, and says so loudly in the log', async ({ request }) => {
    // Other tests in this file sign up; they run before or after this one, never during.
    const marker = `ceiling-${unique()}`;
    try {
      sql(`INSERT INTO signup_attempts (ip, completed) SELECT '${marker}', TRUE FROM generate_series(1, 300)`);
      const refused = await signupBegin(request, { base: API });
      expect(refused.status()).toBe(429);
      const body = await refused.json();
      expect(body.error).toBe('too_many_requests');
      expect(body.message).toContain('right now');
      await expect.poll(() => readFileSync(API_LOG, 'utf8')).toContain('SIGN-UP CEILING HIT');
      expect(readFileSync(API_LOG, 'utf8')).toContain('SIGNUP_GLOBAL_PER_HOUR = 300');
    } finally {
      sql(`DELETE FROM signup_attempts WHERE ip = '${marker}'`);
    }
    // One below the ceiling is still served.
    expect((await signupBegin(request, { base: API })).status()).toBe(200);
  });

  test('a passkey-only account that never played is deleted after thirty days; one that did, or was used, is not', async ({ page }) => {
    test.setTimeout(90000);
    await page.goto(`${NO_EMAIL_WEB}/`);
    const authenticator = await addVirtualAuthenticator(page);
    const make = async () => {
      const made = await signUpFromPage(page, authenticator);
      expect(made.status).toBe(200);
      return made.body.user.id as string;
    };
    const unused = await make();
    const played = await make();
    const usedLately = await make();
    const young = await make();

    sql(`UPDATE player_stats SET total_battles = 1 WHERE user_id = '${played}'`);
    // Credentials first, accounts last: the sweep runs every few seconds here, and must
    // never see an account that is old before the rest of its story is in place.
    sql(`UPDATE webauthn_credentials SET created_at = NOW() - INTERVAL '31 days', last_used_at = NULL WHERE user_id IN ('${unused}', '${played}')`);
    sql(`UPDATE webauthn_credentials SET created_at = NOW() - INTERVAL '31 days', last_used_at = NOW() - INTERVAL '2 days' WHERE user_id = '${usedLately}'`);
    sql(`UPDATE users SET created_at = NOW() - INTERVAL '31 days' WHERE id IN ('${unused}', '${played}', '${usedLately}')`);

    await expect
      .poll(() => sql(`SELECT COUNT(*) FROM users WHERE id = '${unused}'`), {
        message: 'the unused account should be swept (MAINTENANCE_INTERVAL_SECONDS is 3 in the tests)',
        timeout: 30000,
      })
      .toBe('0');
    // Everything of it went with it.
    expect(sql(`SELECT COUNT(*) FROM webauthn_credentials WHERE user_id = '${unused}'`)).toBe('0');
    expect(sql(`SELECT COUNT(*) FROM auth_sessions WHERE user_id = '${unused}'`)).toBe('0');
    // Two more sweeps, and the others are all still there.
    await page.waitForTimeout(7000);
    expect(sql(`SELECT COUNT(*) FROM users WHERE id IN ('${played}', '${usedLately}', '${young}')`)).toBe('3');
  });
});

// ---------------------------------------------------------------------------
// Age tier
// ---------------------------------------------------------------------------

test.describe('Hardening: age tier', () => {
  test('a teen account cannot make itself an adult one; an adult one can be made teen', async () => {
    const teen = await emailAccount('teen');
    const limits = async (cookie: string) => (await call('GET', `${API}/credits/limits`, { cookie })).json();
    expect((await limits(teen.cookie)).daily_limit).toBe(200);

    const lift = await call('POST', `${API}/credits/age-verify`, { cookie: teen.cookie, body: { age_tier: 'adult' } });
    expect(lift.status()).toBe(200);
    expect(await lift.json()).toEqual({ status: 'unchanged', age_tier: 'teen' });
    expect(sql(`SELECT age_tier FROM users WHERE id = '${teen.user.id}'`)).toBe('teen');
    expect((await limits(teen.cookie)).daily_limit).toBe(200);

    const adult = await emailAccount('adult');
    expect((await limits(adult.cookie)).daily_limit).toBeNull();
    const same = await call('POST', `${API}/credits/age-verify`, { cookie: adult.cookie, body: { age_tier: 'adult' } });
    expect(await same.json()).toEqual({ status: 'ok', age_tier: 'adult' });
    const stricter = await call('POST', `${API}/credits/age-verify`, { cookie: adult.cookie, body: { age_tier: 'teen' } });
    expect(await stricter.json()).toEqual({ status: 'ok', age_tier: 'teen' });
    expect((await limits(adult.cookie)).daily_limit).toBe(200);
    // And there is no way back.
    const back = await call('POST', `${API}/credits/age-verify`, { cookie: adult.cookie, body: { age_tier: 'adult' } });
    expect(await back.json()).toEqual({ status: 'unchanged', age_tier: 'teen' });
    expect(sql(`SELECT age_tier FROM users WHERE id = '${adult.user.id}'`)).toBe('teen');

    // An account from before the age gate takes the first answer it is given.
    sql(`UPDATE users SET age_tier = 'unknown' WHERE id = '${teen.user.id}'`);
    const first = await call('POST', `${API}/credits/age-verify`, { cookie: teen.cookie, body: { age_tier: 'adult' } });
    expect(await first.json()).toEqual({ status: 'ok', age_tier: 'adult' });
  });

  test('a teen who re-enters an adult birth date in the browser stays a teen on the server', async ({ page }) => {
    const email = uniqueEmail('teen-sync');
    await page.goto('/about');
    await page.evaluate(() => localStorage.setItem('inspired-mile-age-verified', 'teen-consented'));
    await page.reload();
    await signInByEmailUi(page, email);
    await expect(page.locator('#user-badge')).toBeVisible();
    expect(sql(`SELECT age_tier FROM users WHERE email = '${email}'`)).toBe('teen');

    // Clear site data, give an adult date, come back: the page posts "adult" on load.
    await page.evaluate(() => localStorage.setItem('inspired-mile-age-verified', 'adult'));
    const synced = page.waitForResponse((r) => r.url().endsWith('/credits/age-verify'));
    await page.reload();
    const answer = await synced;
    expect(JSON.parse(answer.request().postData()!)).toEqual({ age_tier: 'adult' });
    expect(await answer.json()).toEqual({ status: 'unchanged', age_tier: 'teen' });
    expect(sql(`SELECT age_tier FROM users WHERE email = '${email}'`)).toBe('teen');
  });
});

// ---------------------------------------------------------------------------
// What a failure says, and who may read a class
// ---------------------------------------------------------------------------

test.describe('Hardening: error text and classroom lists', () => {
  test('a database failure is answered without the database\'s own words', async () => {
    const { user, cookie } = await emailAccount();
    // Take away the row the credits routes update: the statement then fails in the database.
    sql(`DELETE FROM player_stats WHERE user_id = '${user.id}'`);
    const res = await call('POST', `${API}/credits/earn`, { cookie, body: { source: 'daily' } });
    expect(res.status()).toBe(500);
    const text = await res.text();
    expect(text).toBe(INTERNAL_MESSAGE);
    expect(text).not.toMatch(/DB error|row|query|sqlx|database/i);
  });

  test('a classroom\'s members and assignments are for its teacher and its members only', async () => {
    const teacher = await emailAccount();
    const pupil = await emailAccount('teen');
    const outsider = await emailAccount();

    const made = await call('POST', `${API}/classroom`, { cookie: teacher.cookie, body: { name: `Class ${unique()}` } });
    expect(made.status()).toBe(200);
    const room = await made.json();
    expect((await call('POST', `${API}/classroom/${room.id}/assignments`, {
      cookie: teacher.cookie, body: { title: 'Sonnet 18', assignment_type: 'trivia' },
    })).status()).toBe(200);
    expect((await call('POST', `${API}/classroom/join`, { cookie: pupil.cookie, body: { code: room.join_code } })).status()).toBe(200);

    for (const list of ['members', 'assignments']) {
      const refused = await call('GET', `${API}/classroom/${room.id}/${list}`, { cookie: outsider.cookie });
      expect(refused.status(), `${list} for an outsider`).toBe(403);
      expect(await refused.text()).not.toContain(pupil.user.username);
      // A classroom that does not exist answers the same, so ids in use cannot be told apart.
      expect((await call('GET', `${API}/classroom/2000000000/${list}`, { cookie: outsider.cookie })).status()).toBe(403);
    }

    for (const who of [teacher, pupil]) {
      const members = await call('GET', `${API}/classroom/${room.id}/members`, { cookie: who.cookie });
      expect(members.status()).toBe(200);
      expect((await members.json()).map((m: { user_id: string }) => m.user_id).sort()).toEqual([teacher.user.id, pupil.user.id].sort());
      const assignments = await call('GET', `${API}/classroom/${room.id}/assignments`, { cookie: who.cookie });
      expect(assignments.status()).toBe(200);
      expect((await assignments.json()).map((a: { title: string }) => a.title)).toEqual(['Sonnet 18']);
    }
  });
});

// ---------------------------------------------------------------------------
// Email codes: guessing is bounded, and strangers cannot get in the way
// ---------------------------------------------------------------------------

test.describe('Hardening: email codes', () => {
  test('a code is only good in the browser that asked for it', async ({ request }) => {
    const email = uniqueEmail('bound');
    expect((await requestCode(request, email)).status()).toBe(200);
    const code = await readCode(email);
    // Somebody who has seen the code (over a shoulder, read out on the phone) but is in
    // another browser: refused, and the code is not used up by the try.
    const elsewhere = await verifyCode(request, email, code, API, { cookie: null });
    expect(elsewhere.status()).toBe(401);
    expect((await elsewhere.json()).error).toBe('invalid_code');
    expect((await verifyCode(request, email, code, API, { cookie: '0123456789abcdef0123456789abcdef' })).status()).toBe(401);
    expect(sql(`SELECT attempts, consumed_at IS NULL FROM email_login_codes WHERE email = '${email}'`)).toBe('0|t');
    expect((await verifyCode(request, email, code)).status()).toBe(200);
  });

  test('a stranger asking for a code does not withdraw yours, nor use up your allowance', async ({ request }) => {
    const email = uniqueEmail('withdraw');
    const myIp = uniqueIp();
    expect((await requestCode(request, email, { ip: myIp })).status()).toBe(200);
    const mine = await readCode(email, 1);
    // Three requests for the same address from elsewhere, just after.
    for (let i = 0; i < 3; i++) {
      expect((await requestCode(request, email, { browser: 'other' })).status()).toBe(200);
    }
    await readCode(email, 4);
    // I may still ask again (three had been the limit for the address, whoever asked)...
    expect((await requestCode(request, email, { ip: myIp })).status()).toBe(200);
    const newest = await readCode(email, 5);
    test.skip(mine === newest, 'both codes happened to be equal');
    // ...my own new request is what withdraws my old code...
    expect((await verifyCode(request, email, mine)).status()).toBe(401);
    // ...and the code I was sent last opens the account.
    expect((await verifyCode(request, email, newest)).status()).toBe(200);
  });

  test('a stranger\'s code request leaves a code you already hold working', async ({ request }) => {
    const email = uniqueEmail('hold');
    expect((await requestCode(request, email)).status()).toBe(200);
    const mine = await readCode(email, 1);
    expect((await requestCode(request, email, { browser: 'other' })).status()).toBe(200);
    await readCode(email, 2);
    expect((await verifyCode(request, email, mine)).status()).toBe(200);
  });

  test('a stranger\'s wrong guesses do not use up your code', async ({ request }) => {
    const email = uniqueEmail('burn');
    expect((await requestCode(request, email)).status()).toBe(200);
    const mine = await readCode(email, 1);

    const theirIp = uniqueIp();
    const theirs = await requestCode(request, email, { browser: 'other', ip: theirIp });
    expect(theirs.status()).toBe(200);
    const theirCookie = theirs.cookie('im_code');
    expect(theirCookie).toMatch(/^[0-9a-f]{32}$/);
    const theirCode = await readCode(email, 2);
    const miss = [mine, theirCode].includes('000000') ? ([mine, theirCode].includes('000001') ? '000002' : '000001') : '000000';
    for (let i = 0; i < 5; i++) {
      expect((await verifyCode(request, email, miss, API, { cookie: theirCookie, ip: theirIp })).status()).toBe(401);
    }
    // And a few with no cookie at all.
    for (let i = 0; i < 3; i++) {
      expect((await verifyCode(request, email, miss, API, { cookie: null, ip: theirIp })).status()).toBe(401);
    }
    // Their five misses killed their own code and nothing else.
    expect(sql(`SELECT string_agg(attempts::text, ',' ORDER BY created_at) FROM email_login_codes WHERE email = '${email}'`)).toBe('0,5');
    expect((await verifyCode(request, email, mine)).status()).toBe(200);
  });

  test('ten codes an hour to one address from everyone together, not eleven', async ({ request }) => {
    const email = uniqueEmail('flood');
    for (let i = 0; i < 10; i++) {
      expect((await requestCode(request, email, { browser: 'other' })).status(), `request ${i + 1}`).toBe(200);
    }
    const over = await requestCode(request, email, { browser: 'other' });
    expect(over.status()).toBe(429);
    expect((await over.json()).error).toBe('too_many_requests');
    expect(sql(`SELECT COUNT(*) FROM email_login_codes WHERE email = '${email}'`)).toBe('10');
  });

  test('ten wrong guesses a day at one address from one network, then no more codes and no more guesses', async ({ request }) => {
    const email = uniqueEmail('guess');
    const ip = uniqueIp();
    let last = '';
    for (let round = 1; round <= 2; round++) {
      expect((await requestCode(request, email, { ip })).status(), `code ${round}`).toBe(200);
      last = await readCode(email, round);
      for (let i = 0; i < 5; i++) {
        const miss = await verifyCode(request, email, wrongCodeFor(last), API, { ip });
        expect(miss.status()).toBe(401);
        expect((await miss.json()).error).toBe('invalid_code');
      }
    }
    expect(sql(`SELECT COUNT(*) FROM email_code_failures WHERE email = '${email}'`)).toBe('10');

    // On main this network could go on for ever: three codes every fifteen minutes, five
    // guesses each. Now it gets no third code...
    const third = await requestCode(request, email, { ip });
    expect(third.status()).toBe(429);
    expect((await third.json()).error).toBe('too_many_attempts');
    expect(loggedCodes(email)).toHaveLength(2);
    // ...and no further guess is even judged.
    const guess = await verifyCode(request, email, last, API, { ip });
    expect(guess.status()).toBe(429);
    expect((await guess.json()).error).toBe('too_many_attempts');
    expect(sql(`SELECT COUNT(*) FROM email_code_failures WHERE email = '${email}'`)).toBe('10');

    // The address's owner, on another network, is not locked out by that.
    requesterCookies.delete(email);
    const ownerIp = uniqueIp();
    expect((await requestCode(request, email, { ip: ownerIp })).status()).toBe(200);
    expect((await verifyCode(request, email, await readCode(email, 3), API, { ip: ownerIp })).status()).toBe(200);
  });

  test('fifty wrong guesses a day at one address from everyone is the ceiling for the account', async ({ request }) => {
    const email = uniqueEmail('ceiling');
    expect((await requestCode(request, email)).status()).toBe(200);
    const code = await readCode(email);
    // Forty-nine misses on record from many networks (written directly: only their number
    // matters), and the fiftieth made for real.
    sql(`INSERT INTO email_code_failures (email, net_key) SELECT '${email}', '198.51.' || (g % 250) || '.' || g FROM generate_series(1, 49) g`);
    const fiftieth = await verifyCode(request, email, wrongCodeFor(code));
    expect(fiftieth.status()).toBe(401);
    // From a network that has never guessed: refused all the same, right code or not.
    const fresh = uniqueIp();
    const locked = await verifyCode(request, email, code, API, { ip: fresh });
    expect(locked.status()).toBe(429);
    expect((await locked.json()).error).toBe('too_many_attempts');
    expect((await requestCode(request, email, { browser: 'other', ip: fresh })).status()).toBe(429);
    expect(sql(`SELECT COUNT(*) FROM users WHERE email = '${email}'`)).toBe('0');
    // A day later the misses no longer count.
    sql(`UPDATE email_code_failures SET created_at = NOW() - INTERVAL '25 hours' WHERE email = '${email}'`);
    expect((await requestCode(request, email, { browser: 'other', ip: fresh })).status()).toBe(200);
  });
});
