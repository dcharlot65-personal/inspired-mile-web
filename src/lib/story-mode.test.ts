import { describe, expect, it } from 'vitest';
import {
  ACTS,
  IRON_RESONANCE_STANZAS,
  decodeDigiCardSummary,
  extractDigiCardToken,
  getActiveDigiCardToken,
  getChessFighterStoryUrl,
  getChessFighterWorldTourUrl,
} from './story-mode';

function mockStorage(
  initial: Record<string, string>,
): Pick<Storage, 'getItem' | 'setItem' | 'length' | 'key'> & { dump: () => Record<string, string> } {
  const store: Record<string, string> = { ...initial };
  return {
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    dump: () => ({ ...store }),
  };
}

function encodeIm2Payload(payload: Record<string, unknown>, sig = 'c2lnbmF0dXJlX2VkMjU1MTk'): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64url = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `IM2-${b64url}.${sig}`;
}

describe('Cross-Mile Story Bridge (Verse & Iron)', () => {
  it('maps Acts 1..5 encounters to Chess Fighter chapters 7..11 and World Tour URL', () => {
    expect(getChessFighterStoryUrl('1-1', null)).toBe('https://chessfighter.inspiredmile.com/#mode=story&chapter=7');
    expect(getChessFighterStoryUrl('2-4', null)).toBe('https://chessfighter.inspiredmile.com/#mode=story&chapter=8');
    expect(getChessFighterStoryUrl('3-3', null)).toBe('https://chessfighter.inspiredmile.com/#mode=story&chapter=9');
    expect(getChessFighterStoryUrl('4-4', null)).toBe('https://chessfighter.inspiredmile.com/#mode=story&chapter=10');
    expect(getChessFighterStoryUrl('5-3', null)).toBe('https://chessfighter.inspiredmile.com/#mode=story&chapter=11');
    expect(getChessFighterStoryUrl(1, null)).toBe('https://chessfighter.inspiredmile.com/#mode=story&chapter=7');
    expect(getChessFighterStoryUrl(5, null)).toBe('https://chessfighter.inspiredmile.com/#mode=story&chapter=11');
    expect(getChessFighterWorldTourUrl(null)).toBe('https://chessfighter.inspiredmile.com/#mode=world');
    expect(getChessFighterWorldTourUrl('IM1-CF-Kato-01')).toBe(
      'https://chessfighter.inspiredmile.com/#mode=world&card=IM1-CF-Kato-01',
    );
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

  it('reads plain or JSON-wrapped IM1-/IM2- tokens and persists ?card= / #card= URL tokens to cf-digicard', () => {
    const im2 = 'IM2-payload_b64url.sig_b64url';
    expect(extractDigiCardToken(im2)).toBe(im2);
    expect(extractDigiCardToken(JSON.stringify({ im2_token: im2 }))).toBe(im2);
    expect(extractDigiCardToken('{"token":"evil<script>"}')).toBeNull();

    expect(getActiveDigiCardToken(mockStorage({ 'im-digicard': im2 }))).toBe(im2);
    expect(getActiveDigiCardToken(mockStorage({ 'cf-digicard': JSON.stringify({ token: 'IM1-CF-Kato-01' }) }))).toBe('IM1-CF-Kato-01');
    expect(getActiveDigiCardToken(mockStorage({ unrelated: 'hello' }))).toBeNull();

    const searchStore = mockStorage({});
    const urlToken = encodeIm2Payload({ uid: 'CF-77', elo: 1380, captures: 6 });
    expect(getActiveDigiCardToken(searchStore, { search: `?card=${encodeURIComponent(urlToken)}` })).toBe(urlToken);
    expect(searchStore.getItem('cf-digicard')).toBe(urlToken);
    // Subsequent visit without ?card= stays bound via persisted cf-digicard
    expect(getActiveDigiCardToken(searchStore, { search: '', hash: '' })).toBe(urlToken);

    const hashStore = mockStorage({});
    expect(getActiveDigiCardToken(hashStore, { hash: '#card=IM1-CF-Citadelle-09' })).toBe('IM1-CF-Citadelle-09');
    expect(hashStore.getItem('cf-digicard')).toBe('IM1-CF-Citadelle-09');
  });

  it('decodes IM2- payloads with captures, promotions, ELO, and origin into SovereignCardSummary', () => {
    const martialIm2 = encodeIm2Payload({
      uid: 'CF-CITADELLE-01',
      elo: 1425,
      w: 7,
      l: 2,
      captures: 18,
      promotions: 3,
      verses: 4,
      stage: 9,
      rarity: 'Mythic',
      origin: 'chessfighter',
    });
    const summary = decodeDigiCardSummary(martialIm2);
    expect(summary).toEqual({
      token: martialIm2,
      format: 'IM2',
      uid: 'CF-CITADELLE-01',
      elo: 1425,
      wins: 7,
      losses: 2,
      captures: 18,
      promotions: 3,
      verses: 4,
      stage: 9,
      rarity: 'Mythic',
      hasChessFeats: true,
    });

    // Fresh unplayed card with default 1200 ELO and zero martial stats does not claim chess feats
    const freshIm2 = encodeIm2Payload({ uid: 'SM-INIT-01', elo: 1200, w: 0, l: 0, captures: 0, promotions: 0, verses: 2 });
    const freshSummary = decodeDigiCardSummary(freshIm2);
    expect(freshSummary?.hasChessFeats).toBe(false);
    expect(freshSummary?.verses).toBe(2);

    // Card with Chess Fighter origin or promotions activates Iron Resonance even at 1200 ELO
    const originOnly = decodeDigiCardSummary(encodeIm2Payload({ uid: 'CF-ORIGIN', elo: 1200, origin: 'chessfighter' }));
    expect(originOnly?.hasChessFeats).toBe(true);
    const promoOnly = decodeDigiCardSummary(encodeIm2Payload({ uid: 'CF-PROMO', elo: 1200, promotions: 1 }));
    expect(promoOnly?.hasChessFeats).toBe(true);
  });

  it('decodes legacy IM1- tokens and rejects malformed or invalid card strings', () => {
    const im1 = 'IM1-CF-Chevalye-8899AABB';
    expect(decodeDigiCardSummary(im1)).toEqual({
      token: im1,
      format: 'IM1',
      uid: 'CF-Chevalye-',
      elo: 1200,
      wins: 1,
      losses: 0,
      captures: 1,
      promotions: 0,
      verses: 0,
      stage: 1,
      rarity: 'Tempered',
      hasChessFeats: true,
    });

    expect(decodeDigiCardSummary(null)).toBeNull();
    expect(decodeDigiCardSummary(undefined)).toBeNull();
    expect(decodeDigiCardSummary('')).toBeNull();
    expect(decodeDigiCardSummary('not-a-card')).toBeNull();
    expect(decodeDigiCardSummary('IM2-missing_signature_dot')).toBeNull();
    expect(decodeDigiCardSummary('IM2-not_json_payload.c2lnbmF0dXJl')).toBeNull();
    expect(decodeDigiCardSummary('IM2-e30.bad!sig')).toBeNull();
  });

  it('provides D-04-compliant Citadelle Chorus Iron Resonance couplets across Acts 1..5', () => {
    expect(Object.keys(IRON_RESONANCE_STANZAS).map(Number).sort()).toEqual([1, 2, 3, 4, 5]);
    const allText = Object.values(IRON_RESONANCE_STANZAS)
      .map(s => `${s.title}\n${s.couplet}`)
      .join('\n');

    expect(allText).toContain('Citadelle');
    expect(allText).toContain('Chevalye');
    expect(allText).toContain('Manbo');
    expect(allText).toContain('Ayibobo');
    expect(allText).toContain('Anperè');
    expect(allText).not.toContain('Sonnet Man');

    for (const actId of [1, 2, 3, 4, 5]) {
      const entry = IRON_RESONANCE_STANZAS[actId];
      expect(entry.title).toContain('Citadelle Chorus');
      const lines = entry.couplet.split('\n');
      expect(lines).toHaveLength(2);
      expect(lines[0].trim().length).toBeGreaterThan(20);
      expect(lines[1].trim().length).toBeGreaterThan(20);
    }
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
