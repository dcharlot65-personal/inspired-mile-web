/**
 * Story Mode — PvE campaign with 5 Acts.
 * Each act has themed encounters against AI opponents.
 * Progress persists to localStorage + server sync.
 */

export interface Encounter {
  id: string;
  name: string;
  description: string;
  opponent: string; // card ID of the AI opponent
  difficulty: 'easy' | 'medium' | 'hard';
  narrative: string;
}

export interface Act {
  id: number;
  name: string;
  setting: string;
  description: string;
  encounters: Encounter[];
}

export interface StoryProgress {
  currentAct: number;
  completedEncounters: string[];
  totalStars: number; // 1-3 stars per encounter
}

const STORAGE_KEY = 'inspired-mile-story';

export const ACTS: Act[] = [
  {
    id: 1,
    name: 'The Streets of Verona',
    setting: 'Verona',
    description: 'Begin your journey in the sun-drenched streets where Montagues and Capulets clash.',
    encounters: [
      { id: '1-1', name: 'Street Brawl', description: 'A Capulet servant challenges you.', opponent: 'CA-002', difficulty: 'easy', narrative: 'The morning air is thick with tension. A Capulet servant blocks your path, hand on his sword hilt. "Do you bite your thumb at me, sir?"' },
      { id: '1-2', name: 'The Nurse\'s Riddle', description: 'Answer the Nurse\'s wordplay challenge.', opponent: 'VC-003', difficulty: 'easy', narrative: 'The Nurse waddles toward you, chuckling. "Young one, if you seek Romeo, you must first prove your wit is sharp enough for Verona\'s courts."' },
      { id: '1-3', name: 'Mercutio\'s Challenge', description: 'Face the silver-tongued Mercutio.', opponent: 'MO-002', difficulty: 'medium', narrative: '"A plague on both your houses!" Mercutio cries, but his eyes sparkle. "Come, match me word for word, and I shall tell you of Queen Mab."' },
      { id: '1-4', name: 'The Prince\'s Judgment', description: 'Prove your worth before Prince Escalus.', opponent: 'VC-001', difficulty: 'medium', narrative: 'Prince Escalus summons you to the palace. "Too many have died in these streets. Show me you wield words, not swords, and I will grant you passage."' },
    ],
  },
  {
    id: 2,
    name: 'The Halls of Elsinore',
    setting: 'Denmark',
    description: 'Something is rotten in the state of Denmark. Unravel the court\'s dark secrets.',
    encounters: [
      { id: '2-1', name: 'The Ghost\'s Warning', description: 'Decipher the ghost\'s cryptic verse.', opponent: 'DC-003', difficulty: 'medium', narrative: 'On the battlements at midnight, a spectral figure appears. The dead king\'s ghost — or is it? The spirit speaks in riddles that only a true wordsmith can untangle.' },
      { id: '2-2', name: 'Ophelia\'s Garden', description: 'A poetic duel among the flowers.', opponent: 'DC-002', difficulty: 'easy', narrative: 'In the castle garden, Ophelia weaves flower crowns and speaks in the language of blooms. "There\'s rosemary, that\'s for remembrance. Can you read my floral verses?"' },
      { id: '2-3', name: 'The Mousetrap', description: 'Outsmart the cunning King Claudius.', opponent: 'DC-003', difficulty: 'hard', narrative: '"The play\'s the thing wherein I\'ll catch the conscience of the king." You must perform a verse so piercing that truth itself takes the stage.' },
      { id: '2-4', name: 'Hamlet\'s Soliloquy', description: 'Face the prince himself in a battle of words.', opponent: 'DC-001', difficulty: 'hard', narrative: 'In the great hall, Hamlet paces. "To be, or not to be..." He turns to you. "But what is YOUR answer, stranger? Speak, and let the cosmos judge."' },
    ],
  },
  {
    id: 3,
    name: 'The Enchanted Forest',
    setting: 'Forest of Arden',
    description: 'Wander through a magical wood where fairies play and mortals dream.',
    encounters: [
      { id: '3-1', name: 'Puck\'s Pranks', description: 'Outwit the mischievous sprite.', opponent: 'FA-001', difficulty: 'easy', narrative: '"Lord, what fools these mortals be!" Puck somersaults from a mushroom ring. "Catch me in a verse, mortal, and I\'ll lead you to the fairy queen."' },
      { id: '3-2', name: 'Bottom\'s Dream', description: 'Navigate a dreamer\'s riddle.', opponent: 'FA-004', difficulty: 'medium', narrative: 'Bottom stumbles through the trees, half-man, half-donkey, entirely confused. "I have had a most rare vision! Help me speak it, and I shall share the queen\'s favor."' },
      { id: '3-3', name: 'Titania\'s Court', description: 'Perform before the fairy queen.', opponent: 'FA-002', difficulty: 'medium', narrative: 'The fairy queen reclines on a bed of moonflowers. "Mortal, your kind amuse me. Weave words that shimmer like starlight, and I shall grant you a boon."' },
      { id: '3-4', name: 'Oberon\'s Trial', description: 'Face the fairy king\'s judgment.', opponent: 'FA-003', difficulty: 'hard', narrative: 'Oberon materializes from shadow. "You have danced through my domain uninvited. Only mastery of language earns safe passage. Begin."' },
    ],
  },
  {
    id: 4,
    name: 'Tempest Island',
    setting: 'The Tempest',
    description: 'Shipwrecked on a mysterious island ruled by a powerful sorcerer.',
    encounters: [
      { id: '4-1', name: 'Caliban\'s Rage', description: 'Survive Caliban\'s fury.', opponent: 'TP-003', difficulty: 'medium', narrative: '"This island\'s mine!" Caliban howls from his cave. "You taught me language, and my profit on\'t is, I know how to curse. Let us see whose curses ring truer."' },
      { id: '4-2', name: 'Ariel\'s Song', description: 'Match the spirit\'s ethereal verse.', opponent: 'TP-002', difficulty: 'medium', narrative: 'Ariel floats on the wind, singing of coral bones and sea-changes. "Full fathom five... Can you sing of depths I have not seen, mortal?"' },
      { id: '4-3', name: 'Miranda\'s Wonder', description: 'Impress Prospero\'s daughter.', opponent: 'TP-004', difficulty: 'easy', narrative: '"O brave new world, that has such people in\'t!" Miranda gasps at the sight of you. "Tell me of the world beyond these shores in verse."' },
      { id: '4-4', name: 'Prospero\'s Final Test', description: 'Face the sorcerer-king himself.', opponent: 'TP-001', difficulty: 'hard', narrative: 'Prospero stands at the island\'s peak, staff raised. "Every third thought shall be my grave. But first — show me that language itself is magic enough."' },
    ],
  },
  {
    id: 5,
    name: 'The Globe Theatre',
    setting: 'London',
    description: 'The final act. Face Shakespeare\'s greatest characters on the world\'s stage.',
    encounters: [
      { id: '5-1', name: 'The Scottish King', description: 'Face the bloody Macbeth.', opponent: 'SC-001', difficulty: 'hard', narrative: 'The stage is set for tragedy. Macbeth stands bloodied, crown askew. "Tomorrow, and tomorrow, and tomorrow..." Can you match the weight of his despair?' },
      { id: '5-2', name: 'Rome\'s Betrayal', description: 'Debate with Brutus himself.', opponent: 'RM-001', difficulty: 'hard', narrative: '"Not that I loved Caesar less, but that I loved Rome more." Brutus turns to you from the Senate steps. "Convince me, stranger, that words can mend what daggers broke."' },
      // Not The Sonnet Man: a real performer's persona, which the game neither deals to its opponent nor gives invented lines
      // (owner decision D-04, 2026-11-19; doc 07 §6). Mark Antony closes the Roman story Brutus opens in 5-2.
      { id: '5-3', name: 'The Final Bow', description: 'Face Mark Antony in the ultimate battle.', opponent: 'RM-003', difficulty: 'hard', narrative: 'The Globe Theatre falls silent. A single spotlight illuminates Mark Antony himself. "Friends, Romans, countrymen, lend me your ears! You have played your part well. Now — one last verse, and the curtain falls."' },
    ],
  },
];

