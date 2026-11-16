/**
 * Behaving well as an installed web app, especially on iPhone and in headsets.
 *
 * Three things live here, and nothing here ever blocks play:
 *
 *   1. Storage protection. A model is 0.3 to 3 GB in browser storage, and browsers
 *      (iOS above all) evict site storage they have not been asked to keep. After a model
 *      loads, and whenever the game runs installed, navigator.storage.persist() is asked
 *      for and the answer is recorded; the battle page shows the player which it was.
 *   2. Install guidance, before the first download or sign-in. On iOS a Safari tab and
 *      the Home Screen app do not share storage, so installing afterwards means doing
 *      both again.
 *   3. A screen wake lock while a duel or the Theatre is on stage.
 *
 * Every string a player can see is in PWA_STRINGS, so it can be localised in one place.
 * The decisions are pure functions (tested in pwa.test.ts); the parts that touch the
 * browser are thin and guarded, because every API used here is missing somewhere.
 */

export const PWA_STRINGS = {
  install: {
    regionLabel: 'Install Sonnet Man',
    title: 'Install Sonnet Man first',
    /** Browsers that offer their own install dialog (Chrome, Edge, Android). */
    promptBody: 'It opens full screen, and an installed app is far less likely to have a downloaded model cleared by the browser.',
    /** iPhone and iPad: there is no install dialog, and the app has storage of its own. */
    iosBody: 'On iPhone and iPad the Home Screen app shares nothing with this tab. Add it before you sign in or download a model, or you will do both twice.',
    iosStep1: 'Tap the Share button.',
    iosStep2: 'Choose “Add to Home Screen”.',
    accept: 'Install',
    dismiss: 'Not now',
  },
  storage: {
    /** {size} is replaced by the amount stored, e.g. "1.1 GB". */
    kept: '{size} kept on this device. Your browser will not clear it on its own.',
    keptNoSize: 'Your download is kept on this device. Your browser will not clear it on its own.',
    atRisk: '{size} stored, but your browser may clear this if the device runs short of space or you stay away for a while.',
    atRiskNoSize: 'Your download is stored, but your browser may clear this if the device runs short of space or you stay away for a while.',
    /** Added to the at-risk line where installing would help. */
    installHint: 'Installing the app helps keep it.',
    lessThanOneMb: 'Less than 1 MB',
    megabytes: '{n} MB',
    gigabytes: '{n} GB',
  },
} as const;

// ---------------------------------------------------------------------------
// Pure parts
// ---------------------------------------------------------------------------

/** Is the page running as an installed app rather than in a browser tab? */
export function isStandaloneDisplay(env: { displayModeStandalone: boolean; navigatorStandalone: unknown }): boolean {
  return env.displayModeStandalone || env.navigatorStandalone === true;
}

/**
 * An iPhone, iPad or iPod browser that can add a page to the Home Screen.
 * iPadOS reports itself as a Mac, told apart only by having a touch screen (Vision Pro
 * does the same). In-app browsers (a link opened inside a social app) are left out:
 * they have no Share, then Add to Home Screen.
 */
export function isIosBrowser(userAgent: string, maxTouchPoints: number): boolean {
  const ios = /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  if (!ios) return false;
  return !/FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|TikTok|musical_ly|Twitter|LinkedInApp|Snapchat|Pinterest/i.test(userAgent);
}

export type InstallMode = 'none' | 'prompt' | 'ios';

export interface InstallContext {
  standalone: boolean;
  /** The player closed the prompt before. */
  dismissed: boolean;
  /** The browser fired beforeinstallprompt, so it has an install dialog to open. */
  promptAvailable: boolean;
  userAgent: string;
  maxTouchPoints: number;
}

/** Which install guidance to show, if any. */
export function installMode(ctx: InstallContext): InstallMode {
  if (ctx.standalone || ctx.dismissed) return 'none';
  if (ctx.promptAvailable) return 'prompt';
  return isIosBrowser(ctx.userAgent, ctx.maxTouchPoints) ? 'ios' : 'none';
}

/** A storage size as a player would say it: "295 MB", "1.1 GB". */
export function formatBytes(bytes: number): string {
  const s = PWA_STRINGS.storage;
  if (!Number.isFinite(bytes) || bytes < 1e6) return s.lessThanOneMb;
  if (bytes < 1e9) return s.megabytes.replace('{n}', String(Math.round(bytes / 1e6)));
  return s.gigabytes.replace('{n}', (bytes / 1e9).toFixed(1));
}

export interface StorageNote {
  state: 'kept' | 'at-risk';
  text: string;
}

