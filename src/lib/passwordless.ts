/**
 * Passwordless sign-in: passkeys first, an emailed one-time code as the way in without one.
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
import { activateServerMode } from './storage-backend';

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
 * The age tier that allows an email address to be collected, or null.
 *
 * Only a visitor the age gate recorded as an adult, or as a teen with consent, has one.
 * Unknown age and under 13 ("blocked") get null, and no address of theirs leaves the page.
 */
export function emailAgeTier(): EmailAgeTier | null {
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
      return { passkey: true, email: false };
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
  const tier = emailAgeTier();
  if (!tier) throw new AuthFlowError('age_required');
  await call(() => api.requestEmailCode(email.trim(), tier));
}

export async function signInWithEmailCode(email: string, code: string): Promise<AuthResponse> {
  // The same gate again: a code must not be redeemed by a visitor it could not be sent to.
  if (!emailAgeTier()) throw new AuthFlowError('age_required');
  const auth = await call(() => api.verifyEmailCode(email.trim(), code.trim()));
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

/** Add a passkey on this device to the signed-in account. */
export async function addPasskey(name: string = defaultPasskeyName()): Promise<PasskeyInfo> {
  if (!passkeysSupported()) throw new AuthFlowError('passkey_unsupported');
  const begin = await call(() => api.passkeyRegisterBegin());
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
  await call(() => api.deletePasskey(id));
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
