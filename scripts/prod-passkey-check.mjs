// One real passkey sign-up, sign-out and sign-in against a deployed site, using Chrome's
// virtual authenticator. Creates an account: delete it afterwards (the username is printed).
import { chromium } from '@playwright/test';
const base = process.argv[2];
const b = await chromium.launch();
const ctx = await b.newContext();
await ctx.addInitScript(() => localStorage.setItem('inspired-mile-age-verified', 'adult'));
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send('WebAuthn.enable');
await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
await page.goto(base + '/');
const r = await page.evaluate(async () => {
  const P = await import('/src/lib/passwordless.ts').catch(() => null);
  return !!P;
});
const api = async (path, body) => page.evaluate(async ([p, b]) => { const res = await fetch('/api/v1' + p, { method: b === undefined ? 'GET' : 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: b === undefined ? undefined : JSON.stringify(b) }); return { status: res.status, body: await res.text() }; }, [path, body]);
const b64 = `(() => { const d = (s) => Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(s.length/4)*4,'=')), c => c.charCodeAt(0)); const e = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,''); return { d, e }; })()`;
// sign up
const begin = JSON.parse((await api('/auth/passkey/signup/begin', { age_tier: 'adult' })).body);
const cred = await page.evaluate(async ([o, b64src]) => { const { d, e } = eval(b64src); const pk = o.publicKey ?? o; pk.challenge = d(pk.challenge); pk.user.id = d(pk.user.id); (pk.excludeCredentials ?? []).forEach((c) => (c.id = d(c.id))); const c = await navigator.credentials.create({ publicKey: pk }); return { id: c.id, rawId: e(c.rawId), type: c.type, response: { attestationObject: e(c.response.attestationObject), clientDataJSON: e(c.response.clientDataJSON), transports: c.response.getTransports?.() ?? [] }, clientExtensionResults: c.getClientExtensionResults(), rpId: pk.rp.id }; }, [begin.options, b64]);
console.log('rp id used:', cred.rpId);
const fin = await api('/auth/passkey/signup/finish', { challenge_id: begin.challenge_id, credential: cred });
console.log('signup finish:', fin.status, fin.body.slice(0, 160));
console.log('me:', (await api('/auth/me')).body.slice(0, 160));
console.log('logout:', (await api('/auth/logout', {})).status, '| me after:', (await api('/auth/me')).status);
// sign in, usernameless
const lb = JSON.parse((await api('/auth/passkey/login/begin', {})).body);
const asr = await page.evaluate(async ([o, b64src]) => { const { d, e } = eval(b64src); const pk = o.publicKey ?? o; pk.challenge = d(pk.challenge); (pk.allowCredentials ?? []).forEach((c) => (c.id = d(c.id))); const c = await navigator.credentials.get({ publicKey: pk }); return { id: c.id, rawId: e(c.rawId), type: c.type, response: { authenticatorData: e(c.response.authenticatorData), clientDataJSON: e(c.response.clientDataJSON), signature: e(c.response.signature), userHandle: c.response.userHandle ? e(c.response.userHandle) : null }, clientExtensionResults: c.getClientExtensionResults() }; }, [lb.options, b64]);
const lf = await api('/auth/passkey/login/finish', { challenge_id: lb.challenge_id, credential: asr });
console.log('login finish:', lf.status, lf.body.slice(0, 120));
console.log('me after login:', (await api('/auth/me')).status);
await b.close();