function defaultProgress(): StoryProgress {
  return { currentAct: 1, completedEncounters: [], totalStars: 0 };
}

export function getStoryProgress(): StoryProgress {
  if (typeof window === 'undefined') return defaultProgress();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();
    return { ...defaultProgress(), ...JSON.parse(raw) };
  } catch {
    return defaultProgress();
  }
}

function saveStoryProgress(progress: StoryProgress): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch { /* quota */ }
}

/** Mark an encounter as completed */
export function completeEncounter(encounterId: string, stars: number): StoryProgress {
  const progress = getStoryProgress();
  if (!progress.completedEncounters.includes(encounterId)) {
    progress.completedEncounters.push(encounterId);
    progress.totalStars += Math.min(3, Math.max(1, stars));
  }

  // Check if current act is complete and advance
  const currentAct = ACTS.find(a => a.id === progress.currentAct);
  if (currentAct) {
    const allDone = currentAct.encounters.every(e =>
      progress.completedEncounters.includes(e.id)
    );
    if (allDone && progress.currentAct < ACTS.length) {
      progress.currentAct += 1;
    }
  }

  saveStoryProgress(progress);
  return progress;
}

/** Check if an encounter is unlocked (all previous encounters in the act must be completed) */
export function isEncounterUnlocked(encounterId: string): boolean {
  const progress = getStoryProgress();

  for (const act of ACTS) {
    if (act.id > progress.currentAct) return false;
    for (const encounter of act.encounters) {
      if (encounter.id === encounterId) return true;
      if (act.id === progress.currentAct && !progress.completedEncounters.includes(encounter.id)) {
        return false;
      }
    }
  }
  return false;
}

