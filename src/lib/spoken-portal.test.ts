import { describe, expect, it } from 'vitest';
import {
  buildAgentMorfCurl,
  buildArenaDeepLink,
  buildWishDeepLink,
  CURATED_SONNET_WORLDS,
} from './spoken-portal';

describe('Cross-Mile CFW1 Spoken Sanctuary portal helpers', () => {
  it('ships four curated CFW1 fallback worlds with Simple and Painted stages', () => {
    expect(CURATED_SONNET_WORLDS).toHaveLength(4);
    expect(CURATED_SONNET_WORLDS.every((w) => w.code.startsWith('CFW1-'))).toBe(true);
    expect(CURATED_SONNET_WORLDS.some((w) => w.paint_stage === 'simple')).toBe(true);
    expect(CURATED_SONNET_WORLDS.some((w) => w.paint_stage === 'painted')).toBe(true);
  });

  it('builds WebGPU spoken arena deep links with cfw1, model, and URL-encoded wish', () => {
    expect(buildArenaDeepLink('CFW1-AgICAAH1', 'jade lanterns low gravity', 'inkling-2-mini')).toBe(
      'https://chessfighter.inspiredmile.com/#mode=spoken&cfw1=CFW1-AgICAAH1&model=inkling-2-mini&wish=jade%20lanterns%20low%20gravity',
    );
    expect(buildWishDeepLink('rainy dusk towers', 'gemma-4-e2b-web')).toBe(
      'https://chessfighter.inspiredmile.com/#mode=spoken&model=gemma-4-e2b-web&wish=rainy%20dusk%20towers',
    );
  });

  it('formats the 1-line 0x28 BYO-Agent curl snippet with inkling-2-mini default', () => {
    const cmd = buildAgentMorfCurl('low gravity sanctum', 'tier0-rust');
    expect(cmd).toContain('curl -X POST https://chessfighter.inspiredmile.com/ws/agent/morf');
    expect(cmd).toContain('"model":"inkling-2-mini"');
    expect(cmd).toContain('"wish":"low gravity sanctum"');
  });
});
