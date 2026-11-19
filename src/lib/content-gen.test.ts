import { describe, expect, it, vi } from 'vitest';
import { LOCALES } from '../i18n/index';

/**
 * The in-browser model writes trivia and quote challenges only for a player reading English:
 * its prompts ask for English, and nothing checks what it writes, or whether a "fact" it states
 * is one, in another language. Every other language plays the checked banks
 * (docs/language/CONTENT-PROVENANCE.md).
 */
const brain = vi.hoisted(() => ({ loaded: true }));
vi.mock('./brain', () => ({ isBrainLoaded: () => brain.loaded, generate: async () => '' }));
const { isContentGenAvailable } = await import('./content-gen');

describe('content generation', () => {
  it('is offered in English when a model is loaded, and in no other language', () => {
    brain.loaded = true;
    expect(isContentGenAvailable('en')).toBe(true);
    expect(isContentGenAvailable()).toBe(true);
    for (const l of LOCALES) if (l !== 'en') expect([l, isContentGenAvailable(l)]).toEqual([l, false]);
  });

  it('is not offered without a model, in English either', () => {
    brain.loaded = false;
    for (const l of LOCALES) expect([l, isContentGenAvailable(l)]).toEqual([l, false]);
  });
});
