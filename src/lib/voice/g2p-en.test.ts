import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import lexicon from './lexicon-en';
import { installVoiceLexicon, normalise, phonemizeEnglish, sayWord, splitForKokoro } from './g2p-en';
import { codesOf, leftMatch, rightMatch, ruleCodes } from './lts-en';
import { NRL_RULES } from './nrl-rules';
import { KOKORO_VOCAB } from './kokoro-vocab';
// @ts-ignore a plain ES module of the build scripts
import { corpus, slangAndNames } from '../../../scripts/voice/corpus.mjs';

beforeAll(() => installVoiceLexicon(lexicon));

const ps = (text: string) => phonemizeEnglish(text).ps;
const outside = (s: string) => [...new Set([...s].filter((ch) => !KOKORO_VOCAB.includes(ch)))];

describe('the voice reads the CMU table in British symbols (misaki conventions)', () => {
  it.each([
    ['night', 'nˈIt'], ['father', 'fˈɑːðə'], ['hot', 'hˈɒt'], ['dog', 'dˈɒɡ'], ['law', 'lˈɔː'], ['water', 'wˈɔːtə'],
    ['thought', 'θˈɔːt'], ['car', 'kˈɑː'], ['more', 'mˈɔː'], ['air', 'ˈɛː'], ['here', 'hˈɪə'], ['bird', 'bˈɜːd'],
    ['go', 'ɡˈQ'], ['day', 'dˈA'], ['boy', 'bˈY'], ['how', 'hˈW'], ['bath', 'bˈɑːθ'], ['cat', 'kˈat'], ['dance', 'dˈɑːns'],
    ['very', 'vˈɛɹi'], ['mary', 'mˈɛːɹi'], ['sorry', 'sˈɒɹi'], ['story', 'stˈɔːɹi'], ['hurry', 'hˈʌɹi'], ['little', 'lˈɪtᵊl'],
    ['what', 'wˈɒt'], ['quality', 'kwˈɒləti'], ['happy', 'hˈapi'], ['question', 'kwˈɛsʧən'], ['judge', 'ʤˈʌʤ'],
    ['sing', 'sˈɪŋ'], ['measure', 'mˈɛʒə'], ['bought', 'bˈɔːt'], ['blunted', 'blˈʌntɪd'], ['verses', 'vˈɜːsɪz'],
    ['comest', 'kˈʌmɪst'], ['wanted', 'wˈɒntɪd'], ['water', 'wˈɔːtə'], ['walk', 'wˈɔːk'],
  ])('%s is %s', (word, expected) => {
    const r = sayWord(word);
    expect(r.source).toBe('table');
    expect(r.ps).toBe(expected);
  });

  it('keeps an r only before a vowel, the next word\'s too', () => {
    expect(ps('the car')).toBe('ðə kˈɑː.');
    expect(ps('the car is')).toBe('ðə kˈɑːɹ ˈɪz.');
    expect(ps('for ever')).toBe('fɔːɹ ˈɛvə.');
    // A pause between the words: no r.
    expect(ps('the car, is')).toBe('ðə kˈɑː, ˈɪz.');
  });

  it('keeps a stress on the old pronouns and the vowel of "and" (heard as "the" and "in" without)', () => {
    expect(ps('Thy rhymes and thou hast lost thine, for thee')).toBe('ðˌI ɹˈImz and ðˈW hˈast lˈɒst ðˈIn, fɔː ðˈiː.');
  });

  it('says the little words weak, and strong where a phrase ends', () => {
    expect(ps('Call that a verse?')).toBe('kˈɔːl ðat ɐ vˈɜːs?');
    expect(ps('What art thou?')).toBe('wˈɒt ˈɑːt ðˈW?');
    expect(ps('the hour')).toBe('ði ˈWə.');
    expect(ps('to us')).toBe('tʊ ˈʌs.');
  });

  it('chooses the reading of a word by the words beside it', () => {
    expect(ps('The wind takes them all')).toContain('wˈɪnd');
    expect(ps('I wind the clock')).toContain('wˈInd');
    expect(ps('Her tears fell')).toContain('tˈɪəz');
    expect(ps('I tear it up')).toContain('tˈɛːɹ');
  });

  it('says a written t that the American reading drops or flaps', () => {
    expect(sayWord('thirty').ps).toMatch(/^θˈɜːt/);
    expect(sayWord('twenty').ps).toBe('twˈɛnti');
  });
});

