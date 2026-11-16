import { test, expect, type APIRequestContext, type CDPSession, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
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
const E2E_JWT_SECRET = 'e2e-secret-not-for-production';

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

function requestCode(request: APIRequestContext, email: string, opts: { ip?: string; ageTier?: string | null; base?: string } = {}) {
  const data: Record<string, unknown> = { email };
  if (opts.ageTier !== null) data.age_tier = opts.ageTier ?? 'adult';
  return request.post(`${opts.base ?? API}/auth/email/request`, {
    data,
    headers: { 'CF-Connecting-IP': opts.ip ?? uniqueIp() },
  });
}

function verifyCode(request: APIRequestContext, email: string, code: string, base = API) {
  return request.post(`${base}/auth/email/verify`, { data: { email, code } });
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
    // Not a word about email on the panel a visitor first sees.
    expect(await page.locator('#auth-step-choose').innerText()).not.toMatch(/e-?mail/i);
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
    expect(body.user.username).toMatch(/^bard-[0-9a-f]{6}$/);
    expect(body.is_new_user).toBe(true);
    expect(body.passkey_count).toBe(0);

    const setCookie = verified.headers()['set-cookie'] ?? '';
    expect(setCookie).toContain('im_token=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=Lax');

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

  test('one address may ask for three codes in the window, not four', async ({ request }) => {
    const email = uniqueEmail('per-email');
    for (let i = 0; i < 3; i++) {
      expect((await requestCode(request, email)).status(), `request ${i + 1}`).toBe(200);
    }
    const fourth = await requestCode(request, email);
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
      const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, username: user.username, iat: now, exp: now + 3600 })}`;
      return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
    };
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
    expect(created.user.username).toMatch(/^bard-[0-9a-f]{6}$/);
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
    expect(options.user.name).toMatch(/^bard-[0-9a-f]{6}$/);
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

  test('one client address may begin forty sign-ups in the window, not forty-one', async ({ request }) => {
    const ip = uniqueIp();
    for (let i = 0; i < 40; i++) {
      expect((await signupBegin(request, { ip })).status(), `begin ${i + 1}`).toBe(200);
    }
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
    expect(await page.locator('#auth-step-choose').innerText()).not.toMatch(/e-?mail/i);
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
