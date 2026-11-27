/**
 * Cross-Mile `CFW1` Spoken Sanctuary Portal for `sonnetman.inspiredmile.com` (`inspired-mile-web`).
 *
 * - Renders 4 curated `CFW1` community worlds immediately with zero network wait, then hydrates
 *   live community worlds from `https://chessfighter.inspiredmile.com/ws/worlds` once the
 *   visitor has passed the age check (`adult` or `teen-consented`).
 * - Surfaces the 30-Day Embedded Open-Model Smart List (`Tier-0 Rust 0ms`, `Inkling 2 Mini`,
 *   `Liquid AI LFM 3.5`, `Gemma 4 E2B Web`, `Qwen 3.6 WebLLM`, `Nemotron 3.5 ASR`, `Mistral Large 4`).
 * - Re-renders all localized interface badges (`1 · Simple` / `2 · Painted`, `"Enter Morphed Arena →"`,
 *   vault status, and localized upvote digits) whenever the visitor switches among the 16 languages.
 */

import { t } from '../i18n';
import { num } from '../i18n/pages/runtime';

export interface SonnetCfw1World {
  world_id: string;
  code: string;
  title: string;
  spoken_prompt: string;
  author: string;
  paint_stage: 'simple' | 'painted';
  upvotes: number;
}

const CHESSFIGHTER_ORIGIN = 'https://chessfighter.inspiredmile.com';
const WORLDS_ENDPOINT = `${CHESSFIGHTER_ORIGIN}/ws/worlds`;
const AGENT_MORF_ENDPOINT = `${CHESSFIGHTER_ORIGIN}/ws/agent/morf`;
const DEFAULT_WISH = 'rainy night obsidian forge low gravity four towers painted';

export const CURATED_SONNET_WORLDS: ReadonlyArray<SonnetCfw1World> = [
  {
    world_id: 'WLD-03',
    code: 'CFW1-AgICAAH1',
    title: 'GOLDEN SANCTUM CINEMA',
    spoken_prompt: 'golden sanctum pyramid platforms jade staffs painted orbit camera',
    author: 'AITOMAGIC_DIRECTOR',
    paint_stage: 'painted',
    upvotes: 31,
  },
  {
    world_id: 'WLD-01',
    code: 'CFW1-AgMCAAH8',
    title: 'MOONLIT LOW-G TOWERS',
    spoken_prompt: 'obsidian forge wire-fu low gravity four towers painted',
    author: 'SPOKEN_ARCHITECT',
    paint_stage: 'painted',
    upvotes: 26,
  },
  {
    world_id: 'WLD-02',
    code: 'CFW1-AQEBAgF5',
    title: 'GREYBOX WIRE-FU DOJO',
    spoken_prompt: 'simple greybox twin platforms low gravity pure kung-fu',
    author: 'MORF_SENSEI',
    paint_stage: 'simple',
    upvotes: 19,
  },
  {
    world_id: 'WLD-04',
    code: 'CFW1-AAMDBAFy',
    title: 'VOLCANIC SPEAR BRIDGE',
    spoken_prompt: 'citadelle rampart sky bridge viper launchers heavy iron painted',
    author: 'YOTEI_CARTWRIGHT',
    paint_stage: 'painted',
    upvotes: 16,
  },
];

function ageCleared(): boolean {
  try {
    const v = localStorage.getItem('inspired-mile-age-verified');
    return v === 'adult' || v === 'teen-consented';
  } catch {
    return false;
  }
}

export function buildArenaDeepLink(code: string, wish: string, modelId: string): string {
  const cleanWish = (wish.trim() || DEFAULT_WISH).slice(0, 180);
  const cleanModel = modelId.trim() || 'inkling-2-mini';
  return `${CHESSFIGHTER_ORIGIN}/#mode=spoken&cfw1=${encodeURIComponent(code.trim())}&model=${encodeURIComponent(cleanModel)}&wish=${encodeURIComponent(cleanWish)}`;
}

export function buildWishDeepLink(wish: string, modelId: string): string {
  const cleanWish = (wish.trim() || DEFAULT_WISH).slice(0, 180);
  const cleanModel = modelId.trim() || 'inkling-2-mini';
  return `${CHESSFIGHTER_ORIGIN}/#mode=spoken&model=${encodeURIComponent(cleanModel)}&wish=${encodeURIComponent(cleanWish)}`;
}