/** Get total encounter count */
export function getTotalEncounters(): number {
  return ACTS.reduce((sum, act) => sum + act.encounters.length, 0);
}

const DIGICARD_TOKEN_RE = /^IM[12]-[A-Za-z0-9_.-]{4,}$/;

export interface SovereignCardSummary {
  token: string;
  format: 'IM1' | 'IM2';
  uid: string;
  elo: number;
  wins: number;
  losses: number;
  captures: number;
  promotions: number;
  verses: number;
  stage: number;
  rarity: string;
  hasChessFeats: boolean;
}

/**
 * Cross-Mile Return-Portal martial couplets for Acts 1..5 ("Iron Resonance").
 * Spoken by The Citadelle Chorus — never attributed to The Sonnet Man (Owner Decision D-04).
 */
export const IRON_RESONANCE_STANZAS: Record<number, { title: string; couplet: string }> = {
  1: {
    title: 'The Citadelle Chorus — Act I: Iron of Verona',
    couplet:
      "Where fair Verona's blades in sunlight gleam,\nHigh Citadelle's forged iron crowns your theme.",
  },
  2: {
    title: 'The Citadelle Chorus — Act II: Watch of the Chevalye',
    couplet:
      "On Elsinore's dark walls where phantoms pace,\nBold Chevalye in iron holds each space.",
  },
  3: {
    title: 'The Citadelle Chorus — Act III: Lantern of the Manbo',
    couplet:
      "Through Arden's moonlit boughs where spirits play,\nWise Manbo's iron drumbeat clears your way.",
  },
  4: {
    title: 'The Citadelle Chorus — Act IV: Tempest Ayibobo',
    couplet:
      "Though wild seas crash on Prospero's lone shore,\nCry Ayibobo: iron tames the roar!",
  },
  5: {
    title: 'The Citadelle Chorus — Act V: Crown of the Anperè',
    couplet:
      "Upon the Globe's great stage where empires fall,\nCrowned Anperè in iron answers all.",
  },
};

const DIGICARD_STORAGE_KEYS = [
  'im-digicard',
  'cf-digicard',
  'digicard',
  'inspired-mile-digicard',
  'sovereign-card',
  'im2_token',
  'im1_token',
] as const;

function decodeBase64UrlUtf8(b64url: string): string | null {
  if (!b64url || !/^[A-Za-z0-9_-]+$/.test(b64url)) return null;
  const normalized = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  try {
    if (typeof atob !== 'function') return null;
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function toSafeInt(value: unknown, fallback: number): number {
  const num =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(num) ? Math.trunc(num) : fallback;
}

/** Extract a valid IM1- or IM2- Sovereign DigiCard token from a raw string or JSON wrapper. */
export function extractDigiCardToken(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (DIGICARD_TOKEN_RE.test(trimmed)) return trimmed;
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      for (const field of ['im2_token', 'im1_token', 'token', 'card', 'cardToken']) {
        const candidate = parsed[field];
        if (typeof candidate === 'string' && DIGICARD_TOKEN_RE.test(candidate.trim())) {
          return candidate.trim();
        }
      }
    } catch {
      return null;
    }
  }
  return null;
}