/**
 * What the model panel says about a download.
 * @param usage bytes the site stores, or null where the browser does not say
 * @param canInstall installing would help (a tab, on a browser that installs)
 */
export function storageNote(persisted: boolean, usage: number | null, canInstall = false): StorageNote {
  const s = PWA_STRINGS.storage;
  const known = usage !== null && Number.isFinite(usage) && usage > 0;
  const size = known ? formatBytes(usage) : '';
  if (persisted) return { state: 'kept', text: known ? s.kept.replace('{size}', size) : s.keptNoSize };
  const text = known ? s.atRisk.replace('{size}', size) : s.atRiskNoSize;
  return { state: 'at-risk', text: canInstall ? `${text} ${s.installHint}` : text };
}

/** What navigator.wakeLock.request() resolves to, as far as this module uses it. */
export interface WakeSentinel {
  release(): Promise<void>;
  addEventListener?(type: 'release', listener: () => void): void;
}

export interface WakeLockEnv {
  /** Ask the browser for a screen wake lock; null where it has none. */
  request: (() => Promise<WakeSentinel>) | null;
  visible: () => boolean;
}

/**
 * Keeps the screen awake while anything holds it and the page is visible.
 *
 * Several things may hold at once (a duel, the Theatre), each under its own name; the
 * lock goes when the last lets go. The browser drops the lock itself when the page is
 * hidden, so visibilityChanged() must be called on every visibilitychange to take it
 * again. A refusal (battery saver, no permission) or a missing API is not an error:
 * the screen simply dims as usual.
 */
export function createWakeLockKeeper(env: WakeLockEnv) {
  const holders = new Set<string>();
  let sentinel: WakeSentinel | null = null;
  let pending: Promise<void> | null = null;

  function sync(): Promise<void> {
    const want = holders.size > 0 && env.visible();
    if (want && !sentinel && !pending && env.request) {
      let asked: Promise<WakeSentinel>;
      try {
        asked = env.request();
      } catch {
        return Promise.resolve();
      }
      pending = asked.then(
        (s) => {
          pending = null;
          sentinel = s;
          s.addEventListener?.('release', () => {
            if (sentinel === s) sentinel = null;
          });
          // Let go at once if the duel ended or the page was hidden while asking.
          return sync();
        },
        () => {
          pending = null;
        },
      );
      return pending;
    }
    if (!want && sentinel) {
      const s = sentinel;
      sentinel = null;
      return s.release().catch(() => {});
    }
    return pending ?? Promise.resolve();
  }

  return {
    hold(reason: string): Promise<void> {
      holders.add(reason);
      return sync();
    },
    release(reason: string): Promise<void> {
      holders.delete(reason);
      return sync();
    },
    visibilityChanged: sync,
    get locked(): boolean {
      return sentinel !== null;
    },
    get holders(): string[] {
      return [...holders];
    },
  };
}

/** Every cache the service worker owns starts with this (public/sw.js CACHE_PREFIX). */
export const SW_CACHE_PREFIX = 'inspired-mile-';

const STATIC_PREFIXES = ['/_astro/', '/images/', '/fonts/', '/audio/'];
const STATIC_FILES = ['/favicon.svg', '/icon-192.png', '/icon-512.png'];

/**
 * May an entry under this URL stay in the service worker's cache after sign-out?
 * Only what cannot depend on who is signed in: this origin, no query string, and a
 * build file, an image, a font, a sound or a page. Nothing under /api, ever.
 * Keep in step with storable() in public/sw.js (sw.test.ts compares the two).
 */
export function mayStayCached(entryUrl: string, origin: string): boolean {
  let url: URL;
  try {
    url = new URL(entryUrl, origin);
  } catch {
    return false;
  }
  if (url.origin !== origin || url.search) return false;
  const path = url.pathname;
  if (path === '/api' || path.startsWith('/api/')) return false;
  if (STATIC_PREFIXES.some((p) => path.startsWith(p)) || STATIC_FILES.includes(path)) return true;
  const last = path.slice(path.lastIndexOf('/') + 1);
  return !last.includes('.') || last.endsWith('.html');
}

// ---------------------------------------------------------------------------
// Storage protection
// ---------------------------------------------------------------------------

/** Where the last answer to storage.persist() is kept. */
export const STORAGE_OUTCOME_KEY = 'inspired-mile-storage-protection';
/** Fired on window, with the outcome as detail, each time protection is asked for. */
export const STORAGE_EVENT = 'inspired-mile:storage-protection';

