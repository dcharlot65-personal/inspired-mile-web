// Audio Manager — Web Audio API soundscape for Inspired Mile
// Handles background music, sound effects, volume control, and TTS ducking.
// All errors are caught silently — audio is enhancement, not critical.

export type MusicTrack = 'battle-beat' | 'playground-ambient' | 'collection-browse' | 'landing-ambient';

export type SfxName =
  | 'card-flip' | 'card-shimmer'
  | 'fanfare-common' | 'fanfare-rare' | 'fanfare-legendary'
  | 'trivia-correct' | 'trivia-wrong'
  | 'battle-victory' | 'battle-defeat'
  | 'ui-click' | 'ui-whoosh'
  | 'pack-open' | 'challenge-win' | 'challenge-lose';

import type { Rarity } from './cards';
export type { Rarity };

export interface AudioPrefs {
  muted: boolean;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  musicEnabled: boolean;
}

const STORAGE_KEY = 'inspired-mile-audio-prefs';

const DEFAULT_PREFS: AudioPrefs = {
  muted: false,
  masterVolume: 0.8,
  musicVolume: 0.5,
  sfxVolume: 0.8,
  musicEnabled: true,
};

const DUCK_LEVEL = 0.15;
const DUCK_FADE_MS = 300;
const UNDUCK_FADE_MS = 500;

// Module state
let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let currentMusic: { source: AudioBufferSourceNode; name: string } | null = null;
let musicBufferCache = new Map<string, AudioBuffer>();
let sfxBufferCache = new Map<string, AudioBuffer>();
let prefs: AudioPrefs = loadPrefs();
let ducking = false;

// --- Preferences (localStorage) ---

function loadPrefs(): AudioPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_PREFS };
}

function savePrefs(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {}
}

export function getPrefs(): AudioPrefs {
  return { ...prefs };
}

export function setMuted(muted: boolean): void {
  prefs.muted = muted;
  savePrefs();
  applyVolumes();
}

export function toggleMute(): boolean {
  prefs.muted = !prefs.muted;
  savePrefs();
  applyVolumes();
  return prefs.muted;
}

export function setMasterVolume(vol: number): void {
  prefs.masterVolume = Math.max(0, Math.min(1, vol));
  savePrefs();
  applyVolumes();
}

export function setMusicVolume(vol: number): void {
  prefs.musicVolume = Math.max(0, Math.min(1, vol));
  savePrefs();
  applyVolumes();
}

export function setSfxVolume(vol: number): void {
  prefs.sfxVolume = Math.max(0, Math.min(1, vol));
  savePrefs();
  applyVolumes();
}

export function setMusicEnabled(enabled: boolean): void {
  prefs.musicEnabled = enabled;
  savePrefs();
  if (!enabled) stopMusic(300);
}

function applyVolumes(): void {
  if (!audioCtx || !masterGain || !musicGain || !sfxGain) return;
  const now = audioCtx.currentTime;
  const master = prefs.muted ? 0 : prefs.masterVolume;
  masterGain.gain.setTargetAtTime(master, now, 0.05);
  if (!ducking) {
    musicGain.gain.setTargetAtTime(prefs.musicVolume, now, 0.05);
  }
  sfxGain.gain.setTargetAtTime(prefs.sfxVolume, now, 0.05);
}

// --- Initialization ---

export function initAudio(): boolean {
  if (audioCtx && audioCtx.state !== 'closed') {
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return true;
  }
  try {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtxClass) return false;
    audioCtx = new AudioCtxClass();

    masterGain = audioCtx.createGain();
    musicGain = audioCtx.createGain();
    sfxGain = audioCtx.createGain();

    musicGain.connect(masterGain);
    sfxGain.connect(masterGain);
    masterGain.connect(audioCtx.destination);

    applyVolumes();
    return true;
  } catch {
    return false;
  }
}

export function isInitialized(): boolean {
  return audioCtx !== null && audioCtx.state !== 'closed';
}

// --- Audio Loading ---

async function loadAudioBuffer(url: string): Promise<AudioBuffer | null> {
  if (!audioCtx) return null;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const arrayBuf = await resp.arrayBuffer();
    return await audioCtx.decodeAudioData(arrayBuf);
  } catch {
    return null;
  }
}