/** Decode an IM1- or IM2- Sovereign DigiCard token into live Cross-Mile martial summary stats. */
export function decodeDigiCardSummary(rawToken: string | null | undefined): SovereignCardSummary | null {
  const token = extractDigiCardToken(rawToken);
  if (!token) return null;

  if (token.startsWith('IM1-')) {
    return {
      token,
      format: 'IM1',
      uid: token.slice(4, 16),
      elo: 1200,
      wins: 1,
      losses: 0,
      captures: 1,
      promotions: 0,
      verses: 0,
      stage: 1,
      rarity: 'Tempered',
      hasChessFeats: true,
    };
  }

  if (token.startsWith('IM2-')) {
    const body = token.slice(4);
    const parts = body.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1] || !/^[A-Za-z0-9_-]+$/.test(parts[1])) {
      return null;
    }
    const jsonText = decodeBase64UrlUtf8(parts[0]);
    if (!jsonText) return null;
    try {
      const parsed = JSON.parse(jsonText) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      const p = parsed as Record<string, unknown>;
      const elo = toSafeInt(p.elo, 1200);
      const wins = Math.max(0, toSafeInt(p.w ?? p.wins, 0));
      const losses = Math.max(0, toSafeInt(p.l ?? p.losses, 0));
      const captures = Math.max(0, toSafeInt(p.captures ?? p.caps, 0));
      const promotions = Math.max(0, toSafeInt(p.promotions ?? p.promos, 0));
      const verses = Math.max(0, toSafeInt(p.verses, 0));
      const stage = Math.max(1, toSafeInt(p.stage, 1));
      const origin = typeof p.origin === 'string' ? p.origin.trim().toLowerCase() : '';
      const hasChessFeats = Boolean(
        captures > 0 || promotions > 0 || wins > 0 || elo !== 1200 || origin === 'chessfighter',
      );
      const uid =
        typeof p.uid === 'string' && p.uid.trim()
          ? p.uid.trim()
          : typeof p.id === 'string' && p.id.trim()
            ? p.id.trim()
            : parts[0].slice(0, 12);
      const rarity =
        typeof p.rarity === 'string' && p.rarity.trim()
          ? p.rarity.trim()
          : hasChessFeats
            ? 'Tempered'
            : 'Common';

      return {
        token,
        format: 'IM2',
        uid,
        elo,
        wins,
        losses,
        captures,
        promotions,
        verses,
        stage,
        rarity,
        hasChessFeats,
      };
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Read any active IM1- or IM2- Sovereign DigiCard token from URL params or localStorage.
 * Valid `?card=IM...` / `#card=IM...` URL tokens are persisted to `localStorage.setItem('cf-digicard', token)`
 * so the player's card stays bound across visits.
 */
export function getActiveDigiCardToken(
  storage: (Pick<Storage, 'getItem' | 'length' | 'key'> & Partial<Pick<Storage, 'setItem'>>) | null = typeof window !== 'undefined' ? window.localStorage : null,
  locationOverride?: { search?: string; hash?: string } | null,
): string | null {
  const loc =
    locationOverride !== undefined
      ? locationOverride
      : typeof window !== 'undefined'
        ? window.location
        : null;
  if (loc) {
    try {
      const fromSearch = extractDigiCardToken(new URLSearchParams(loc.search ?? '').get('card'));
      const fromHash = extractDigiCardToken(new URLSearchParams((loc.hash ?? '').replace(/^#/, '')).get('card'));
      const fromUrl = fromSearch ?? fromHash;
      if (fromUrl) {
        try {
          if (storage && typeof storage.setItem === 'function') {
            storage.setItem('cf-digicard', fromUrl);
          } else if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem('cf-digicard', fromUrl);
          }
        } catch {
          /* ignore storage quota / private mode errors */
        }
        return fromUrl;
      }
    } catch {
      /* ignore URL parse errors */
    }
  }
  if (!storage) return null;
  try {
    for (const key of DIGICARD_STORAGE_KEYS) {
      const token = extractDigiCardToken(storage.getItem(key));
      if (token) return token;
    }
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && /digicard|sovereign|im[12][_-]?token/i.test(key)) {
        const token = extractDigiCardToken(storage.getItem(key));
        if (token) return token;
      }
    }
  } catch {
    /* storage unavailable */
  }
  return null;
}

/**
 * Build the Cross-Mile Chess Fighter 3D Act II Odyssey URL for a Sonnet Man Act (1..5 -> chapter 7..11)
 * or encounter ID ('1-1'..'5-3'), appending `&card=<token>` when an active Sovereign DigiCard is present.
 */
export function getChessFighterStoryUrl(
  encounterOrAct: string | number,
  tokenOverride?: string | null,
): string {
  const rawAct = typeof encounterOrAct === 'number'
    ? encounterOrAct
    : Number.parseInt(String(encounterOrAct).split('-')[0], 10);
  const actNum = Number.isFinite(rawAct) ? Math.min(5, Math.max(1, rawAct)) : 1;
  const chapter = 6 + actNum;
  const base = `https://chessfighter.inspiredmile.com/#mode=story&chapter=${chapter}`;
  const token = tokenOverride !== undefined ? extractDigiCardToken(tokenOverride) : getActiveDigiCardToken();
  return token ? `${base}&card=${encodeURIComponent(token)}` : base;
}

/**
 * Build the Chess Fighter World Tour Parlor & Arena URL, appending `&card=<token>` when bound.
 */
export function getChessFighterWorldTourUrl(tokenOverride?: string | null): string {
  const base = 'https://chessfighter.inspiredmile.com/#mode=world';
  const token = tokenOverride !== undefined ? extractDigiCardToken(tokenOverride) : getActiveDigiCardToken();
  return token ? `${base}&card=${encodeURIComponent(token)}` : base;
}
