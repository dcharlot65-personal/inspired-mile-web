/**
 * The browser's check on the server: auditRound() must pass a round scored by the rules
 * and must name every number that is not what the rules give.
 */
import { describe, expect, it } from 'vitest';
import { auditRound, planMatchesSeed, recomputeRound, type MatchStart, type RoundView, type WireSide } from './multiplayer-client';
import { onlinePlan, resolveOnlineRound, type OnlineSideResult } from './multiplayer-rules';
import { CRITERIA } from './verse/judge';
import PRON from './verse/pron-en';
import { installPronunciation } from './verse/pronounce';

// The server always scores with the pronunciation table; so does the page before a match.
installPronunciation(PRON);

const DECK_A = ['DC-001', 'MO-001', 'CA-001'];
const DECK_B = ['VC-001', 'VC-002', 'DC-002'];
const SEED = 20261116;

function wire(charId: string, r: OnlineSideResult): WireSide {
  return {
    char_id: charId,
    verse: r.verse,
    timed_out: false,
    score: {
      form: { form_id: r.score.form.formId, checks: r.score.form.checks.map((c) => ({ id: c.id, points: c.points, earned: c.earned, met: c.met })), earned: r.score.form.earned, kept: r.score.form.kept, thin: !!r.score.form.thin },
      device: { id: r.score.device.id, met: r.score.device.met },
      signature: r.score.signature.met,
      synergy: r.score.synergy,
      multiplier: r.score.multiplier,
      power_words: null,
      curse: null,
      craft: r.score.craft,
      voided: r.score.voided ?? null,
    },
    judge: r.judge,
    total: r.total,
  };
}

/** What an honest server sends each seat for a match of these verses (seat 0 plays `a`). */
function honestMatch(verses: Array<[string, string]>) {
  const plan = onlinePlan(SEED);
  const start = (seat: 0 | 1): MatchStart => ({
    room_id: 'room',
    seat,
    seed: SEED,
    lang: 'en',
    rounds: plan.map((p) => ({ index: p.index, form_id: p.formId, acrostic: p.acrostic })),
    you: { username: seat === 0 ? 'ann' : 'bob', deck: seat === 0 ? DECK_A : DECK_B, used: [] },
    opponent: { username: seat === 0 ? 'bob' : 'ann', deck: seat === 0 ? DECK_B : DECK_A, used: [] },
    limits: { max_verse_chars: 600, max_verse_lines: 8, deck_min: 3, deck_max: 5, round_seconds: 180 },
    results: [],
  });
  const views: [RoundView[], RoundView[]] = [[], []];
  let previous: [string, string] | null = null;
  verses.forEach(([va, vb], i) => {
    const out = resolveOnlineRound(
      plan[i],
      { charId: DECK_A[i], deck: DECK_A, verse: va, previousOpponentVerse: previous?.[1] },
      { charId: DECK_B[i], deck: DECK_B, verse: vb, previousOpponentVerse: previous?.[0] },
    );
    previous = [out.a.verse, out.b.verse];
    for (const seat of [0, 1] as const) {
      const me = seat === 0 ? 'a' : 'b';
      const seen = (v: 'a' | 'b' | 'split' | 'draw') => (v === 'split' || v === 'draw' ? v : v === me ? 'you' : 'opponent');
      const [mine, theirs] = seat === 0 ? [out.a, out.b] : [out.b, out.a];
      views[seat].push({
        round: i,
        form_id: plan[i].formId,
        acrostic: plan[i].acrostic,
        you: wire((seat === 0 ? DECK_A : DECK_B)[i], mine),
        opponent: wire((seat === 0 ? DECK_B : DECK_A)[i], theirs),
        criteria: Object.fromEntries(CRITERIA.map((c) => [c, seen(out.criteria[c])])) as RoundView['criteria'],
        winner: seen(out.winner) as RoundView['winner'],
        rounds_won: { you: 0, opponent: 0 },
        totals: { you: 0, opponent: 0 },
      });
    }
  });
  return { start, views };
}

const VERSES: Array<[string, string]> = [
  ['Who dares to stand upon my stage?\nI put the question to thy rage', 'The sun is up above the quiet hills\nThe day is here'],
  ['Never fear the dark\nNever yield the crown\nNever kneel to fools', 'Thy question is a candle in the wind\nI throw thy question back at thee'],
  ['I rise\nI rise again\nI rise again and louder', 'Violent delights and violent ends\nThe crown is mine'],
];

