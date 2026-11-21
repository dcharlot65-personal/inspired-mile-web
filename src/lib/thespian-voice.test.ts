import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as voice from './thespian-voice';

/**
 * speak(): what reaches Kokoro and what reaches the device's own voice. Kokoro is a stand-in here
 * (it records the phonemes it is given and returns a tenth of a second of silence); the real model
 * speaks in tests/voice.spec.ts. The browser's Audio and speechSynthesis are stand-ins too.
 */

const state = vi.hoisted(() => ({ generated: [] as string[], played: 0, spoken: [] as string[] }));

vi.mock('./self-hosted', () => ({ selfHosted: () => ({ kokoroOrt: '/ort/kokoro/' }) }));
vi.mock('kokoro-js', () => ({
  env: {},
  KokoroTTS: {
    from_pretrained: async () => ({
      voices: { bm_george: {} },
      tokenizer: (ps: string) => ({ input_ids: ps }),
      generate_from_ids: async (ids: string) => {
        state.generated.push(ids);
        return { audio: new Float32Array(2400), sampling_rate: 24000 };
      },
    }),
  },
}));

beforeAll(() => {
  vi.stubGlobal('window', {
    speechSynthesis: {
      getVoices: () => [{ localService: true, lang: 'en-GB', name: 'a local voice' }],
      speak: (u: { text: string }) => state.spoken.push(u.text),
      cancel: () => {},
      speaking: false,
    },
  });
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      text: string;
      constructor(text: string) {
        this.text = text;
      }
    },
  );
  vi.stubGlobal(
    'Audio',
    class {
      paused = true;
      onended: (() => void) | null = null;
      play() {
        state.played++;
        return Promise.resolve();
      }
      pause() {}
    },
  );
});

afterEach(() => {
  state.generated.length = 0;
  state.spoken.length = 0;
  state.played = 0;
});

describe('speak()', () => {
  it('reads English with Kokoro, from the game\'s own phonemes', async () => {
    expect(await voice.loadVoice()).toBe(true);
    await voice.speak('To be, or not to be.');
    expect(state.generated).toEqual(['tə bˈiː, ɔː nˈɒt tə bˈiː.']);
    expect(state.played).toBe(1);
    expect(state.spoken).toEqual([]);
  });

  it.each([['привет'], ['★'], ['٣']])('gives %s, which has nothing the English reading can say, to the device voice instead of playing silence', async (text) => {
    expect(await voice.loadVoice()).toBe(true);
    await voice.speak(text);
    expect(state.generated).toEqual([]);
    expect(state.played).toBe(0);
    expect(state.spoken).toEqual([text]);
  });

  it('reads an emoji alone with Kokoro, by its CLDR name, and one inside a line too', async () => {
    expect(await voice.loadVoice()).toBe(true);
    await voice.speak('🙂');
    await voice.speak('I 💀 you');
    expect(state.generated).toEqual(['slˈItli smˈIlɪŋ fˈAs.', 'ˌI skˈʌl jˈuː.']);
    expect(state.played).toBe(2);
    expect(state.spoken).toEqual([]);
  });

  it('never drops a number: digits glued to letters are read', async () => {
    expect(await voice.loadVoice()).toBe(true);
    await voice.speak('At 10pm I rhyme like 2pac.');
    expect(state.generated.join(' ')).toContain('tˈɛn pˈiː ˈɛm');
    expect(state.generated.join(' ')).toContain('tˈuː pˈak');
  });
});