export interface StorageOutcome {
  /** The browser has navigator.storage.persist at all. */
  supported: boolean;
  /** It agreed not to evict this site's storage. */
  persisted: boolean;
  /** A model has been downloaded on this device (stays true once it has). */
  model: boolean;
  /** When it was last asked, ISO 8601. */
  at: string;
}

function readStore(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStore(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode, storage full: nothing to do */
  }
}

/** The recorded answer, or null if protection has never been asked for here. */
export function storageOutcome(): StorageOutcome | null {
  try {
    const o = JSON.parse(readStore(STORAGE_OUTCOME_KEY) ?? 'null');
    return o && typeof o.persisted === 'boolean' ? (o as StorageOutcome) : null;
  } catch {
    return null;
  }
}

/**
 * Ask the browser to keep this site's storage, and record what it said.
 * Never throws and never prompts twice for what is already granted. Callers do not
 * wait for it: Firefox asks the player, and play must not hang on the answer.
 */
export async function protectStorage(reason: 'model' | 'installed'): Promise<StorageOutcome> {
  const outcome: StorageOutcome = {
    supported: false,
    persisted: false,
    model: reason === 'model' || storageOutcome()?.model === true,
    at: new Date().toISOString(),
  };
  try {
    const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
    if (storage && typeof storage.persist === 'function') {
      outcome.supported = true;
      const already = typeof storage.persisted === 'function' && (await storage.persisted());
      outcome.persisted = already || (await storage.persist());
    }
  } catch (err) {
    console.warn('[pwa] storage.persist failed', err);
  }
  if (typeof window !== 'undefined') {
    writeStore(STORAGE_OUTCOME_KEY, JSON.stringify(outcome));
    window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: outcome }));
  }
  return outcome;
}

/**
 * Put a line under `anchor` saying whether the downloaded model is protected, and keep
 * it current. It stays hidden until a model has been downloaded on this device.
 */
export function mountStorageNote(anchor: HTMLElement): void {
  const note = document.createElement('p');
  note.id = 'storage-note';
  note.className = 'hidden text-xs mt-2';
  anchor.insertAdjacentElement('afterend', note);

  async function refresh() {
    if (!storageOutcome()?.model) return;
    let persisted = storageOutcome()?.persisted ?? false;
    let usage: number | null = null;
    try {
      // The live answer wins over the recorded one: a browser can grant or withdraw it later.
      if (typeof navigator.storage?.persisted === 'function') persisted = await navigator.storage.persisted();
      if (typeof navigator.storage?.estimate === 'function') usage = (await navigator.storage.estimate()).usage ?? null;
    } catch {
      /* say what is known */
    }
    const canInstall = !persisted && installMode(installContext()) !== 'none';
    const { state, text } = storageNote(persisted, usage, canInstall);
    note.textContent = text;
    note.dataset.state = state;
    note.classList.toggle('text-emerald-400', state === 'kept');
    note.classList.toggle('text-obsidian-400', state !== 'kept');
    note.classList.remove('hidden');
  }

  window.addEventListener(STORAGE_EVENT, refresh);
  refresh();
}

// ---------------------------------------------------------------------------
// Install guidance
// ---------------------------------------------------------------------------

/** The same key the earlier banner used, so a player who closed that one is not asked again. */
export const INSTALL_DISMISSED_KEY = 'im-install-dismissed';

interface InstallPromptEvent extends Event {
  prompt(): Promise<unknown>;
  userChoice?: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: InstallPromptEvent | null = null;

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  let displayModeStandalone = false;
  try {
    displayModeStandalone = window.matchMedia('(display-mode: standalone)').matches;
  } catch {
    /* no matchMedia */
  }
  return isStandaloneDisplay({ displayModeStandalone, navigatorStandalone: (navigator as any).standalone });
}