// --- Music Playback ---

export async function playMusic(name: MusicTrack, fadeInMs = 500): Promise<void> {
  if (!audioCtx || !musicGain || !prefs.musicEnabled) return;
  if (prefs.muted) return;
  if (currentMusic?.name === name) return; // already playing this track

  // Stop current music with crossfade
  if (currentMusic) {
    stopMusic(fadeInMs);
  }

  let buffer = musicBufferCache.get(name);
  if (!buffer) {
    buffer = await loadAudioBuffer(`/audio/music/${name}.mp3`) ?? undefined;
    if (!buffer) return;
    musicBufferCache.set(name, buffer);
  }

  if (!audioCtx || !musicGain) return; // context may have been disposed during load

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(musicGain);

  // Fade in
  const now = audioCtx.currentTime;
  const targetVol = ducking ? DUCK_LEVEL : prefs.musicVolume;
  musicGain.gain.setValueAtTime(0, now);
  musicGain.gain.linearRampToValueAtTime(targetVol, now + fadeInMs / 1000);

  source.start(0);
  currentMusic = { source, name };

  source.onended = () => {
    if (currentMusic?.source === source) currentMusic = null;
  };
}

export function stopMusic(fadeOutMs = 500): void {
  if (!audioCtx || !musicGain || !currentMusic) return;
  const now = audioCtx.currentTime;
  const source = currentMusic.source;
  currentMusic = null;

  musicGain.gain.setValueAtTime(musicGain.gain.value, now);
  musicGain.gain.linearRampToValueAtTime(0, now + fadeOutMs / 1000);

  setTimeout(() => {
    try { source.stop(); } catch {}
  }, fadeOutMs + 50);
}

export function isMusicPlaying(): boolean {
  return currentMusic !== null;
}

// --- SFX Playback ---

export async function playSfx(name: SfxName): Promise<void> {
  if (!audioCtx || !sfxGain || prefs.muted) return;

  let buffer = sfxBufferCache.get(name);
  if (!buffer) {
    buffer = await loadAudioBuffer(`/audio/sfx/${name}.wav`) ?? undefined;
    if (!buffer) return;
    sfxBufferCache.set(name, buffer);
  }

  if (!audioCtx || !sfxGain) return;

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(sfxGain);
  source.start(0);
}

export async function preloadSfx(names: SfxName[]): Promise<void> {
  await Promise.allSettled(
    names.map(async (name) => {
      if (sfxBufferCache.has(name)) return;
      const buffer = await loadAudioBuffer(`/audio/sfx/${name}.wav`);
      if (buffer) sfxBufferCache.set(name, buffer);
    })
  );
}

// --- Rarity Fanfare ---

export async function playRarityFanfare(rarity: Rarity): Promise<void> {
  const map: Record<Rarity, SfxName> = {
    Common: 'fanfare-common',
    Uncommon: 'fanfare-common',
    Rare: 'fanfare-rare',
    Epic: 'fanfare-rare',
    Legendary: 'fanfare-legendary',
  };
  await playSfx(map[rarity]);
}

// --- TTS Ducking ---

export function duckMusic(): void {
  if (!audioCtx || !musicGain || ducking) return;
  ducking = true;
  const now = audioCtx.currentTime;
  musicGain.gain.setValueAtTime(musicGain.gain.value, now);
  musicGain.gain.linearRampToValueAtTime(DUCK_LEVEL, now + DUCK_FADE_MS / 1000);
}

export function unduckMusic(): void {
  if (!audioCtx || !musicGain || !ducking) return;
  ducking = false;
  const now = audioCtx.currentTime;
  musicGain.gain.setValueAtTime(musicGain.gain.value, now);
  musicGain.gain.linearRampToValueAtTime(prefs.musicVolume, now + UNDUCK_FADE_MS / 1000);
}

// --- Cleanup ---

export function dispose(): void {
  stopMusic(0);
  try { audioCtx?.close(); } catch {}
  audioCtx = null;
  masterGain = null;
  musicGain = null;
  sfxGain = null;
  currentMusic = null;
  musicBufferCache.clear();
  sfxBufferCache.clear();
  ducking = false;
}
