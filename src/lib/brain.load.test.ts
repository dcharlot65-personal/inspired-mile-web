/**
 * Which model a page ends up downloading. A model used in no language (usedAnywhere) is a download
 * that changes nothing, so it must never be loaded in place of the one the player asked for when
 * that one fails, and a stored choice must reload that same model only, never a bigger or a useless
 * one (rememberedModel). The model library is a stand-in that records which model is asked for and
 * fails the ones a test names; loadBrain's own code runs. The lists are set inside each test, so
 * the rules are tested whatever the measured lists hold.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const stand = vi.hoisted(() => ({ asked: [] as string[], failing: new Set<string>() }));
vi.mock('./model-runtime', () => ({
  loadTransformers: async () => ({
    pipeline: async (_task: string, id: string) => {
      stand.asked.push(id);
      if (stand.failing.has(id)) throw new Error(`stand-in: ${id} failed to load`);
      const g: any = async () => [{ generated_text: [{ role: 'assistant', content: 'x' }] }];
      g.tokenizer = {};
      g.dispose = async () => {};
      return g;
    },
    TextStreamer: class {},
  }),
}));
vi.mock('./pwa', () => ({ protectStorage: async () => {} }));

const { MODELS, brainInfo, loadBrain, loadOrder, rememberedModel, unloadBrain, usedAnywhere } = await import('./brain');
type T = 'grand' | 'standard' | 'lite';
const TIERS: T[] = ['grand', 'standard', 'lite'];

const saved = Object.fromEntries(TIERS.map((t) => [t, { writesIn: MODELS[t].writesIn, judgesIn: MODELS[t].judgesIn }]));
/** Which tiers are used in some language, for this test. */
function used(...tiers: T[]) {
  for (const t of TIERS) Object.assign(MODELS[t], tiers.includes(t) ? { writesIn: [], judgesIn: ['en'] } : { writesIn: [], judgesIn: [] });
}
const fail = (...tiers: T[]) => { for (const t of tiers) stand.failing.add(MODELS[t].id); };
const ids = (...tiers: T[]) => tiers.map((t) => MODELS[t].id);

beforeEach(async () => { await unloadBrain(); stand.asked.length = 0; stand.failing.clear(); });
afterEach(() => { for (const t of TIERS) Object.assign(MODELS[t], saved[t]); });

describe('when the model asked for fails to load', () => {
  it('a smaller model used in no language is never loaded in its place', async () => {
    used('grand', 'standard');
    fail('standard');
    expect(await loadBrain('standard')).toBe(false);
    expect(stand.asked).toEqual(ids('standard'));
    expect(brainInfo()).toBeNull();
    await unloadBrain(); stand.asked.length = 0;
    fail('grand');
    expect(await loadBrain('grand')).toBe(false);
    expect(stand.asked).toEqual(ids('grand', 'standard'));
  });

  it('a smaller model used in some language is tried, in order, and one used nowhere is skipped', async () => {
    used('grand', 'lite');
    fail('grand');
    expect(await loadBrain('grand')).toBe(true);
    expect(stand.asked).toEqual(ids('grand', 'lite'));
    expect(brainInfo()?.tier).toBe('lite');
    await unloadBrain(); stand.asked.length = 0; stand.failing.clear();
    used('grand', 'standard', 'lite');
    fail('grand', 'standard');
    expect(await loadBrain('grand')).toBe(true);
    expect(stand.asked).toEqual(ids('grand', 'standard', 'lite'));
  });

  it('tells the caller each model before it tries it, so a page names the one loading, not the one that failed', async () => {
    used('grand', 'standard', 'lite');
    fail('grand', 'standard');
    const told: Array<[string, number]> = [];
    expect(await loadBrain('grand', undefined, (spec) => told.push([spec.tier, stand.asked.length]))).toBe(true);
    // Each is named before its load is asked for: grand first, then each fallback in turn.
    expect(told).toEqual([['grand', 0], ['standard', 1], ['lite', 2]]);
    expect(brainInfo()?.tier).toBe('lite');
  });

  it('the model asked for outright is loaded even when it is used nowhere (?brain=<tier>, the model tests)', async () => {
    used();
    expect(await loadBrain('lite')).toBe(true);
    expect(brainInfo()?.tier).toBe('lite');
    expect(loadOrder('grand').map((m) => m.tier)).toEqual(['grand']);
  });

  it('with the measured lists, whatever fails, the model loaded is the one asked for or one used in some language', async () => {
    for (const t of TIERS) Object.assign(MODELS[t], saved[t]);
    for (const asked of TIERS) {
      for (let mask = 0; mask < 8; mask++) {
        await unloadBrain(); stand.asked.length = 0; stand.failing.clear();
        fail(...TIERS.filter((_, i) => mask & (1 << i)));
        const ok = await loadBrain(asked);
        const got = brainInfo();
        expect(ok, `${asked}, failing ${mask}`).toBe(got !== null);
        if (got && got.tier !== asked) expect(usedAnywhere(got), `asked for ${asked}, failing ${mask}: loaded ${got.label}`).toBe(true);
      }
    }
  });
});

describe('a stored choice reloads that same model only', () => {
  const desktop = { webgpu: true, f16: true, memoryGb: 16, handheld: false };
  const small = { webgpu: true, f16: true, memoryGb: 4, handheld: false };
  const phone = { webgpu: true, f16: true, memoryGb: 4, handheld: true };

  it('never a bigger download than the one chosen, nor one used in no language', () => {
    used('grand', 'standard', 'lite');
    // A desktop is offered Gemma and LFM3, never LFM2.5: a stored LFM2.5 reloads nothing, not LFM3.
    expect(rememberedModel(desktop, 'lite')).toBeNull();
    expect(rememberedModel(desktop, 'standard')).toBe('standard');
    expect(rememberedModel(desktop, 'grand')).toBe('grand');
    // A device that cannot take Gemma does not get it, whatever was stored on another visit.
    expect(rememberedModel(small, 'grand')).toBeNull();
    expect(rememberedModel(small, 'standard')).toBeNull();
    expect(rememberedModel(small, 'lite')).toBe('lite');
    expect(rememberedModel(phone, 'standard')).toBeNull();
    for (const c of [null, 'rules', 'none', 'model', '']) expect(rememberedModel(desktop, c), String(c)).toBeNull();
    used('grand');
    expect(rememberedModel(desktop, 'standard')).toBeNull();
    expect(rememberedModel(small, 'lite')).toBeNull();
    expect(rememberedModel(desktop, 'grand')).toBe('grand');
  });
});