function installContext(): InstallContext {
  return {
    standalone: isStandalone(),
    dismissed: readStore(INSTALL_DISMISSED_KEY) !== null,
    promptAvailable: deferredPrompt !== null,
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
  };
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function hideInstall(): void {
  document.getElementById('pwa-install')?.remove();
}

function showInstall(): void {
  const mode = installMode(installContext());
  hideInstall();
  if (mode === 'none') return;
  const s = PWA_STRINGS.install;

  // Small, at the foot of the page, under the age gate (z-200) and never full width on a desktop.
  const box = el('div', 'fixed bottom-3 inset-x-3 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-w-sm z-150 bg-obsidian-900 border border-gold-500/40 rounded-xl shadow-2xl p-4');
  box.id = 'pwa-install';
  box.dataset.mode = mode;
  box.setAttribute('role', 'region');
  box.setAttribute('aria-label', s.regionLabel);
  box.appendChild(el('p', 'font-display font-bold text-gold-400', s.title));
  box.appendChild(el('p', 'mt-1 text-sm text-obsidian-300', mode === 'ios' ? s.iosBody : s.promptBody));
  if (mode === 'ios') {
    const steps = el('ol', 'mt-2 list-decimal list-inside text-sm text-obsidian-100 space-y-1');
    steps.appendChild(el('li', '', s.iosStep1));
    steps.appendChild(el('li', '', s.iosStep2));
    box.appendChild(steps);
  }
  const row = el('div', 'mt-3 flex items-center justify-end gap-3');
  const dismiss = el('button', 'text-sm text-obsidian-400 hover:text-obsidian-100 underline px-2 py-2', s.dismiss);
  dismiss.id = 'pwa-install-dismiss';
  dismiss.type = 'button';
  dismiss.addEventListener('click', () => {
    writeStore(INSTALL_DISMISSED_KEY, '1');
    hideInstall();
  });
  row.appendChild(dismiss);
  if (mode === 'prompt') {
    const accept = el('button', 'btn-primary text-sm px-4 py-2', s.accept);
    accept.id = 'pwa-install-accept';
    accept.type = 'button';
    accept.addEventListener('click', async () => {
      const event = deferredPrompt;
      // The browser allows one prompt() per event.
      deferredPrompt = null;
      hideInstall();
      try {
        await event?.prompt();
        await event?.userChoice;
      } catch (err) {
        console.warn('[pwa] install prompt failed', err);
      }
    });
    row.appendChild(accept);
  }
  box.appendChild(row);
  document.body.appendChild(box);
}

let started = false;

/**
 * Called once on every page (BaseLayout). Installed: ask for storage to be kept and show
 * nothing. In a tab: offer installing, by the browser's own dialog where it has one and
 * by instruction on iOS, until the player closes the offer.
 */
export function initPwa(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  try {
    if (isStandalone()) {
      void protectStorage('installed');
    } else {
      window.addEventListener('beforeinstallprompt', (e) => {
        // Keep the browser's own mini-bar away; ours explains why to install first.
        e.preventDefault();
        deferredPrompt = e as InstallPromptEvent;
        showInstall();
      });
      window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        hideInstall();
      });
      showInstall();
    }
  } catch (err) {
    console.warn('[pwa] init failed', err);
  }
  // Tests wait on this to know the decision above has been made.
  document.documentElement.dataset.pwa = isStandalone() ? 'standalone' : 'tab';
}

// ---------------------------------------------------------------------------
// Screen wake lock
// ---------------------------------------------------------------------------

let keeper: ReturnType<typeof createWakeLockKeeper> | null = null;

function wakeKeeper() {
  if (keeper) return keeper;
  const wakeLock = (navigator as any).wakeLock;
  keeper = createWakeLockKeeper({
    request: wakeLock && typeof wakeLock.request === 'function' ? () => wakeLock.request('screen') : null,
    visible: () => document.visibilityState === 'visible',
  });
  document.addEventListener('visibilitychange', () => void keeper!.visibilityChanged());
  return keeper;
}

/** Keep the screen on from now until releaseWakeLock(reason). Safe to call anywhere. */
export function holdWakeLock(reason: string): void {
  if (typeof document === 'undefined') return;
  void wakeKeeper().hold(reason);
}

export function releaseWakeLock(reason: string): void {
  if (typeof document === 'undefined') return;
  void wakeKeeper().release(reason);
}

// ---------------------------------------------------------------------------
// Sign-out
// ---------------------------------------------------------------------------

/**
 * Called on sign-out: remove from the service worker's caches everything that is not a
 * static file. The worker stores nothing else to begin with (public/sw.js); this is the
 * second lock, and it also clears what an older worker left behind. Done from the page,
 * so it works with no worker in control, and the worker is told to do the same.
 * Returns how many entries were removed. Never throws.
 */
export async function forgetUserCaches(): Promise<number> {
  let removed = 0;
  if (typeof window === 'undefined') return removed;
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: 'FORGET_USER' });
  } catch {
    /* no worker to tell */
  }
  try {
    if (typeof caches === 'undefined') return removed;
    for (const name of await caches.keys()) {
      if (!name.startsWith(SW_CACHE_PREFIX)) continue;
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        if (mayStayCached(request.url, location.origin)) continue;
        if (await cache.delete(request)) removed++;
      }
    }
  } catch (err) {
    console.warn('[pwa] could not clear cached data on sign-out', err);
  }
  return removed;
}
