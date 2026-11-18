/**
 * The privacy policy says how long the server keeps a finished battle's verses; the server's
 * constants say how long it really does. This keeps the two in one place each and checks that
 * they agree, so neither can change alone.
 *
 * backend/src/multiplayer/game_room.rs: a finished room answers for `Timing::linger`, and the
 * sweep, every `SWEEP_EVERY`, then empties and removes it. Its own test holds
 * `linger + SWEEP_EVERY <= POLICY_AFTER_THE_END`. Here: POLICY_AFTER_THE_END is what the policy
 * page says, in every place it says it.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

function seconds(source: string, name: string): number {
  const m = source.match(new RegExp(`const ${name}: Duration = Duration::from_secs\\((\\d+)\\);`));
  if (!m) throw new Error(`${name} is not a plain Duration::from_secs(<number>) in game_room.rs`);
  return Number(m[1]);
}

const WORDS: Record<number, string> = { 60: 'one minute', 120: 'two minutes', 180: 'three minutes' };

describe('the privacy policy and the server agree on how long a finished battle is kept', () => {
  it('says the bound the server keeps, wherever it says it', () => {
    const room = read('backend/src/multiplayer/game_room.rs');
    const policy = read('src/pages/privacy.astro');
    const bound = seconds(room, 'POLICY_AFTER_THE_END');
    const words = WORDS[bound];
    expect(words, `no wording for ${bound} s`).toBeDefined();
    const stated = [...policy.matchAll(/for up to ([a-z]+ minutes?) after it ends/g)].map((m) => m[1]);
    expect(stated.length, 'the policy states the retention in its two places').toBe(2);
    expect(stated).toEqual([words, words]);
  });
});