describe('auditRound', () => {
  it('passes every round of an honest match, from either seat', () => {
    const { start, views } = honestMatch(VERSES);
    for (const seat of [0, 1] as const) {
      views[seat].forEach((view, i) => {
        expect(auditRound(start(seat), views[seat].slice(0, i), view), `seat ${seat}, round ${i + 1}`).toEqual([]);
      });
    }
  });

  it('recomputes with the previous verses, so a riposte is checked too', () => {
    const { start, views } = honestMatch(VERSES);
    // Seat 1 plays Friar Lawrence (Verona Court: the Riposte) in round two and throws "question" back.
    const round2 = views[1][1];
    expect(round2.you.score.device).toEqual({ id: 'riposte', met: true });
    // Without the earlier round the riposte has nothing to answer, and the audit says so.
    const blind = auditRound(start(1), [], round2);
    expect(blind.join('\n')).toContain('device');
    expect(recomputeRound(start(1), views[1].slice(0, 1), round2).b.score.device.met).toBe(true);
  });

  it('names a number that is not what the rules give', () => {
    const { start, views } = honestMatch(VERSES);
    const honest = views[0][0];
    const tampered: Array<[string, (r: RoundView) => void]> = [
      ['your craft', (r) => { r.you.score.craft += 1; }],
      ['your total', (r) => { r.you.total += 1; }],
      ['your judge share', (r) => { r.you.judge -= 1; }],
      ["opponent's total", (r) => { r.opponent.total += 5; }],
      ["opponent's craft", (r) => { r.opponent.score.craft = 0; }],
      ['your form points', (r) => { r.you.score.form.earned += 6; }],
      ['your check', (r) => { r.you.score.form.checks[0].met = !r.you.score.form.checks[0].met; }],
      ['your device', (r) => { r.you.score.device.met = !r.you.score.device.met; }],
      ['your signature', (r) => { r.you.score.signature = !r.you.score.signature; }],
      ['your multiplier', (r) => { r.you.score.multiplier += 0.25; }],
      ['your void', (r) => { r.you.score.voided = 'copied'; }],
      ['your thin', (r) => { r.you.score.form.thin = true; }],
      // A verse the rules would have cleaned differently: the server did not send what it scored.
      ['your verse', (r) => { r.you.verse += '\u200b'; }],
      ['winner', (r) => { r.winner = r.winner === 'you' ? 'opponent' : 'you'; }],
      ['wit', (r) => { r.criteria.wit = r.criteria.wit === 'split' ? 'you' : 'split'; }],
      ['form the match announced', (r) => { r.form_id = r.form_id === 'couplet' ? 'tercet' : 'couplet'; }],
    ];
    for (const [expected, change] of tampered) {
      const copy: RoundView = structuredClone(honest);
      change(copy);
      const problems = auditRound(start(0), [], copy);
      expect(problems.length, expected).toBeGreaterThan(0);
      expect(problems.join('\n'), expected).toContain(expected);
    }
  });

  it('reports a card the catalogue does not hold instead of throwing', () => {
    const { start, views } = honestMatch(VERSES);
    const copy: RoundView = structuredClone(views[0][0]);
    copy.you.char_id = 'XX-999';
    expect(auditRound(start(0), [], copy).join('\n')).toContain('could not be recomputed');
  });
});

describe('planMatchesSeed', () => {
  it('accepts the forms a seed draws and refuses any others', () => {
    const { start } = honestMatch([]);
    expect(planMatchesSeed(start(0))).toBe(true);
    expect(planMatchesSeed({ ...start(0), seed: SEED + 1 })).toBe(onlinePlan(SEED + 1).every((p, i) => p.formId === onlinePlan(SEED)[i].formId && p.acrostic === onlinePlan(SEED)[i].acrostic));
    const swapped = start(0);
    swapped.rounds = [swapped.rounds[1], swapped.rounds[0], swapped.rounds[2]];
    expect(planMatchesSeed(swapped)).toBe(false);
    expect(planMatchesSeed({ ...start(0), rounds: start(0).rounds.slice(0, 2) })).toBe(false);
  });
});
