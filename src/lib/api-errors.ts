/**
 * What to tell the player when the API says no.
 *
 * The page never shows the server's own text: it is English, and for a failure
 * inside the server it may describe the database. Every failure is reduced to
 * a code, and the code to a sentence in the interface language
 * (`error.<code>`, in the `shared` page area; sign-in codes are also under
 * `auth.error.<code>` in the core locale).
 *
 * Where the code comes from:
 *   1. a JSON body `{"error": "<code>"}` (the sign-in routes answer this way);
 *   2. otherwise the plain-text body, looked up in SERVER_TEXT_CODES. The
 *      classroom, marketplace, tournament, season, credit, inventory, variant,
 *      stats and referral routes answer `(status, "English sentence")`;
 *   3. otherwise the HTTP status;
 *   4. a request that never got an answer is `network`.
 *
 * src/lib/api-errors.test.ts reads the Rust sources and fails when the API can
 * say something that is not in the table, or a code has no sentence in one of
 * the sixteen languages.
 */
import { ApiError } from './api-client';

/** The codes this module can return besides the server's own. */
export const GENERIC_CODES = [
  'network',
  'not_signed_in',
  'forbidden',
  'not_found',
  'conflict',
  'bad_request',
  'too_many_requests',
  'server_error',
  'unavailable',
  'generic',
] as const;

/**
 * The plain-text answers of the API, each with its code. A string is the whole
 * body; a RegExp is for bodies the server builds with format!().
 */
export const SERVER_TEXT_CODES: ReadonlyArray<readonly [string | RegExp, string]> = [
  // Any route
  ['Rate limit exceeded', 'too_many_requests'],
  ['Sign in first.', 'not_signed_in'],
  // The server no longer writes 'DB error: …' (fix/backend-security): a 500 is server_error by its status.
  ['Something went wrong on our side. Please try again.', 'server_error'],
  // Classroom
  ['Name must be 1-128 characters', 'classroom_name_invalid'],
  ['Invalid join code', 'join_code_invalid'],
  ['Classroom not found', 'classroom_not_found'],
  ['Not a member of this classroom', 'not_classroom_member'],
  ['Only teachers can create assignments', 'teachers_only'],
  ['Title must be 1-128 characters', 'assignment_title_invalid'],
  // Marketplace
  ['Invalid card ID', 'card_invalid'],
  ['Invalid card_id format', 'card_invalid'],
  ['Price must be between 1 and 100000', 'price_invalid'],
  ["You don't own this card", 'card_not_owned'],
  ["You don't own the base card", 'card_not_owned'],
  ['Listing not found', 'listing_not_found'],
  ['Listing not found or not yours', 'listing_not_found'],
  ['Listing is no longer active', 'listing_inactive'],
  ['Cannot buy your own listing', 'listing_own'],
  // Tournaments
  ['Tournament not found', 'tournament_not_found'],
  ['Tournament is not accepting registrations', 'tournament_closed'],
  ['Tournament is full', 'tournament_full'],
  ['Tournament name must be between 1 and 128 characters', 'bad_request'],
  ["Format must be 'single_elimination' or 'round_robin'", 'bad_request'],
  ['Invalid starts_at datetime', 'bad_request'],
  ['Match not found', 'match_not_found'],
  [/^Match is already /, 'match_finished'],
  ['Only match participants can complete a match', 'forbidden'],
  ['winner_id must be player1 or player2', 'bad_request'],
  // Seasons
  ['No active season', 'no_active_season'],
  ['Invalid XP amount', 'bad_request'],
  ['No season progress found', 'level_not_reached'],
  ['Level not yet reached', 'level_not_reached'],
  ['Reward already claimed or not found', 'reward_unavailable'],
  // Credits
  ['Invalid credit amount', 'bad_request'],
  ['Invalid spend amount', 'bad_request'],
  ['Insufficient credits', 'insufficient_credits'],
  ['Invalid age tier', 'bad_request'],
  [/^Daily spending limit reached /, 'daily_limit_reached'],
  // Variants, stats, referrals
  ['Variant already unlocked', 'variant_already_unlocked'],
  ['No stats found', 'not_found'],
  [/^Stat values must be between /, 'bad_request'],
  ['Maximum 50 achievements per request', 'bad_request'],
  [/^Invalid achievement ID: /, 'bad_request'],
  ['Invalid referral code', 'referral_invalid'],
  ['Referral code not found', 'referral_not_found'],
  ['Cannot redeem your own referral code', 'referral_own'],
];

/** The code for a plain-text body, or null when the table does not know it. */
export function codeForServerText(body: string): string | null {
  const text = body.trim();
  if (!text) return null;
  for (const [pattern, code] of SERVER_TEXT_CODES) {
    if (typeof pattern === 'string' ? pattern === text : pattern.test(text)) return code;
  }
  return null;
}

/** The code for an HTTP status alone. */
export function codeForStatus(status: number): string {
  if (status === 401) return 'not_signed_in';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 429) return 'too_many_requests';
  if (status === 502 || status === 503 || status === 504) return 'unavailable';
  if (status >= 500) return 'server_error';
  if (status >= 400) return 'bad_request';
  return 'generic';
}

/** Reduce anything a request can throw to a code. */
export function apiErrorCode(e: unknown): string {
  if (e instanceof ApiError) {
    return e.code ?? codeForServerText(e.body) ?? codeForStatus(e.status);
  }
  // fetch() rejects with a TypeError when there is no answer at all.
  if (e instanceof TypeError) return 'network';
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'network';
  return 'generic';
}

/** Numbers some sentences mention ("between {min} and {max} credits"): the limits the server enforces. */
export const ERROR_VARS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  price_invalid: { min: 1, max: 100000 },
};

type Translate = (key: string, vars?: Record<string, string | number>) => string;
type Has = (key: string) => boolean;

/**
 * The sentence for a failure, in the interface language. `t` and `has` are the
 * i18n runtime's, passed in so this module stays free of it; the `shared` page
 * area must be loaded. `formatNumber` writes numbers as the language does.
 * Pages call errorText() in src/i18n/page.ts, which supplies all three.
 */
export function apiErrorMessage(e: unknown, t: Translate, has: Has, formatNumber: (n: number) => string = String): string {
  const code = apiErrorCode(e);
  const vars: Record<string, string> = {};
  for (const [name, value] of Object.entries(ERROR_VARS[code] ?? {})) vars[name] = formatNumber(value);
  if (has(`error.${code}`)) return t(`error.${code}`, vars);
  if (has(`auth.error.${code}`)) return t(`auth.error.${code}`, vars);
  // A code nobody has words for (a newer server than this page): the status still says something.
  if (e instanceof ApiError) {
    const byStatus = `error.${codeForStatus(e.status)}`;
    if (has(byStatus)) return t(byStatus);
  }
  return t('error.generic');
}
