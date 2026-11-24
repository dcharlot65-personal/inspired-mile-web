import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { E2E } from './e2e-env';

const API = `http://127.0.0.1:${E2E.apiPort}/api/v1`;
const API_LOG = path.join(E2E.workDir, 'api.log');

let seq = 0;
const unique = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}${++seq}`;
function uniqueIp(): string {
  const n = () => 1 + Math.floor(Math.random() * 253);
  return `10.${n()}.${n()}.${n()}`;
}

function loggedCodes(email: string): string[] {
  if (!existsSync(API_LOG)) return [];
  const re = new RegExp(`DEV_EMAIL_LOG sign-in code for ${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} is (\\d{6})`, 'g');
  return [...readFileSync(API_LOG, 'utf8').matchAll(re)].map((m) => m[1]);
}

async function raw(method: string, url: string, headers: Record<string, string>, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* plain text */
  }
  return { status: res.status, headers: res.headers, json, text };
}

async function createAccount() {
  const email = `digi-${unique()}@example.test`;
  const ip = uniqueIp();
  const asked = await raw('POST', `${API}/auth/email/request`, { 'CF-Connecting-IP': ip }, { email, age_tier: 'adult' });
  expect(asked.status, asked.text).toBe(200);
  const codeCookie = asked.headers.getSetCookie().map((c) => c.match(/^im_code=([^;]*)/)?.[1]).find(Boolean);
  let codes: string[] = [];
  await expect.poll(() => (codes = loggedCodes(email)).length, { timeout: 10000 }).toBeGreaterThan(0);
  const verified = await raw(
    'POST',
    `${API}/auth/email/verify`,
    { 'CF-Connecting-IP': ip, ...(codeCookie ? { Cookie: `im_code=${codeCookie}` } : {}) },
    { email, code: codes[codes.length - 1] },
  );
  expect(verified.status, verified.text).toBe(200);
  const token = verified.headers.getSetCookie().map((c) => c.match(/^im_token=([^;]*)/)?.[1]).find(Boolean)!;
  return {
    id: verified.json.user.id as string,
    token,
    ip,
    call: (method: string, route: string, body?: unknown) =>
      raw(method, `${API}${route}`, { Cookie: `im_token=${token}`, 'CF-Connecting-IP': ip }, body),
  };
}

test.describe('Digi-Physical Card & Joule State-Machine API (/api/v1/digicards)', () => {
  test('mints, transitions across Sonnet Man & Chess Fighter, enforces monotonic SUN counter, and verifies Ed25519 IM2 tokens', async () => {
    const alice = await createAccount();
    const bob = await createAccount();
    const uid = `04${unique().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)}`;

    // 1. Unknown card returns 404 publicly
    const missing = await raw('GET', `${API}/digicards/${uid}`, { 'CF-Connecting-IP': uniqueIp() });
    expect(missing.status).toBe(404);

    // 2. Client-supplied joule overrides are refused (server-authoritative physics)
    const spoofed = await alice.call('POST', `/digicards/${uid}/transition`, {
      sun_tap_counter: 1,
      microjoules: 9_999_999,
      event: { type: 'verse_duel', outcome: 'win', rounds_played: 3, lines_scored: 12, craft_score: 80 },
    });
    expect(spoofed.status).toBe(400);

    // 3. First Mile: Sonnet Man verse-duel transition (SUN tap 1)
    const t1 = await alice.call('POST', `/digicards/${uid}/transition`, {
      sun_tap_counter: 1,
      archetype: 'Hamlet',
      catalog_card_id: 'DC-001',
      origin_game: 'sonnetman',
      event: {
        type: 'verse_duel',
        outcome: 'win',
        rounds_played: 3,
        lines_scored: 12,
        craft_score: 85,
        ai_tier: 'standard',
        ai_invocations: 3,
        opponent_elo: 1200,
      },
    });
    expect(t1.status, t1.text).toBe(200);
    expect(t1.json.seq).toBe(1);
    expect(t1.json.game).toBe('sonnetman');
    expect(t1.json.delta_loop_microjoules).toBe(15_400);
    expect(t1.json.delta_compartment_microjoules).toBe(72_000);
    expect(t1.json.card.rarity_tier).toBe('Forged');
    expect(t1.json.card.journey_stage).toBe(2);
    expect(t1.json.card.owner_bound).toBe(true);
    expect(t1.json.card.is_caller_owner).toBe(true);
    expect(t1.json.im2_token).toMatch(/^IM2-[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

    // 4. Replay attack protection: same or lower sun_tap_counter is rejected with 409 Conflict
    const replay = await alice.call('POST', `/digicards/${uid}/transition`, {
      sun_tap_counter: 1,
      event: { type: 'chess_capture', ply_count: 8, duel_ticks: 90, ai_tier: 'none', ai_invocations: 0 },
    });
    expect(replay.status).toBe(409);

    // 5. Ownership protection: another user cannot transition Alice's bound card
    const hijack = await bob.call('POST', `/digicards/${uid}/transition`, {
      sun_tap_counter: 2,
      event: { type: 'chess_capture', ply_count: 8, duel_ticks: 90, ai_tier: 'none', ai_invocations: 0 },
    });
    expect(hijack.status).toBe(403);

    // 6. Second Mile: Chess Fighter capture + promotion + crown (SUN taps 2, 3, 4) -> Cross-mile Stage 3 (Company)
    const t2 = await alice.call('POST', `/digicards/${uid}/transition`, {
      sun_tap_counter: 2,
      event: {
        type: 'chess_capture',
        ply_count: 14,
        duel_ticks: 180,
        captured_piece: 'rook',
        ai_tier: 'tactical',
        ai_invocations: 2,
      },
    });
    expect(t2.status, t2.text).toBe(200);
    expect(t2.json.card.journey_stage).toBe(3);
    expect(t2.json.card.journey_milestone).toBe('Company');
    expect(t2.json.card.chess_captures).toBe(1);

    const t3 = await alice.call('POST', `/digicards/${uid}/transition`, {
      sun_tap_counter: 3,
      event: {
        type: 'chess_promotion',
        ply_count: 22,
        duel_ticks: 240,
        promoted_to: 'queen',
        ai_tier: 'neural',
        ai_invocations: 4,
      },
    });
    expect(t3.status, t3.text).toBe(200);
    expect(t3.json.card.chess_promotions).toBe(1);

    // 7. Concurrent replay race on SUN tap 5: exactly one wins, the rest get 409
    const burst = await Promise.all(
      Array.from({ length: 6 }, () =>
        alice.call('POST', `/digicards/${uid}/transition`, {
          sun_tap_counter: 5,
          event: {
            type: 'chess_crown',
            outcome: 'win',
            ply_count: 28,
            duel_ticks: 300,
            ai_tier: 'grandmaster',
            ai_invocations: 2,
            opponent_elo: 1300,
          },
        }),
      ),
    );
    expect(burst.filter((r) => r.status === 200)).toHaveLength(1);
    expect(burst.filter((r) => r.status === 409)).toHaveLength(5);

    // 8. Public GET & /digicards/verify validate Ed25519 signature and reject tampered tokens
    const pub = await raw('GET', `${API}/digicards/${uid}`, { 'CF-Connecting-IP': uniqueIp() });
    expect(pub.status).toBe(200);
    expect(pub.json.sun_tap_counter).toBe(5);
    expect(pub.json.transition_count).toBe(4);
    expect(pub.json.rarity_tier).toBe('Radiant');
    expect(pub.json.is_caller_owner).toBe(false);

    const verified = await raw(
      'POST',
      `${API}/digicards/verify`,
      { 'CF-Connecting-IP': uniqueIp() },
      { token: pub.json.im2_token },
    );
    expect(verified.status, verified.text).toBe(200);
    expect(verified.json.valid).toBe(true);
    expect(verified.json.state_hash).toBe(pub.json.state_hash);

    const badToken = pub.json.im2_token.slice(0, -2) + (pub.json.im2_token.endsWith('AA') ? 'BB' : 'AA');
    const tampered = await raw(
      'POST',
      `${API}/digicards/verify`,
      { 'CF-Connecting-IP': uniqueIp() },
      { token: badToken },
    );
    expect(tampered.status).toBe(400);
  });
});
