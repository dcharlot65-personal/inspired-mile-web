/**
 * Passwordless sign-in. An account can be made with a passkey alone (no email, no personal
 * data); email is optional, for recovery and for signing in where there is no passkey.
 *
 * The server sets the session (an HttpOnly cookie); this module runs the browser side of
 * each ceremony and switches storage to server mode once it succeeds.
 */

import {
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  startAuthentication,
  startRegistration,
  WebAuthnAbortService,
  WebAuthnError,
} from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';

import * as api from './api-client';
import type { AuthMethods, AuthResponse, EmailAgeTier, PasskeyInfo } from './api-client';
import { activateServerMode, deactivateServerMode } from './storage-backend';
import { forgetUserCaches } from './pwa';

const AGE_KEY = 'inspired-mile-age-verified';

/**
 * Why a sign-in step stopped, as a code the UI turns into words. Server codes (ApiError.code)
 * pass through unchanged; the ones below are raised in the browser.
 */
export type AuthFailure =
  | 'age_required'
  | 'passkey_unsupported'
  | 'passkey_cancelled'
  | 'passkey_already_on_device'
  | 'passkey_failed'
  | 'network';

export class AuthFlowError extends Error {
  constructor(public code: AuthFailure | string, cause?: unknown) {
    super(code);
    this.name = 'AuthFlowError';
    this.cause = cause;
  }
}

// ---------------------------------------------------------------------------
// Age gate
// ---------------------------------------------------------------------------

/**
 * The age tier that allows an account to be created or an email address given, or null.
 *
 * Only a visitor the age gate recorded as an adult, or as a teen with consent, has one.
 * Unknown age and under 13 ("blocked") get null: no account is made for them and no
 * address of theirs leaves the page.
 */
export function accountAgeTier(): EmailAgeTier | null {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(AGE_KEY);
  } catch {
    return null;
  }
  if (stored === 'adult') return 'adult';
  if (stored === 'teen-consented') return 'teen';
  return null;
}

// ---------------------------------------------------------------------------
// What is available
// ---------------------------------------------------------------------------

let methodsPromise: Promise<AuthMethods> | null = null;

/**
 * Which methods the server offers. Asked once per page, and only when first needed.
 * If the server cannot be reached, email is treated as unavailable.
 */
export function getAuthMethods(): Promise<AuthMethods> {
  if (!methodsPromise) {
    methodsPromise = api.getAuthMethods().catch(() => {
      methodsPromise = null; // let a later call try again
      return { passkey: true, passkey_signup: true, email: false };
    });
  }
  return methodsPromise;
}

export function passkeysSupported(): boolean {
  try {
    return browserSupportsWebAuthn();
  } catch {
    return false;
  }
}

