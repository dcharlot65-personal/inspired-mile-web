/**
 * Every request this site's pages may make to another origin, with the reason.
 *
 * tests/third-party.spec.ts loads every page and fails on a request that is not listed
 * here. To add an entry, also describe it in the privacy policy (src/pages/privacy.astro,
 * "Other Companies Involved"): the policy tells visitors that this list is complete.
 *
 * `when`
 *   'page-load'  may happen just by opening a page
 *   'on-use'     happens only after the visitor asks for the thing (a model, the mic, the voice)
 * `ageGate`
 *   'cleared'    only for a visitor who has passed the age gate (adult, or teen with the box ticked)
 */

export interface AllowedRequest {
  name: string;
  pattern: RegExp;
  when: 'page-load' | 'on-use';
  ageGate: 'cleared';
  /** Where in the code the request comes from. */
  source: string;
  reason: string;
}

/** The model repositories the game downloads from. A new model means a new line here. */
const HF_REPOS = [
  'onnx-community/gemma-4-E2B-it-ONNX', // brain.ts, grand tier
  'onnx-community/LFM3-1\\.7B-ONNX', // brain.ts, standard tier
  'LiquidAI/LFM2\\.5-350M-ONNX', // brain.ts, lite tier
  'onnx-community/whisper-base', // ear.ts
  'onnx-community/Kokoro-82M-v1\\.0-ONNX', // thespian-voice.ts (model, and voices/*.bin fetched by kokoro-js)
];

export const THIRD_PARTY_ALLOWLIST: AllowedRequest[] = [
  {
    name: 'Plausible analytics script',
    pattern: /^https:\/\/plausible\.io\/js\/script\.js$/,
    when: 'page-load',
    ageGate: 'cleared',
    source: 'src/layouts/BaseLayout.astro (window.__loadAnalytics)',
    reason: 'Page-view counting. Loaded only after the age gate is passed; never for a blocked or unanswered visitor.',
  },
  {
    name: 'Plausible page-view event',
    pattern: /^https:\/\/plausible\.io\/api\/event$/,
    when: 'page-load',
    ageGate: 'cleared',
    source: 'the Plausible script above',
    reason: 'What the script sends: page address, referrer, and the request\'s IP address and user agent. Not sent from localhost, so the tests never see it.',
  },
  {
    name: 'Hugging Face hub: model files',
    // /<repo>/resolve/<revision>/<file>, which the hub redirects to
    // /api/resolve-cache/models/<repo>/<commit>/<file> for small files (seen in a real-model run).
    pattern: new RegExp(`^https://huggingface\\.co/(api/resolve-cache/models/)?(${HF_REPOS.join('|')})/`),
    when: 'on-use',
    ageGate: 'cleared',
    source: 'src/lib/brain.ts, src/lib/ear.ts, src/lib/thespian-voice.ts',
    reason: 'Model weights are too large to ship from this site (80 MB to 3 GB). A download request: IP address, user agent, the site as referrer, which model. No verse, no audio.',
  },
  {
    name: 'Hugging Face storage',
    pattern: /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.hf\.co\//,
    when: 'on-use',
    ageGate: 'cleared',
    source: 'redirects from the hub entry above',
    reason: 'The hub redirects large files to its storage servers (for example cas-bridge.xethub.hf.co). Same request, same data.',
  },
];

/**
 * Other parties that never appear as a request from a page, listed so the picture is
 * complete. Nothing checks these; the privacy policy describes each.
 */
export const NOT_PAGE_REQUESTS = [
  { name: 'Cloudflare', where: 'network', reason: 'Carries all traffic to the site and terminates TLS; the browser only ever talks to the site\'s own origin.' },
  { name: 'Anthropic', where: 'backend/src/multiplayer/judge.rs', reason: 'The API may send multiplayer verses to it for judging (when LLM_API_KEY is set). Server to server.' },
  { name: 'Resend', where: 'backend/src/auth/email.rs', reason: 'Delivers sign-in codes for accounts that gave an email address. Server to server.' },
  { name: 'Google Scene Viewer', where: 'src/lib/ar-viewer.ts, src/pages/collection.astro (ar-modes="scene-viewer")', reason: 'On Android, tapping "View in AR" opens Google\'s app with the model\'s address. A hand-off on a tap, not a request by the page.' },
  { name: 'Outbound links', where: 'src/layouts/BaseLayout.astro footer, src/pages/about.astro', reason: 'Ordinary links (YouTube, X, LinkedIn, Facebook, Southern Shakespeare Festival). Nothing is sent unless followed.' },
];

export function allowedEntry(url: string, when: Array<AllowedRequest['when']>): AllowedRequest | undefined {
  return THIRD_PARTY_ALLOWLIST.find((entry) => when.includes(entry.when) && entry.pattern.test(url.split('?')[0]));
}