describe('words the table lacks', () => {
  it('reads unknown words by the letter rules', () => {
    expect(sayWord('finna')).toMatchObject({ ps: 'fˈɪnə', source: 'rules' });
    expect(sayWord('varlet')).toMatchObject({ ps: 'vˈɑːlɛt', source: 'rules' });
  });

  it('takes a word apart into words the table has before guessing', () => {
    expect(sayWord("chantin'")).toMatchObject({ ps: 'ʧˈantɪn', source: 'parts' });
    expect(sayWord('constructor').source).toBe('table');
    expect(sayWord('coxcomb')).toMatchObject({ ps: 'kˈɒkskˌQm', source: 'parts' });
    expect(sayWord('nightlong')).toMatchObject({ ps: 'nˈItlˌɒŋ', source: 'parts' });
  });

  it('takes a stem the table has whole before one it can only take apart', () => {
    // "lovelie" (e put back) splits into love + lie, "lovely" (y for i) is a word: lovely wins.
    expect(sayWord('loveliness')).toMatchObject({ ps: 'lˈʌvlinəs', source: 'parts' });
  });

  it('holds a sound with no vowel letter, and spells short capitals', () => {
    expect(sayWord('skrrt')).toMatchObject({ ps: 'skˈɜːt', source: 'held' });
    expect(sayWord('brrr').ps).toBe('bˈɜː');
    expect(sayWord('shhh').ps).toBe('ʃː');
    expect(sayWord('XQZ')).toMatchObject({ ps: 'ˈɛks kjˈuː zˈɛd', source: 'letters' });
  });
});

describe('the letter-to-sound rules apply as NRL Report 7948 says', () => {
  it('matches contexts: # vowels, : consonants, ^ one consonant, + front vowel, % suffix', () => {
    expect(leftMatch('#:', ' MAD', 3)).toBe(true);
    expect(leftMatch('#:', ' MD', 2)).toBe(false);
    expect(leftMatch(' :', ' STR', 3)).toBe(true);
    expect(leftMatch('^', ' A', 1)).toBe(false);
    expect(rightMatch('^+ ', 'DE ', 0)).toBe(true);
    expect(rightMatch('^+ ', 'DO ', 0)).toBe(false);
    expect(rightMatch('%', 'ING ', 0)).toBe(true);
    expect(rightMatch('%', 'ELY ', 0)).toBe(true);
    expect(rightMatch('%', 'X ', 0)).toBe(false);
  });

  it('reads every code of every rule\'s output (the table writes h, not HH)', () => {
    for (const rules of Object.values(NRL_RULES)) {
      for (const [, match, , out] of rules) expect(codesOf(out).join(''), match).toBe(out.replace(/ /g, ''));
    }
    expect(sayWord('haruki').ps.startsWith('h')).toBe(true);
  });

  it('reads whole words rule by rule', () => {
    expect(ruleCodes('cat')).toEqual(['k', 'AE', 't']);
    expect(ruleCodes('made')).toEqual(['m', 'EY', 'd']);
    expect(ruleCodes('the')).toEqual(['DH', 'AX']);
  });
});