/** Conditional mediation: passkeys offered in the autofill of the email field. */
export async function passkeyAutofillSupported(): Promise<boolean> {
  if (!passkeysSupported()) return false;
  try {
    return await browserSupportsWebAuthnAutofill();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Email one-time code
// ---------------------------------------------------------------------------

/**
 * Ask for a code to be emailed. Refuses, before any request is made, unless the age gate
 * allows it.
 */
export async function sendEmailCode(email: string): Promise<void> {
  const tier = accountAgeTier();
  if (!tier) throw new AuthFlowError('age_required');
  await call(() => api.requestEmailCode(email.trim(), tier));
}

export async function signInWithEmailCode(email: string, code: string): Promise<AuthResponse> {
  // The same gate again: a code must not be redeemed by a visitor it could not be sent to.
  if (!accountAgeTier()) throw new AuthFlowError('age_required');
  const auth = await call(() => api.verifyEmailCode(email.trim(), code.trim()));
  activateServerMode(auth.user);
  return auth;
}

/**
 * Signed in: ask for a code to prove an address is yours, before it is stored as the
 * account's recovery email. Refuses, before any request, unless the age gate allows it.
 */
export async function requestRecoveryEmail(email: string): Promise<void> {
  if (!accountAgeTier()) throw new AuthFlowError('age_required');
  await withFreshProof(() => call(() => api.addEmailRequest(email.trim())));
}

export async function confirmRecoveryEmail(email: string, code: string): Promise<AuthResponse> {
  if (!accountAgeTier()) throw new AuthFlowError('age_required');
  const auth = await call(() => api.addEmailVerify(email.trim(), code.trim()));
  activateServerMode(auth.user);
  return auth;
}

// ---------------------------------------------------------------------------
// Passkeys
// ---------------------------------------------------------------------------

/**
 * Sign in with a passkey. No username: the authenticator names the account.
 *
 * With `autofill`, the request waits behind the email field's autofill (conditional
 * mediation) instead of opening a prompt, and resolves only if the visitor picks a passkey
 * there. Starting any other ceremony cancels it.
 */
export async function signInWithPasskey(opts: { autofill?: boolean } = {}): Promise<AuthResponse> {
  if (!passkeysSupported()) throw new AuthFlowError('passkey_unsupported');
  const begin = await call(() => api.passkeyLoginBegin());
  let credential;
  try {
    credential = await startAuthentication({
      optionsJSON: begin.options as unknown as PublicKeyCredentialRequestOptionsJSON,
      useBrowserAutofill: opts.autofill === true,
    });
  } catch (e) {
    throw ceremonyError(e);
  }
  const auth = await call(() => api.passkeyLoginFinish(begin.challenge_id, credential));
  activateServerMode(auth.user);
  return auth;
}

/**
 * Create an account with a passkey and nothing else. The only thing sent before the
 * passkey itself is the age tier; no name, email or other personal data is asked for.
 * Refuses, before any request, unless the age gate allows an account.
 */
export async function signUpWithPasskey(name: string = defaultPasskeyName()): Promise<AuthResponse> {
  const tier = accountAgeTier();
  if (!tier) throw new AuthFlowError('age_required');
  if (!passkeysSupported()) throw new AuthFlowError('passkey_unsupported');
  const begin = await call(() => api.passkeySignupBegin(tier));
  let credential;
  try {
    credential = await startRegistration({
      optionsJSON: begin.options as unknown as PublicKeyCredentialCreationOptionsJSON,
    });
  } catch (e) {
    throw ceremonyError(e);
  }
  const auth = await call(() => api.passkeySignupFinish(begin.challenge_id, credential, name));
  activateServerMode(auth.user);
  return auth;
}

/** Add a passkey on this device to the signed-in account. */
export async function addPasskey(name: string = defaultPasskeyName()): Promise<PasskeyInfo> {
  if (!passkeysSupported()) throw new AuthFlowError('passkey_unsupported');
  const begin = await withFreshProof(() => call(() => api.passkeyRegisterBegin()));
  let credential;
  try {
    credential = await startRegistration({
      optionsJSON: begin.options as unknown as PublicKeyCredentialCreationOptionsJSON,
    });
  } catch (e) {
    throw ceremonyError(e);
  }
  return call(() => api.passkeyRegisterFinish(begin.challenge_id, credential, name));
}

/** Stop a pending passkey request (the autofill one, usually). */
export function cancelPasskeyCeremony(): void {
  try {
    WebAuthnAbortService.cancelCeremony();
  } catch {
    // nothing pending
  }
}

export async function listPasskeys(): Promise<PasskeyInfo[]> {
  return call(() => api.listPasskeys());
}

export async function removePasskey(id: string): Promise<void> {
  await withFreshProof(() => call(() => api.deletePasskey(id)));
}

/**
 * Prove again, with a passkey of the signed-in account, that its owner is at the browser.
 * The proof counts for a few minutes.
 */
export async function confirmWithPasskey(): Promise<void> {
  if (!passkeysSupported()) throw new AuthFlowError('passkey_unsupported');
  const begin = await call(() => api.passkeyVerifyBegin());
  let credential;
  try {
    credential = await startAuthentication({
      optionsJSON: begin.options as unknown as PublicKeyCredentialRequestOptionsJSON,
    });
  } catch (e) {
    throw ceremonyError(e);
  }
  await call(() => api.passkeyVerifyFinish(begin.challenge_id, credential));
}

/**
 * Run a step that changes how the account is signed in to. A session cookie is not enough
 * for those: if the server answers `reauth_required`, ask for the passkey, then try once
 * more. Right after signing in no prompt is needed.
 */
async function withFreshProof<T>(step: () => Promise<T>): Promise<T> {
  try {
    return await step();
  } catch (e) {
    if (!(e instanceof AuthFlowError) || e.code !== 'reauth_required') throw e;
    await confirmWithPasskey();
    return step();
  }
}

/**
 * Give the signed-in account's age, as its user has just answered the age question opened
 * from the account menu. Nothing else in the page changes an account's tier: the browser's
 * stored gate answer is never sent on its own. Going back from teen to adult asks for the
 * passkey first when the last proof is old.
 */
export async function setAccountAgeTier(tier: EmailAgeTier): Promise<{ age_tier: string; changed: boolean }> {
  return withFreshProof(() => call(() => api.setAgeTier(tier)));
}

/**
 * Sign out on every device. Local state, and the account's data in the service worker's
 * caches, are cleared whether or not the server answered (as `logoutUser` does).
 */
export async function signOutEverywhere(): Promise<void> {
  try {
    await api.logoutEverywhere();
  } finally {
    deactivateServerMode();
    await forgetUserCaches();
  }
}

/** A label the owner will recognise in a list, such as "Chrome on macOS". Not localised. */
export function defaultPasskeyName(ua: string = navigator.userAgent): string {
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : 'Browser';
  const os = /iPhone/.test(ua) ? 'iPhone'
    : /iPad/.test(ua) ? 'iPad'
    : /Android/.test(ua) ? 'Android'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
    : /Windows/.test(ua) ? 'Windows'
    : /CrOS/.test(ua) ? 'ChromeOS'
    : /Linux/.test(ua) ? 'Linux'
    : '';
  return os ? `${browser} on ${os}` : browser;
}

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

/** Run an API call, turning its failure into an AuthFlowError with a code. */
async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof api.ApiError) {
      throw new AuthFlowError(e.code ?? (e.status === 429 ? 'too_many_requests' : 'server_error'), e);
    }
    throw new AuthFlowError('network', e);
  }
}

function ceremonyError(e: unknown): AuthFlowError {
  if (e instanceof WebAuthnError) {
    if (e.code === 'ERROR_CEREMONY_ABORTED') return new AuthFlowError('passkey_cancelled', e);
    if (e.code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED') {
      return new AuthFlowError('passkey_already_on_device', e);
    }
  }
  const name = (e as { name?: string } | null)?.name;
  // NotAllowedError is what a dismissed or timed-out prompt gives; AbortError a superseded one.
  if (name === 'NotAllowedError' || name === 'AbortError') {
    return new AuthFlowError('passkey_cancelled', e);
  }
  if (name === 'InvalidStateError') return new AuthFlowError('passkey_already_on_device', e);
  return new AuthFlowError('passkey_failed', e);
}
