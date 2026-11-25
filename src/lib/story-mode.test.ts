import { describe, expect, it } from 'vitest';
import { ACTS, extractDigiCardToken, getActiveDigiCardToken, getChessFighterStoryUrl } from './story-mode';

function mockStorage(entries: Record<string, string>): Pick<Storage, 'getItem' | 'length' | 'key'> {
  const keys = Object.keys(entries);
  return {
    length: keys.length,
    key: (index: number) => keys[index] ?? null,
    getItem: (k: string) => (k in entries ? entries[k] : null),
  };
}

describe('Cross-Mile Story Bridge (Verse & Iron)', () => {
  it('maps Acts 1..5 encounters to Chess Fighter chapters 7..11', () => {
    expect(getChessFighterStoryUrl('1-1', null)).toBe('https://chessfighter.inspiredmile.com/#mode=story&chapter=7');
    expect(getChessFighterStoryUrl('2-4', null)).toBe('https://chessfighter.inspiredmile.com/#mode=story&chapter=8');
    expect(getChessFighterStoryUrl('3-3', null)).toBe('https://chessfighter.inspiredmile.com/#mode=story&chapter=9');
    expect(getChessFighterStoryUrl('4-4', null)).toBe('https://chessfighter.inspiredmile.com/#mode=story&chapter=10');
    expect(getChessFighterStoryUrl('5-3', null)).toBe('https://chessfighter.inspiredmile.com/#mode=story&chapter=11');
    expect(getChessFighterStoryUrl(1, null)).toBe('https://chessfighter.inspiredmile.com/#mode=story&chapter=7');
    expect(getChessFighterStoryUrl(5, null)).toBe('https://chessfighter.inspiredmile.com/#mode=story&chapter=11');
  });

  it('appends URL-encoded IM1- and IM2- Sovereign DigiCard tokens when present', () => {
    const im2 = 'IM2-eyJ1aWQiOiIwNENGIn0.c2lnbmF0dXJlX2VkMjU1MTk';
    const im1 = 'IM1-SM-Hamlet-04AABBCC-1';
    expect(getChessFighterStoryUrl('2-4', im2)).toBe(
      `https://chessfighter.inspiredmile.com/#mode=story&chapter=8&card=${encodeURIComponent(im2)}`,
    );
    expect(getChessFighterStoryUrl('4-2', im1)).toBe(
      `https://chessfighter.inspiredmile.com/#mode=story&chapter=10&card=${encodeURIComponent(im1)}`,
    );
    expect(getChessFighterStoryUrl('1-1', 'not-a-valid-token')).toBe(
      'https://chessfighter.inspiredmile.com/#mode=story&chapter=7',
    );
  });

  it('reads plain or JSON-wrapped IM1-/IM2- tokens from localStorage keys', () => {
    const im2 = 'IM2-payload_b64url.sig_b64url';
    expect(extractDigiCardToken(im2)).toBe(im2);
    expect(extractDigiCardToken(JSON.stringify({ im2_token: im2 }))).toBe(im2);
    expect(extractDigiCardToken('{"token":"evil<script>"}')).toBeNull();

    expect(getActiveDigiCardToken(mockStorage({ 'im-digicard': im2 }))).toBe(im2);
    expect(getActiveDigiCardToken(mockStorage({ 'cf-digicard': JSON.stringify({ token: 'IM1-CF-Kato-01' }) }))).toBe('IM1-CF-Kato-01');
    expect(getActiveDigiCardToken(mockStorage({ unrelated: 'hello' }))).toBeNull();
  });

  it('preserves Owner Decision D-04 on authentic Shakespearean opponents', () => {
    const finalEnc = ACTS[4].encounters[2];
    expect(finalEnc.id).toBe('5-3');
    expect(finalEnc.opponent).toBe('RM-003');
    expect(finalEnc.description).toContain('Mark Antony');
    for (const act of ACTS) {
      for (const enc of act.encounters) {
        expect(enc.narrative).not.toContain('Sonnet Man');
      }
    }
  });
});
