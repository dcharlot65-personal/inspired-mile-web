import { describe, expect, it } from 'vitest';
import { createWakeLockKeeper, formatBytes, installMode, isIosBrowser, mayStayCached, isStandaloneDisplay, PWA_STRINGS, storageNote, type InstallContext, type WakeSentinel } from './pwa';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1';
const IPAD_AS_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Safari/605.1.15';
const CHROME_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';
const ANDROID = 'Mozilla/5.0 (Linux; Android 16; Fairphone 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36';
const INSTAGRAM_IOS = `${IPHONE.replace(' Safari/604.1', '')} Instagram 400.0.0.0`;

describe('standalone detection', () => {
  it('is standalone by display mode or by iOS navigator.standalone, and by nothing else', () => {
    expect(isStandaloneDisplay({ displayModeStandalone: true, navigatorStandalone: undefined })).toBe(true);
    expect(isStandaloneDisplay({ displayModeStandalone: false, navigatorStandalone: true })).toBe(true);
    expect(isStandaloneDisplay({ displayModeStandalone: false, navigatorStandalone: false })).toBe(false);
    expect(isStandaloneDisplay({ displayModeStandalone: false, navigatorStandalone: undefined })).toBe(false);
  });
});

describe('iOS detection', () => {
  it('knows an iPhone, and an iPad that calls itself a Mac', () => {
    expect(isIosBrowser(IPHONE, 5)).toBe(true);
    expect(isIosBrowser(IPAD_AS_MAC, 5)).toBe(true);
  });
  it('does not take a real Mac, a desktop Chrome or an Android phone for one', () => {
    expect(isIosBrowser(IPAD_AS_MAC, 0)).toBe(false);
    expect(isIosBrowser(CHROME_MAC, 0)).toBe(false);
    expect(isIosBrowser(ANDROID, 5)).toBe(false);
  });
  it('leaves out in-app browsers, which cannot add to the Home Screen', () => {
    expect(isIosBrowser(INSTAGRAM_IOS, 5)).toBe(false);
  });
});

describe('install guidance', () => {
  const tab: InstallContext = { standalone: false, dismissed: false, promptAvailable: false, userAgent: CHROME_MAC, maxTouchPoints: 0 };
  it('uses the browser dialog where there is one', () => {
    expect(installMode({ ...tab, promptAvailable: true })).toBe('prompt');
    expect(installMode({ ...tab, promptAvailable: true, userAgent: ANDROID, maxTouchPoints: 5 })).toBe('prompt');
  });
  it('gives the instructions on iOS, which has no dialog', () => {
    expect(installMode({ ...tab, userAgent: IPHONE, maxTouchPoints: 5 })).toBe('ios');
  });
  it('shows nothing where the browser cannot install', () => {
    expect(installMode(tab)).toBe('none');
  });
  it('shows nothing once installed, whatever the browser', () => {
    expect(installMode({ ...tab, standalone: true, promptAvailable: true })).toBe('none');
    expect(installMode({ ...tab, standalone: true, userAgent: IPHONE, maxTouchPoints: 5 })).toBe('none');
  });
  it('shows nothing after the player closed it', () => {
    expect(installMode({ ...tab, dismissed: true, promptAvailable: true })).toBe('none');
    expect(installMode({ ...tab, dismissed: true, userAgent: IPHONE, maxTouchPoints: 5 })).toBe('none');
  });
});

describe('storage wording', () => {
  it('formats sizes the way the download buttons do', () => {
    expect(formatBytes(295e6)).toBe('295 MB');
    expect(formatBytes(1.09e9)).toBe('1.1 GB');
    expect(formatBytes(3.1e9)).toBe('3.1 GB');
    expect(formatBytes(999_999)).toBe(PWA_STRINGS.storage.lessThanOneMb);
    expect(formatBytes(Number.NaN)).toBe(PWA_STRINGS.storage.lessThanOneMb);
  });
  it('says a protected download is kept, with its size', () => {
    const n = storageNote(true, 1.09e9);
    expect(n.state).toBe('kept');
    expect(n.text).toContain('1.1 GB');
    expect(n.text).toContain('kept on this device');
    expect(n.text).not.toContain('may clear');
  });
  it('says an unprotected download may be cleared', () => {
    const n = storageNote(false, 295e6);
    expect(n.state).toBe('at-risk');
    expect(n.text).toContain('295 MB');
    expect(n.text).toContain('your browser may clear this');
    expect(n.text).not.toContain('kept on this device');
    expect(n.text).not.toContain(PWA_STRINGS.storage.installHint);
  });
  it('still answers where the browser gives no size', () => {
    expect(storageNote(true, null).text).toBe(PWA_STRINGS.storage.keptNoSize);
    expect(storageNote(false, null).text).toBe(PWA_STRINGS.storage.atRiskNoSize);
    expect(storageNote(false, 0).text).toBe(PWA_STRINGS.storage.atRiskNoSize);
    expect(storageNote(true, null).text).not.toContain('{size}');
  });
  it('suggests installing only for an unprotected download', () => {
    expect(storageNote(false, 295e6, true).text).toContain(PWA_STRINGS.storage.installHint);
    expect(storageNote(true, 295e6, true).text).not.toContain(PWA_STRINGS.storage.installHint);
  });
});