export function buildAgentMorfCurl(wish: string, modelId: string): string {
  const agentModel = !modelId || modelId === 'tier0-rust' ? 'inkling-2-mini' : modelId;
  const cleanWish = (wish.trim() || DEFAULT_WISH).replace(/["'\\]/g, '').slice(0, 120);
  return `curl -X POST ${AGENT_MORF_ENDPOINT} -H "Content-Type: application/json" -d '{"room":"SANCTUM","model":"${agentModel}","wish":"${cleanWish}"}'`;
}

export interface SpokenPortalHandle {
  refreshLocale: () => void;
}

export function initSonnetSpokenPortal(): SpokenPortalHandle {
  const root = document.getElementById('spoken-sanctuary');
  if (!root) {
    return { refreshLocale: () => {} };
  }

  const modelSelect = root.querySelector<HTMLSelectElement>('[data-spoken-model]');
  const wishInput = root.querySelector<HTMLInputElement>('[data-spoken-wish]');
  const launchLink = root.querySelector<HTMLAnchorElement>('[data-spoken-launch]');
  const micBtn = root.querySelector<HTMLButtonElement>('[data-spoken-mic]');
  const statusEl = root.querySelector<HTMLElement>('[data-spoken-status]');
  const curlEl = root.querySelector<HTMLElement>('[data-spoken-curl]');
  const copyBtn = root.querySelector<HTMLButtonElement>('[data-spoken-copy]');

  let worlds: ReadonlyArray<SonnetCfw1World> = CURATED_SONNET_WORLDS;
  let isLive = false;
  let hydratedOnce = false;

  const getModel = () => modelSelect?.value || 'inkling-2-mini';
  const getWish = () => wishInput?.value || '';

  const syncUrls = () => {
    const model = getModel();
    const wish = getWish();
    if (launchLink) launchLink.href = buildWishDeepLink(wish, model);
    if (curlEl) curlEl.textContent = buildAgentMorfCurl(wish, model);
    const cards = root.querySelectorAll<HTMLElement>('[data-spoken-card]');
    cards.forEach((card, idx) => {
      const w = worlds[idx];
      if (!w) return;
      const link = card.querySelector<HTMLAnchorElement>('[data-spoken-world-link]');
      if (link) {
        link.href = buildArenaDeepLink(w.code, w.spoken_prompt, model);
      }
    });
  };

  const renderCardsAndLocale = () => {
    const model = getModel();
    const cards = root.querySelectorAll<HTMLElement>('[data-spoken-card]');
    cards.forEach((card, idx) => {
      const w = worlds[idx];
      if (!w) {
        card.classList.add('hidden');
        return;
      }
      card.classList.remove('hidden');

      const badge = card.querySelector<HTMLElement>('[data-spoken-badge]');
      if (badge) {
        const isSimple = w.paint_stage === 'simple';
        badge.className = isSimple
          ? 'text-[11px] font-mono px-2.5 py-0.5 rounded-full border border-obsidian-600 text-obsidian-300'
          : 'text-[11px] font-mono px-2.5 py-0.5 rounded-full border border-gold-500/40 bg-gold-500/10 text-gold-300';
        badge.textContent = isSimple ? `${num(1)} · ${t('home.spoken.stageSimple')}` : `${num(2)} · ${t('home.spoken.stagePainted')}`;
      }

      const votes = card.querySelector<HTMLElement>('[data-spoken-votes]');
      if (votes) {
        votes.textContent = `▲ ${num(w.upvotes)}`;
      }

      const title = card.querySelector<HTMLElement>('[data-spoken-title]');
      if (title) {
        title.textContent = w.title;
      }

      const meta = card.querySelector<HTMLElement>('[data-spoken-meta]');
      if (meta) {
        meta.textContent = `${w.code} · "${w.spoken_prompt}"`;
      }

      const link = card.querySelector<HTMLAnchorElement>('[data-spoken-world-link]');
      if (link) {
        link.href = buildArenaDeepLink(w.code, w.spoken_prompt, model);
      }
      const enterText = card.querySelector<HTMLElement>('[data-spoken-enter-label]');
      if (enterText) {
        enterText.textContent = t('home.spoken.enterArena');
      }
    });

    if (statusEl) {
      statusEl.textContent = isLive ? t('home.spoken.vaultLive') : t('home.spoken.vaultCurated');
    }
    if (copyBtn && copyBtn.dataset.copied !== '1') {
      copyBtn.textContent = t('home.spoken.copy');
    }
    if (micBtn && micBtn.dataset.listening !== '1') {
      micBtn.textContent = t('home.spoken.speakBtn');
    }
    syncUrls();
  };

  const tryHydrateLiveVault = () => {
    if (hydratedOnce || !ageCleared()) return;
    hydratedOnce = true;

    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 4500);
    void fetch(WORLDS_ENDPOINT, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json: unknown) => {
        const list = (json as { worlds?: unknown })?.worlds;
        if (!Array.isArray(list) || list.length === 0) return;
        const parsed: SonnetCfw1World[] = [];
        for (const item of list) {
          if (!item || typeof item !== 'object') continue;
          const rec = item as Record<string, unknown>;
          const code = typeof rec.code === 'string' ? rec.code.trim() : '';
          const title = typeof rec.title === 'string' ? rec.title.trim() : '';
          const prompt = typeof rec.spoken_prompt === 'string' ? rec.spoken_prompt.trim() : '';
          if (!code.startsWith('CFW1-') || !title || !prompt) continue;
          parsed.push({
            world_id: typeof rec.world_id === 'string' ? rec.world_id : `WLD-${parsed.length + 1}`,
            code,
            title,
            spoken_prompt: prompt,
            author: typeof rec.author === 'string' ? rec.author : 'MORF_ARCHITECT',
            paint_stage: rec.paint_stage === 'simple' ? 'simple' : 'painted',
            upvotes: typeof rec.upvotes === 'number' ? Math.max(0, Math.round(rec.upvotes)) : 0,
          });
          if (parsed.length >= 4) break;
        }
        if (parsed.length > 0) {
          worlds = parsed;
          isLive = true;
          renderCardsAndLocale();
        }
      })
      .catch(() => {
        isLive = false;
        renderCardsAndLocale();
      })
      .finally(() => window.clearTimeout(timer));
  };

  modelSelect?.addEventListener('change', () => {
    tryHydrateLiveVault();
    syncUrls();
  });
  wishInput?.addEventListener('focus', tryHydrateLiveVault, { once: true });
  wishInput?.addEventListener('input', syncUrls);
  wishInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && launchLink) {
      e.preventDefault();
      launchLink.click();
    }
  });

  copyBtn?.addEventListener('click', () => {
    const text = curlEl?.textContent ?? '';
    if (!text || !navigator.clipboard?.writeText) return;
    void navigator.clipboard.writeText(text).then(() => {
      copyBtn.dataset.copied = '1';
      copyBtn.textContent = t('home.spoken.copied');
      window.setTimeout(() => {
        delete copyBtn.dataset.copied;
        copyBtn.textContent = t('home.spoken.copy');
      }, 1500);
    }).catch(() => {});
  });

  const g = globalThis as Record<string, unknown>;
  const SpeechCtor = g.SpeechRecognition ?? g.webkitSpeechRecognition;
  if (micBtn && typeof SpeechCtor === 'function') {
    micBtn.classList.remove('hidden');
    micBtn.addEventListener('click', () => {
      try {
        const rec = new (SpeechCtor as new () => {
          lang: string;
          interimResults: boolean;
          start(): void;
          onresult: ((ev: { results?: ArrayLike<ArrayLike<{ transcript?: string }>> }) => void) | null;
          onend: (() => void) | null;
          onerror: (() => void) | null;
        })();
        rec.lang = document.documentElement.lang || 'en-US';
        rec.interimResults = false;
        micBtn.dataset.listening = '1';
        micBtn.textContent = '…';
        rec.onresult = (ev) => {
          const transcript = ev.results?.[0]?.[0]?.transcript?.trim() ?? '';
          if (transcript && wishInput) {
            wishInput.value = transcript;
            syncUrls();
          }
        };
        const reset = () => {
          delete micBtn.dataset.listening;
          micBtn.textContent = t('home.spoken.speakBtn');
        };
        rec.onend = reset;
        rec.onerror = reset;
        rec.start();
      } catch {
        delete micBtn.dataset.listening;
        micBtn.textContent = t('home.spoken.speakBtn');
      }
    });
  }

  renderCardsAndLocale();
  if (ageCleared()) {
    tryHydrateLiveVault();
  }

  return { refreshLocale: renderCardsAndLocale };
}
