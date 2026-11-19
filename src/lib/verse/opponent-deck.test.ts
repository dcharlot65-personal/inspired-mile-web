/**
 * The Sonnet Man (SM-001) is the stage name of a real person, Devon Glover. Until he agrees, the
 * opponent never plays his card, so no model is ever asked to write as him (owner decision D-04,
 * 2026-11-19: "keep The Sonnet Man card out of the AI opponent's draw until Devon Glover agrees").
 *
 * Before the decision, 6% of seeds dealt SM-001 to the opponent (three characters of 53), and the
 * model's prompt then opened "You are The Sonnet Man in a duel of verses".
 */
import { describe, expect, it } from 'vitest';
import { CARD_CATALOG, getCardById } from '../cards';
import { NEVER_THE_OPPONENT, ROUNDS, createDuel, opponentDeck, starterDeck } from './duel';
import { getForm } from './forms';
import { opponentMessages } from './opponent';

const SONNET_MAN = 'SM-001';
const SEEDS = 20_000;

describe('The Sonnet Man is never the opponent (D-04)', () => {
  it('is the card the decision names', () => {
    expect(NEVER_THE_OPPONENT).toEqual([SONNET_MAN]);
    expect(getCardById(SONNET_MAN)?.name).toBe('The Sonnet Man');
  });

  // Problems are collected and asserted once: an expect per seed made this the slowest test on a loaded host.
  it(`opponentDeck never deals SM-001 on ${SEEDS} seeds, and still deals three different characters`, () => {
    const dealt: number[] = [];
    const malformed: string[] = [];
    for (let seed = 0; seed < SEEDS; seed++) {
      const d = opponentDeck(seed);
      if (d.characters.includes(SONNET_MAN)) dealt.push(seed);
      const ok = new Set(d.characters).size === ROUNDS && d.characters.every((id) => getCardById(id)?.type === 'Character') && d.relics.length === 1 && d.potions.length === 1;
      if (!ok) malformed.push(`seed ${seed}: ${JSON.stringify(d)}`);
    }
    expect(dealt.slice(0, 10), `${dealt.length} of ${SEEDS} seeds dealt SM-001 to the opponent`).toEqual([]);
    expect(malformed.slice(0, 5), `${malformed.length} malformed decks`).toEqual([]);
  }, 60_000);

  it('a duel planned with no opponent deck given (every front end, DuelSession) never puts SM-001 on the opponent\'s side', () => {
    const seen: string[] = [];
    for (let seed = 0; seed < 5000; seed++) {
      const d = createDuel(seed, 'en', starterDeck());
      if (d.opponent.characters.includes(SONNET_MAN) || d.rounds.some((r) => r.opponent.charId === SONNET_MAN)) seen.push(`seed ${seed}`);
    }
    expect(seen.slice(0, 10), `${seen.length} duels`).toEqual([]);
  }, 60_000);

  it('no model is asked to write as The Sonnet Man, in any round of 5,000 duels', () => {
    const asked: string[] = [];
    for (let seed = 0; seed < 5000; seed++) {
      const d = createDuel(seed, 'en', starterDeck());
      for (const plan of d.rounds) {
        const card = getCardById(plan.opponent.charId)!;
        const messages = opponentMessages(plan, card, getForm(plan.formId), 'en');
        if (messages.some((m) => m.content.includes('The Sonnet Man'))) asked.push(`seed ${seed} round ${plan.index}`);
      }
    }
    expect(asked.slice(0, 10), `${asked.length} prompts`).toEqual([]);
  }, 60_000);

  it('leaves the player\'s side alone: a new player\'s starter deck still holds SM-001', () => {
    // Only the house's draw is changed; what a player holds and plays is theirs.
    expect(starterDeck().characters).toContain(SONNET_MAN);
    expect(CARD_CATALOG.some((c) => c.id === SONNET_MAN && c.type === 'Character')).toBe(true);
  });
});

describe('nor Story Mode\'s opponent, nor a voice it gives words to (D-04; doc 07 §6.2)', () => {
  it('no encounter names SM-001 as its opponent, or puts The Sonnet Man in its text', async () => {
    const { ACTS } = await import('../story-mode');
    const found = ACTS.flatMap((act) => act.encounters)
      .filter((e) => NEVER_THE_OPPONENT.includes(e.opponent) || /Sonnet Man/.test(`${e.name} ${e.description} ${e.narrative}`))
      .map((e) => e.id);
    expect(found).toEqual([]);
  });

  it('in any of the sixteen languages', async () => {
    const found: string[] = [];
    for (const l of ['en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'ru', 'ar', 'hi', 'zh', 'ja', 'ko', 'vi', 'th', 'id']) {
      const m: Record<string, string> = (await import(`../../i18n/pages/story/${l}.ts`)).default;
      for (const [k, v] of Object.entries(m)) if (k.startsWith('story.enc.') && /Sonnet Man/.test(v)) found.push(`${l} ${k}`);
    }
    expect(found).toEqual([]);
  });
});
