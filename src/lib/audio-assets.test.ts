/**
 * The sound the site ships (owner decision D-08, 2026-11-19).
 *
 * - Music ships only where its source is traced: the two tracks found byte for byte on
 *   OpenGameArt under CC0 (by sha256; the record is docs/ASSETS.md on fix/compliance). The two
 *   tracks nobody could trace (playground-ambient, collection-browse) were removed, and the pages
 *   that played them are silent.
 * - Every effect shipped is played somewhere. Two were only ever preloaded (card-flip, ui-whoosh)
 *   and were removed. The other twelve are untraced too and are to be replaced within a month.
 * - Nothing asks for a file that is not there.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const MUSIC = 'public/audio/music';
const SFX = 'public/audio/sfx';

/** Music whose source is traced: file name to sha256 of the file as found at its source. */
const TRACED_MUSIC: Record<string, string> = {
  // "Battle Theme A" by cynicmusic, opengameart.org/content/battle-theme-a, CC0 1.0
  'battle-beat.mp3': '6042399782e581d753d616bc703e66483d5eccb5fb687a20c9a552d68c49e620',
  // "Oldschool Horror Theme" by EmoPreben, opengameart.org/content/oldschool-horror-theme, CC0 1.0
  'landing-ambient.mp3': 'f8e31242051774cbeecefcba44122c09c111ca485787b4245c23ac5dce25c86e',
};

const files = (dir: string) => readdirSync(dir).filter((f) => !f.startsWith('.')).sort();
const sha256 = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.(astro|ts|tsx)$/.test(name) && !name.endsWith('.test.ts') ? [full] : [];
  });
}
const code = sources('src').map((f) => readFileSync(f, 'utf8')).join('\n');
const audioManager = readFileSync('src/lib/audio-manager.ts', 'utf8');

const calls = (fn: string) => new Set([...code.matchAll(new RegExp(`\\b${fn}\\(\\s*'([a-z-]+)'`, 'g'))].map((m) => m[1]));
const preloaded = new Set([...code.matchAll(/\bpreloadSfx\(\s*\[([^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/'([a-z-]+)'/g)].map((x) => x[1])));
/** What playRarityFanfare plays: the values of its rarity map. */
const fanfares = new Set([...(audioManager.match(/playRarityFanfare[\s\S]*?\{([\s\S]*?)\};/)?.[1] ?? '').matchAll(/'([a-z-]+)'/g)].map((m) => m[1]));
/** The names a type union in audio-manager.ts allows. */
const union = (name: string) => new Set([...(audioManager.match(new RegExp(`export type ${name} =([^;]*);`))?.[1] ?? '').matchAll(/'([a-z-]+)'/g)].map((m) => m[1]));

describe('the sound the site ships', () => {
  it('reads the code it checks (the scan itself works)', () => {
    expect(calls('playSfx').has('ui-click')).toBe(true);
    expect(calls('playMusic').has('battle-beat')).toBe(true);
    expect(fanfares).toEqual(new Set(['fanfare-common', 'fanfare-rare', 'fanfare-legendary']));
    expect(union('SfxName').size).toBeGreaterThan(5);
  });

  it('ships music only where its source is traced, byte for byte', () => {
    const untraced = files(MUSIC).filter((f) => TRACED_MUSIC[f] !== sha256(path.join(MUSIC, f)));
    expect(untraced).toEqual([]);
  });

  it('plays every music track it ships, and asks for no track it does not ship', () => {
    const shipped = files(MUSIC).map((f) => f.replace(/\.mp3$/, ''));
    expect([...calls('playMusic')].sort()).toEqual(shipped);
    expect([...union('MusicTrack')].sort()).toEqual(shipped);
  });

  it('plays every sound effect it ships (preloading one is not playing it)', () => {
    const played = new Set([...calls('playSfx'), ...fanfares]);
    const never = files(SFX).map((f) => f.replace(/\.wav$/, '')).filter((n) => !played.has(n));
    expect(never).toEqual([]);
  });

  it('asks for no effect it does not ship, and its type lists exactly the effects it ships', () => {
    const shipped = new Set(files(SFX).map((f) => f.replace(/\.wav$/, '')));
    const missing = [...new Set([...calls('playSfx'), ...preloaded, ...fanfares])].filter((n) => !shipped.has(n)).sort();
    expect(missing).toEqual([]);
    expect([...union('SfxName')].sort()).toEqual([...shipped].sort());
  });
});