describe('text', () => {
  it.each([
    ['1599', 'fifteen ninety-nine'], ['2026', 'twenty twenty-six'], ['2005', 'two thousand and five'], ['105', 'one hundred and five'],
    ['3:30', 'three thirty'], ['7:00', "seven o'clock"], ['$5.50', 'five dollars and fifty cents'], ['£1', 'one pound'],
    ['21st', 'twenty-first'], ['3.14', 'three point one four'], ['1,000', 'one thousand'], ['50%', 'fifty percent'],
    ['1-2', 'one to two'], ['Dr. Smith', 'Doctor Smith'], ['etc.', 'et cetera'], ['etch the stone', 'etch the stone'],
  ])('%s is read as "%s"', (text, said) => {
    expect(normalise(text)).toBe(said);
  });

  it('pauses at the end of a line of verse, and ends the verse', () => {
    expect(ps('a dog\nthe cat')).toBe('ɐ dˈɒɡ, ðə kˈat.');
    expect(ps('a dog;\nthe cat!')).toBe('ɐ dˈɒɡ; ðə kˈat!');
  });

  it('keeps the dashes, quotation marks and ellipses Kokoro knows', () => {
    const out = ps('He said "no" -- then left...');
    expect(out).toContain('“nˈQ”');
    expect(out).toContain(' — ');
    expect(out.endsWith('…')).toBe(true);
  });

  it('writes only symbols of Kokoro\'s vocabulary, for every text the voice is measured on', async () => {
    const items: Array<{ id: string; text: string }> = await corpus();
    expect(items.length).toBeGreaterThan(300);
    for (const item of items) {
      const out = ps(item.text);
      expect(out.length, item.id).toBeGreaterThan(0);
      expect(outside(out), item.id).toEqual([]);
    }
  });

  it('writes only symbols of Kokoro\'s vocabulary for every word of the table', () => {
    const bad: string[] = [];
    for (const line of lexicon.split('\n')) {
      if (!line || line.startsWith('#')) continue;
      const word = line.slice(0, line.indexOf(' ')).replace(/\^$/, '');
      const out = sayWord(word).ps;
      if (!out || outside(out).length) bad.push(`${word}: ${out}`);
    }
    expect(bad.slice(0, 20)).toEqual([]);
  });

  it('gives every slang word and name a vowel to say', () => {
    for (const w of slangAndNames()) {
      expect(ps(w), w).toMatch(/[AIOQWYaiuɐɑɒɔəɛɜɪʊʌᵊ]/);
    }
  });
});

describe('Kokoro reads at most 510 symbols at once', () => {
  it('cuts long text at sentence or clause ends into pieces it can read', () => {
    const verse = Array.from({ length: 30 }, (_, i) => `Line ${i + 1} of a verse that runs on and on`).join('\n');
    const whole = ps(verse);
    expect(whole.length).toBeGreaterThan(800);
    const pieces = splitForKokoro(whole);
    expect(pieces.length).toBeGreaterThan(1);
    for (const p of pieces) {
      expect(p.length).toBeLessThanOrEqual(400);
      expect(p).toMatch(/[,.;:!?…—]$/);
    }
    expect(pieces.join(' ')).toBe(whole);
  });

  it('cuts at a space when a clause is longer than a piece', () => {
    const pieces = splitForKokoro(Array.from({ length: 120 }, () => 'wˈɜːd').join(' '), 100);
    for (const p of pieces) expect(p.length).toBeLessThanOrEqual(100);
    expect(pieces.join(' ').split(' ').length).toBe(120);
  });
});

describe('the table', () => {
  it('is built from the pinned CMU dictionary, with its licence inside the data', () => {
    const commit = /export const COMMIT = '([0-9a-f]{40})'/.exec(readFileSync('scripts/build-pronunciation.mjs', 'utf8'))?.[1];
    expect(commit).toBeTruthy();
    const head = readFileSync('src/lib/voice/lexicon-en.ts', 'utf8').slice(0, 2000);
    expect(head).toContain(`commit ${commit}`);
    expect(lexicon).toContain('# The CMU Pronouncing Dictionary is Copyright (C) 1993-2015 Carnegie Mellon');
  });
});
