/**
 * The machine-readable mark on text a model wrote (EU AI Act Article 50(2), owner decision D-01;
 * docs/AI-MARKING.md), and the session's record of which model wrote the opposing verse, which the
 * battle page and the Theatre mark it with. The pages themselves: tests/ai-marking.spec.ts.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

// The session asks the brain and the opponent's writer; both are stood in for here, so a round can be
// written "by a model" or by the written opponent at will, without loading one.
const writer = vi.hoisted(() => ({ source: 'model' as 'model' | 'written', loaded: true }));
vi.mock('./brain', async (real) => {
  const brain = await real<typeof import('./brain')>();
  return {
    ...brain,
    isBrainLoaded: () => writer.loaded,
    brainInfo: () => (writer.loaded ? brain.MODELS.grand : null),
    modelWrites: () => true,
  };
});
vi.mock('./verse/opponent', async (real) => ({
  ...(await real<typeof import('./verse/opponent')>()),
  writeOpponentVerse: async () => ({ verse: 'The night is cold and clear\nI sing of what was here', source: writer.source }),
}));

import { AI_SOURCE_TYPE, MODEL_REVISION, aiAttributes, aiGenerated, markAiText, readAiGenerated } from './ai-marking';
import { MODELS } from './brain';
import { starterDeck } from './verse/duel';
import { DuelSession } from './verse/session';

/** Enough of an element for markAiText. */
function element() {
  const attrs = new Map<string, string>();
  return {
    attrs,
    setAttribute: (k: string, v: string) => void attrs.set(k, v),
    removeAttribute: (k: string) => void attrs.delete(k),
  } as unknown as HTMLElement & { attrs: Map<string, string> };
}

describe('the mark', () => {
  it('names the model and its version', () => {
    for (const m of Object.values(MODELS)) {
      const mark = readAiGenerated(aiGenerated(m));
      expect(mark).toEqual({ name: m.label, model: m.id, revision: MODEL_REVISION, dtype: m.dtype });
    }
    expect(aiGenerated(MODELS.grand)).toBe('name=Gemma 4 E2B; model=onnx-community/gemma-4-E2B-it-ONNX; revision=main; dtype=q4f16');
  });

  it('reads nothing that is not a mark', () => {
    expect(readAiGenerated(null)).toBeNull();
    expect(readAiGenerated('')).toBeNull();
    expect(readAiGenerated('true')).toBeNull();
    expect(readAiGenerated('name=Gemma 4 E2B; model=x')).toBeNull();
  });

  it('is set on an element for a model and taken off again for none', () => {
    const el = element();
    markAiText(el, MODELS.standard);
    expect(el.attrs.get('data-ai-generated')).toBe(aiGenerated(MODELS.standard));
    expect(el.attrs.get('data-ai-source')).toBe(AI_SOURCE_TYPE);
    markAiText(el, null);
    expect([...el.attrs.keys()]).toEqual([]);
  });

  it('as markup: attributes for a model, nothing for none, and escaped', () => {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    expect(aiAttributes(MODELS.lite, esc)).toBe(` data-ai-generated="${aiGenerated(MODELS.lite)}" data-ai-source="${AI_SOURCE_TYPE}"`);
    expect(aiAttributes(null, esc)).toBe('');
    expect(aiAttributes({ label: 'a "b" & c', id: 'x', dtype: 'y' }, esc)).toContain('name=a &quot;b&quot; &amp; c;');
  });
});

describe('the session says which model wrote the opposing verse', () => {
  const session = (useModel: boolean) => new DuelSession({ seed: 11, lang: 'en', deck: starterDeck(), difficulty: 'player', useModel });

  it('the model that wrote it, when a model wrote it', async () => {
    writer.source = 'model';
    writer.loaded = true;
    const s = session(true);
    await s.beginRound();
    expect(s.opponentSource).toBe('model');
    expect(s.opponentModel).toEqual(MODELS.grand);
  });

  it('none, when the written opponent played it, with a model loaded or without', async () => {
    writer.source = 'written';
    writer.loaded = true;
    const s = session(true);
    await s.beginRound();
    expect(s.opponentModel).toBeNull();
    writer.loaded = false;
    const t = session(false);
    await t.beginRound();
    expect(t.opponentModel).toBeNull();
  });

  it('forgets the last round\'s model when the next round opens', async () => {
    writer.source = 'model';
    writer.loaded = true;
    const s = session(true);
    await s.beginRound();
    expect(s.opponentModel).not.toBeNull();
    writer.source = 'written';
    await s.beginRound();
    expect(s.opponentModel).toBeNull();
  });
});

/**
 * The playground's trivia and quote challenges can be written by a model (content-gen.ts). The page
 * never loads one by itself today, so no browser test can reach those screens; this reads the page's
 * markup instead. Every element that shows text the model may have written (a question, an option, a
 * quotation, the play and speaker it names) carries the mark's attributes in its own opening tag, on
 * every screen that shows it: the challenge, the right answer and the wrong one.
 */
describe('the playground marks every screen that shows what a model may have written', () => {
  const page = readFileSync('src/pages/playground.astro', 'utf8');
  const SHOWN = ['${esc(q.question)}', '${esc(opt)}', '${esc(challenge.displayQuote)}', '${esc(challenge.fullQuote)}', '${source}'];
  /** The opening tag (and what precedes the text inside it) of the element each such text is written in. */
  function unmarked(markup: string): string[] {
    const out: string[] = [];
    for (const shown of SHOWN) {
      for (let at = markup.indexOf(shown); at >= 0; at = markup.indexOf(shown, at + 1)) {
        const open = markup.slice(0, at).search(/<[a-z][^<]*$/);
        const tag = markup.slice(open, at);
        if (!tag.includes('${mark}') && !tag.includes('aiAttributes(')) out.push(`${shown} at line ${markup.slice(0, at).split('\n').length}`);
      }
    }
    return out;
  }

  it('in its own element, on each screen', () => {
    expect(SHOWN.map((s) => page.split(s).length - 1)).toEqual([1, 1, 1, 2, 2]);
    expect(unmarked(page)).toEqual([]);
  });

  it('finds an element that is not marked', () => {
    expect(unmarked('<p class="x" ${lineAttrs}>"${esc(challenge.fullQuote)}"</p>')).toHaveLength(1);
    expect(unmarked('<p class="x" ${lineAttrs}${mark}>"${esc(challenge.fullQuote)}"</p>')).toEqual([]);
  });
});
