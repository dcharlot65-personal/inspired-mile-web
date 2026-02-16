/**
 * Referral System — Client-side API for referral code generation and redemption.
 */

const API = import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3849/api/v1';

export interface ReferralInfo {
  code: string;
  referral_count: number;
}

export interface RedeemResult {
  success: boolean;
  message: string;
  packs_granted: number;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers as Record<string, string> },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

/** Get the current user's referral code (creates one if none exists). */
export async function getReferralCode(): Promise<ReferralInfo> {
  return apiFetch('/referral');
}

/** Redeem a referral code — grants 5 free packs to the redeemer. */
export async function redeemCode(code: string): Promise<RedeemResult> {
  return apiFetch('/referral/redeem', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

/** Copy referral code to clipboard. Returns true on success. */
export async function copyReferralCode(code: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(code);
    return true;
  } catch {
    // Fallback for older browsers
    const ta = document.createElement('textarea');
    ta.value = code;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }
}

/** Build a shareable referral link. */
export function getReferralLink(code: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://sonnetman.inspiredmile.com';
  return `${base}/?ref=${code}`;
}