/** A fake navigator.wakeLock: counts requests and releases, and can refuse. */
function fakeWakeLock() {
  const state = { requests: 0, releases: 0, visible: true, refuse: false, sentinels: [] as Array<WakeSentinel & { fire: () => void }> };
  const request = async () => {
    state.requests++;
    if (state.refuse) throw new DOMException('not allowed', 'NotAllowedError');
    let onRelease = () => {};
    const s = {
      release: async () => {
        state.releases++;
      },
      addEventListener: (_: 'release', f: () => void) => {
        onRelease = f;
      },
      /** The browser taking the lock away itself (page hidden). */
      fire: () => onRelease(),
    };
    state.sentinels.push(s);
    return s;
  };
  return { state, env: { request, visible: () => state.visible } };
}

describe('wake lock keeper', () => {
  it('takes the lock on hold and lets it go on release', async () => {
    const { state, env } = fakeWakeLock();
    const k = createWakeLockKeeper(env);
    expect(state.requests).toBe(0);
    await k.hold('duel');
    expect(state.requests).toBe(1);
    expect(k.locked).toBe(true);
    await k.release('duel');
    expect(state.releases).toBe(1);
    expect(k.locked).toBe(false);
  });

  it('asks once however many hold it, and lets go only with the last', async () => {
    const { state, env } = fakeWakeLock();
    const k = createWakeLockKeeper(env);
    await k.hold('duel');
    await k.hold('theatre');
    await k.hold('duel');
    expect(state.requests).toBe(1);
    await k.release('duel');
    expect(state.releases).toBe(0);
    expect(k.locked).toBe(true);
    await k.release('theatre');
    expect(state.releases).toBe(1);
  });

  it('lets go when the page is hidden and takes it again when it is back', async () => {
    const { state, env } = fakeWakeLock();
    const k = createWakeLockKeeper(env);
    await k.hold('duel');
    state.visible = false;
    await k.visibilityChanged();
    expect(state.releases).toBe(1);
    expect(k.locked).toBe(false);
    state.visible = true;
    await k.visibilityChanged();
    expect(state.requests).toBe(2);
    expect(k.locked).toBe(true);
  });

  it('takes it again after the browser dropped it by itself', async () => {
    const { state, env } = fakeWakeLock();
    const k = createWakeLockKeeper(env);
    await k.hold('duel');
    state.sentinels[0].fire();
    expect(k.locked).toBe(false);
    await k.visibilityChanged();
    expect(state.requests).toBe(2);
    // The dropped lock was not released a second time by us.
    expect(state.releases).toBe(0);
  });

  it('does not take it back on return if the duel ended while hidden', async () => {
    const { state, env } = fakeWakeLock();
    const k = createWakeLockKeeper(env);
    await k.hold('duel');
    state.visible = false;
    await k.visibilityChanged();
    await k.release('duel');
    state.visible = true;
    await k.visibilityChanged();
    expect(state.requests).toBe(1);
  });

  it('does not ask while hidden, and asks on becoming visible', async () => {
    const { state, env } = fakeWakeLock();
    state.visible = false;
    const k = createWakeLockKeeper(env);
    await k.hold('duel');
    expect(state.requests).toBe(0);
    state.visible = true;
    await k.visibilityChanged();
    expect(state.requests).toBe(1);
  });

  it('lets go of a lock that arrives after the duel already ended', async () => {
    const { state, env } = fakeWakeLock();
    const k = createWakeLockKeeper(env);
    const asking = k.hold('duel');
    void k.release('duel');
    await asking;
    expect(state.requests).toBe(1);
    expect(state.releases).toBe(1);
    expect(k.locked).toBe(false);
  });

  it('asks only once while a request is still in flight', async () => {
    const { state, env } = fakeWakeLock();
    const k = createWakeLockKeeper(env);
    const a = k.hold('duel');
    const b = k.visibilityChanged();
    await Promise.all([a, b]);
    expect(state.requests).toBe(1);
  });

  it('is silent where the browser has no wake lock', async () => {
    const k = createWakeLockKeeper({ request: null, visible: () => true });
    await expect(k.hold('duel')).resolves.toBeUndefined();
    await expect(k.release('duel')).resolves.toBeUndefined();
    expect(k.locked).toBe(false);
  });

  it('is silent when the browser refuses, and does not retry in a loop', async () => {
    const { state, env } = fakeWakeLock();
    state.refuse = true;
    const k = createWakeLockKeeper(env);
    await expect(k.hold('duel')).resolves.toBeUndefined();
    expect(state.requests).toBe(1);
    expect(k.locked).toBe(false);
    // The next visibility change is a fair moment to try again.
    state.refuse = false;
    await k.visibilityChanged();
    expect(state.requests).toBe(2);
    expect(k.locked).toBe(true);
  });
});

describe('what may stay in the service worker cache after sign-out', () => {
  const O = 'https://sonnetman.inspiredmile.com';
  it('keeps build files, images, fonts, sounds and pages', () => {
    for (const p of ['/', '/battle', '/cards/DC-001/', '/offline.html', '/_astro/a.abc123.js', '/images/cards/DC-001.webp', '/fonts/inter-latin.woff2', '/audio/sfx/hit.mp3', '/icon-192.png']) {
      expect(mayStayCached(O + p, O), p).toBe(true);
    }
  });
  it('never keeps anything under /api, with a query string, from another origin, or unparseable', () => {
    for (const u of [`${O}/api`, `${O}/api/v1/auth/me`, `${O}/api/v1/cards`, `${O}/battle?token=abc`, `${O}/_astro/a.js?x=1`, 'https://elsewhere.example/battle', `${O}/manifest.json`, `${O}/models/sm-001.glb`, 'http://[bad']) {
      expect(mayStayCached(u, O), u).toBe(false);
    }
  });
});
