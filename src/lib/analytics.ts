/**
 * Analytics — Lightweight event tracking wrapper.
 * Uses Plausible Analytics (privacy-friendly, no cookies).
 */

type EventProps = Record<string, string | number | boolean>;

/**
 * Track a custom event. No-ops if Plausible is not loaded.
 */
export function trackEvent(name: string, props?: EventProps): void {
  if (typeof window === 'undefined') return;
  const plausible = (window as any).plausible;
  if (typeof plausible === 'function') {
    plausible(name, props ? { props } : undefined);
  }
}

// Pre-defined event helpers
export const trackPackOpened = (tier?: string) =>
  trackEvent('pack_opened', tier ? { tier } : undefined);

export const trackBattleStarted = () =>
  trackEvent('battle_started');

export const trackBattleWon = () =>
  trackEvent('battle_won');

export const trackTriviaCompleted = (score: number) =>
  trackEvent('trivia_completed', { score });

export const trackChallengeCompleted = (difficulty: string) =>
  trackEvent('challenge_completed', { difficulty });

export const trackCardMinted = (cardId: string) =>
  trackEvent('card_minted', { card_id: cardId });

export const trackSignIn = (provider: string) =>
  trackEvent('sign_in', { provider });

export const trackPageView = (page: string) =>
  trackEvent('pageview', { page });
