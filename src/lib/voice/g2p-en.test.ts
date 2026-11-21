import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import lexicon from './lexicon-en';
import { installVoiceLexicon, normalise, phonemizeEnglish, sayWord, splitForKokoro } from './g2p-en';
import { codesOf, leftMatch, rightMatch, ruleCodes } from './lts-en';
import { NRL_RULES } from './nrl-rules';
import { KOKORO_VOCAB } from './kokoro-vocab';
import EMOJI_EN from './emoji-en';
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

  it.each([
    // Decades and counts.
    ['the 90s', 'the nineties'], ["the '60s", 'the sixties'], ['the 1990s', 'the nineteen nineties'], ['the 1800s', 'the eighteen hundreds'],
    ['top 10s', 'top tens'],
    // Times with am and pm, glued or not.
    ['10pm', 'ten P M'], ['3am', 'three A M'], ['3:30pm', 'three thirty P M'], ['7:00 a.m.', 'seven A M.'], ['at 7 AM we met', 'at seven A M we met'],
    // Letters and digits written as one word.
    ['mp3', 'MP three'], ['MP3s', 'MP threes'], ['B2K', 'B two K'], ['K9', 'K nine'], ['R2D2', 'R two D two'], ['1e9', 'one e nine'], ['2pac', 'two pac'],
    // A digit for its sound, only when the table has the word it spells, and never in capitals.
    ['4ever', 'forever'], ['gr8 m8', 'grate mate'], ['l8r', 'later'], ['2day', 'today'], ['any1', 'anyone'], ['b4', 'B four'], ['G8', 'G eight'],
    // A minus sign; a decimal before a letter.
    ['-5', 'minus five'], ['it fell to -12', 'it fell to minus twelve'], ['1.5x', 'one point five x'],
    // Roman numerals that are numbers.
    ['Henry VIII', 'Henry the eighth'], ['Richard III', 'Richard the third'], ['Henry V', 'Henry the fifth'], ['Elizabeth I.', 'Elizabeth the first.'],
    ["Henry VIII's wives", "Henry the eighth's wives"], ['Act III, Scene ii', 'Act three, Scene two'], ['Act I, Scene i', 'Act one, Scene one'],
    ['World War II', 'World War two'], ['Sonnet XVIII', 'Sonnet eighteen'], ['Pope John Paul II', 'Pope John Paul the second'], ['Rocky II', 'Rocky two'],
    // And the I's and X's that are not.
    ['Malcolm X', 'Malcolm X'], ['Shall I compare thee', 'Shall I compare thee'], ['Henry I saw', 'Henry I saw'], ['the war I fought', 'the war I fought'],
    ['the night\nI walk', 'the night\nI walk'], ['Mom XXX', 'Mom XXX'], ['And I am kind', 'And I am kind'],
  ])('%j is read as %j', (text, said) => {
    expect(normalise(text)).toBe(said);
  });

  it.each([
    // The pronoun I after a king's name, in a contraction or before a capitalised word (the
    // independent check's probes, which read "the first'm", "one'm", "the first LOVE YOU").
    ["Mary I'm yours, and John I'll never be.", "Mary I'm yours, and John I'll never be."], ["Henry I'd follow thee.", "Henry I'd follow thee."],
    ["Paul I've loved thee long.", "Paul I've loved thee long."], ["Elizabeth I'm queen.", "Elizabeth I'm queen."],
    ["Victor I'll be, Urban I'm not", "Victor I'll be, Urban I'm not"], ["Innocent I'm not", "Innocent I'm not"],
    ['Mary I’m yours', "Mary I'm yours"],
    // A possessive 's is the numeral's (the pronoun takes none); any other contraction is not.
    ["Elizabeth I's reign", "Elizabeth the first's reign"], ["Act I's ending", "Act one's ending"], ["Henry VI'd fight", "Henry VI'd fight"],
    // ... and after a part's name at the start of a line.
    ["Round I'm winning", "Round I'm winning"], ["Stage I'm owning", "Stage I'm owning"], ["Phase I'm in", "Phase I'm in"],
    ["Level I've passed", "Level I've passed"], ["Charles I'm sure the War I'm waging is lost.", "Charles I'm sure the War I'm waging is lost."],
    // ... and in a shouted line.
    ['MARY I LOVE YOU', 'MARY I LOVE YOU'], ['JOHN I WILL END YOU', 'JOHN I WILL END YOU'], ['Henry I Love', 'Henry I Love'],
    // A lone I that ends the phrase is the number: a mark, the line's end, "of", "and", the next part.
    ['Henry I of England', 'Henry the first of England'], ['Mary I and Philip II', 'Mary the first and Philip the second'],
    ['Act I Scene ii', 'Act one Scene two'], ['World War I', 'World War one'], ['the crown of Mary I\nwas gold', 'the crown of Mary the first\nwas gold'],
    ['ELIZABETH I.', 'ELIZABETH the first.'],
    // X's alone are kisses after a king's name too (the edge measurement's "Mary the twentieth").
    ['Love you Mary XX, signed with a kiss.', 'Love you Mary XX, signed with a kiss.'], ['Henry XXX', 'Henry XXX'], ['Pope John XXIII', 'Pope John the twenty-third'],
    // One letter of C, D, L or M after a part's name is a letter, and a long numeral there is a number only below 400.
    ['Part C of the plan', 'Part C of the plan'], ['Section D is mine', 'Section D is mine'], ['Level M', 'Level M'], ['Book L', 'Book L'],
    ['Sonnet CLIV', 'Sonnet one hundred and fifty-four'], ['Psalm CXIX', 'Psalm one hundred and nineteen'], ['Part MIX', 'Part MIX'], ['Stage CD', 'Stage CD'],
    // After any other capitalised word, a number, but not after a little word.
    ['An IV bag', 'An IV bag'], ['HOOKED TO AN IV', 'HOOKED TO AN IV'], ['My XI', 'My XI'], ['Final Fantasy VII', 'Final Fantasy seven'], ['ROCKY II', 'ROCKY two'],
  ])('%j is read as %j (Roman numerals, second pass)', (text, said) => {
    expect(normalise(text)).toBe(said);
  });

  it.each([
    // A time of day only on one line, an hour of 0 to 12, and not the verb after a count.
    ['I counted up to 10\nAm I the fool?', 'I counted up to ten\nAm I the fool?'], ['Round 2 am I winning?', 'Round two am I winning?'],
    ['Level 9 am I?', 'Level nine am I?'], ['ROUND 2 AM I WINNING', 'ROUND two AM I WINNING'], ['Level 20 am I ready', 'Level twenty am I ready'],
    ['at 7 am I woke', 'at seven A M I woke'], ["It's 3 am I can't sleep", "It's three A M I can't sleep"], ['3 am I rise', 'three A M I rise'],
    ["Round 2 am I'm up", "Round two A M I'm up"], ['Round 2am I win', 'Round two A M I win'], ['Round 2 a.m. I win', 'Round two A M. I win'],
    ['by 6 pm I fight', 'by six P M I fight'], ['13pm', 'thirteen PM'], ['10\npm', 'ten\npm'],
  ])('%j is read as %j (am and pm)', (text, said) => {
    expect(normalise(text)).toBe(said);
  });

  it.each([
    // Emoji by Unicode CLDR's English name, as eSpeak NG said them, without a skin tone (spaces
    // run together here).
    ['I 💀 you with every line', 'I skull you with every line'], ['🔥🔥', 'fire fire'], ['👍🏽', 'thumbs up'], ['❤️ you', 'red heart you'],
    ['🇺🇸', 'flag United States'], ['👩🏾‍🚀', 'woman astronaut'], ['1️⃣', 'keycap one'], ['#️⃣', 'keycap'], ['I♥you', 'I heart suit you'],
    // Joined emoji CLDR names only in parts: the parts.
    ['🫨‍🔥', 'shaking face fire'],
    // What NFKC makes letters or marks of stays as before; text with no emoji is untouched.
    ['Wow‼', 'Wow!!'], ['the 10 commandments', 'the ten commandments'],
  ])('%j is read as %j (emoji)', (text, said) => {
    expect(normalise(text).replace(/\s+/g, ' ').trim()).toBe(said);
  });

  it('says an emoji\'s name, in Kokoro\'s symbols, for every emoji of the table', () => {
    const rows = EMOJI_EN.split('\n').filter((l) => l.includes('\t') && !l.startsWith('# '));
    expect(rows.length).toBeGreaterThan(2000);
    expect(rows).toContain('#⃣\tkeycap: #');
    const bad: string[] = [];
    for (const row of rows) {
      const emoji = row.slice(0, row.indexOf('\t'));
      const out = ps(`a ${emoji} b`);
      if (!/^ɐ \S.* bˈiː\.$/.test(out) || outside(out).length) bad.push(`${row}: ${out}`);
    }
    expect(bad.slice(0, 20)).toEqual([]);
    expect(ps('I 💀 you')).toBe('ˌI skˈʌl jˈuː.');
  });

  it('says the letters of a time as letters ("A M", not the article)', () => {
    expect(ps('3am')).toBe('θɹˈiː ˈA ˈɛm.');
    expect(ps('A dog')).toBe('ɐ dˈɒɡ.');
  });

  it('leaves no digit unread, whatever is glued to it', () => {
    for (const t of ['x_5_y', '_7', 'mp_3', 'a 5_ b']) expect(normalise(t), t).not.toMatch(/\d/);
    // Seeded (mulberry32: an LCG's low bits alternate, and once kept "_" from ever meeting a digit):
    // words of letters, digits and marks in every order.
    let s = 20261119 >>> 0;
    const rand = (n: number) => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
    };
    const parts = ['a', 'mp', 'K', 'gr', 'ever', 's', 'th', 'pm', 'am', 'e', '_', "'", '-', '.', ',', ':', '%', '$', '£', '−', '/', 'x', 'ß', 'é', 'п'];
    const failures: string[] = [];
    for (let k = 0; k < 3000; k++) {
      let w = '';
      for (let j = 0, n = 1 + rand(5); j < n; j++) w += rand(2) ? String(rand(3) ? rand(10) : rand(100000)) : parts[rand(parts.length)];
      const text = `${parts[rand(parts.length)]} ${w} ${parts[rand(parts.length)]}`;
      if (/\d/.test(normalise(text))) failures.push(`${JSON.stringify(text)} -> ${JSON.stringify(normalise(text))}`);
    }
    expect(failures.slice(0, 10)).toEqual([]);
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

describe('the emoji names', () => {
  it('are CLDR 49\'s, pinned, with the Unicode License v3 notice inside the data', () => {
    const head = readFileSync('src/lib/voice/emoji-en.ts', 'utf8').slice(0, 2000);
    const script = readFileSync('scripts/build-voice-emoji.mjs', 'utf8');
    for (const sha of script.match(/sha256: '([0-9a-f]{64})'/g) ?? []) expect(head).toContain(sha.slice(9, -1));
    expect(script.match(/sha256: '([0-9a-f]{64})'/g)?.length).toBe(2);
    expect(EMOJI_EN).toMatch(/^# Emoji names for the voice: Unicode CLDR 49/);
    expect(EMOJI_EN).toContain('# UNICODE LICENSE V3');
    expect(EMOJI_EN).toContain('# Copyright © 2001–2026 Unicode, Inc.');
    expect(EMOJI_EN).toContain('# Permission is hereby granted, free of charge, to any person obtaining a');
  });
});
