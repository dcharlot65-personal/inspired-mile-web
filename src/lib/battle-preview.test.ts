/**
 * The single-player battle page's live checklist (battle.astro renderChecks) shows
 * DuelSession.preview() of the textarea, and the page hands the same text to
 * DuelSession.submit(). These must be one score: the craft the checklist shows is the craft
 * the round awards. Online play once previewed text cleaned once while the server scored it
 * cleaned again (cleanVerse was not idempotent); this holds the single-player page to the
 * same account, on pasted text that a single cleaning leaves unsettled.
 */
import { describe, expect, it } from 'vitest';
import { starterDeck, type VerseScore } from './verse/duel';
import { DuelSession } from './verse/session';

const BASES = [
  'Step up, poor player, strut thy little hour\nThen watch thy verses wither like a flower',
  'I do not know which way to go\nThe river runs, the waters flow',
  'Who dares to stand upon my stage?\nI put the question to thy empty rage',
  'Never fear the gathering dark\nNever yield the golden crown\nNever kneel to passing fools',
  'An old silent pond\nA frog jumps into the pond\nSplash silence again',
  'r\u043ese and r0se and ro$e\nThe rose is red tonight',
];
/** What pasted text carries: a zero-width space and a combining accent after a letter, look-alike letters, fillers. */
const NOISE = ['\u200b\u0301', 'e\u200b\u0301', '\u00a0', '\ufeff', '\u043e', '\u3164', 'A\u030a', '\ufb01', '\u202e', '\r\n'];

function pasted(): string[] {
  const out: string[] = [];
  for (const base of BASES) {
    out.push(base);
    const points = Array.from(base);
    for (let k = 0; k < NOISE.length; k++) {
      const at = 1 + ((k * 7) % (points.length - 1));
      out.push([...points.slice(0, at), NOISE[k], ...points.slice(at)].join(''));
    }
  }
  return out;
}

const flat = (s: VerseScore) => ({
  form: s.form.earned, kept: s.form.kept, scale: s.form.scale, device: [s.device.id, s.device.met], signature: s.signature.met,
  synergy: s.synergy, multiplier: s.multiplier, substance: s.substance, power: s.powerWords?.bonus ?? null,
  curse: s.curse?.penalty ?? null, craft: s.craft, voided: s.voided ?? null,
});

describe('the battle page scores what its live checklist shows', () => {
  it('preview() of the text typed is the craft submit() awards for it, pasted text included', async () => {
    const deck = starterDeck([]);
    let compared = 0;
    let copies = 0;
    for (const [i, own] of pasted().entries()) {
      // Round one of a duel with the rule judge and the written opponent, as with no model.
      const session = new DuelSession({ seed: 100 + (i % 7), lang: 'en', deck, difficulty: 'player', useModel: false });
      await session.beginRound();
      expect(session.chooseCharacter(deck.characters[i % deck.characters.length])).toBe(true);
      // Now and then the opponent's verse pasted back, with what pasting adds: a copy, void.
      const verse = i % 4 === 0 ? `${session.opponentVerse.replace(/ /, ' \u200b')}\u00a0` : own;
      session.setVerse(verse);
      const shown = session.preview();
      expect(shown, 'a character is chosen, so there is a preview').not.toBeNull();
      if (session.blocked()) continue;
      const result = await session.submit();
      expect(result).not.toBeNull();
      expect([i, verse, flat(result!.player)]).toEqual([i, verse, flat(shown!)]);
      compared++;
      if (shown!.voided === 'copied') copies++;
    }
    expect(compared).toBeGreaterThan(50);
    expect(copies, 'pasted copies of the opponent were among the verses compared').toBeGreaterThan(5);
  }, 180_000);
});
