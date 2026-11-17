/**
 * Rhyme and syllables in English, by sound: the pronunciation table against
 * pairs and words taken from real verse, and the measures the anti-copy and
 * anti-filler rules rest on.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { CARD_CATALOG } from '../cards';
import * as pron from './pronounce';
import { rhymes } from './rhyme';
import * as text from './text';
import { syllablesInWord } from './text';

beforeAll(async () => {
  expect(await pron.loadPronunciation()).toBe(true);
});

/** Pairs that rhyme, most of them line-ends from the poems named. */
const RHYMES: Array<[string, string]> = [
  // The pairs the review found refused.
  ['go', 'so'], ['no', 'know'], ['know', 'show'], ['snow', 'glow'], ['toe', 'foe'], ['though', 'low'], ['now', 'how'], ['day', 'they'],
  ['time', 'rhyme'], ['you', 'true'], ['you', 'do'], ['sky', 'high'], ['die', 'eye'], ['blue', 'through'], ['said', 'head'],
  // Shakespeare, Sonnets 18, 29, 73, 116, 130.
  ['day', 'may'], ['shines', 'declines'], ['fade', 'shade'], ['see', 'thee'], ['sun', 'dun'], ['red', 'head'], ['white', 'delight'],
  ['cheeks', 'reeks'], ['know', 'go'], ['sound', 'ground'], ['rare', 'compare'], ['minds', 'finds'], ['mark', 'bark'], ['shaken', 'taken'],
  ['eyes', 'cries'], ['state', 'fate'], ['hope', 'scope'], ['brings', 'kings'], ['behold', 'cold'], ['hang', 'sang'], ['day', 'away'],
  ['west', 'rest'], ['fire', 'expire'], ['lie', 'by'], ['strong', 'long'],
  // The plays: the witches, Hamlet's couplet, the last lines of Romeo and Juliet, Puck's epilogue.
  ['trouble', 'bubble'], ['snake', 'bake'], ['frog', 'dog'], ['sting', 'wing'], ['thing', 'king'], ['woe', 'romeo'], ['friends', 'amends'],
  // Blake, "The Tyger".
  ['bright', 'night'], ['skies', 'eyes'], ['aspire', 'fire'], ['art', 'heart'], ['beat', 'feet'], ['chain', 'brain'], ['grasp', 'clasp'], ['spears', 'tears'],
  // Wordsworth, "I Wandered Lonely as a Cloud".
  ['cloud', 'crowd'], ['hills', 'daffodils'], ['trees', 'breeze'], ['shine', 'line'], ['way', 'bay'], ['glance', 'dance'], ['thought', 'brought'], ['mood', 'solitude'],
  // Poe, "The Raven".
  ['dreary', 'weary'], ['lore', 'door'], ['rapping', 'tapping'], ['december', 'ember'], ['morrow', 'sorrow'], ['token', 'spoken'],
  // Coleridge, Rossetti, Barrett Browning.
  ['decree', 'sea'], ['ran', 'man'], ['away', 'stay'], ['land', 'hand'], ['ways', 'days'], ['height', 'sight'],
  // Spelled apart, sounded together; and a stressed ending against an unstressed one.
  ['fire', 'pyre'], ['hour', 'flower'], ['power', 'hour'], ['here', 'fear'], ['stage', 'rage'], ['crown', 'drown'], ['sea', 'me'], ['day', 'weigh'],
  ['dare', 'air'], ['crawl', 'fall'], ['noise', 'boys'], ['there', 'care'], ['eyes', 'lies'], ['back', 'attack'], ['night', 'light'],
  ['destiny', 'free'], ['running', 'king'], ['never', 'forever'],
];

/** Pairs that do not rhyme: eye-rhymes, near misses, and two unstressed endings. */
const NOT_RHYMES: Array<[string, string]> = [
  ['stage', 'large'], ['noise', 'nose'], ['king', 'crown'], ['my', 'tree'], ['they', 'see'], ['on', 'moon'], ['love', 'move'], ['hour', 'four'],
  ['come', 'home'], ['word', 'sword'], ['blood', 'good'], ['night', 'thought'], ['sea', 'sky'], ['rose', 'lose'], ['bough', 'though'],
  ['cough', 'through'], ['laughter', 'daughter'], ['one', 'stone'], ['done', 'gone'], ['some', 'home'], ['have', 'grave'], ['said', 'paid'],
  ['were', 'here'], ['are', 'care'], ['wood', 'blood'], ['bear', 'fear'], ['great', 'meat'], ['candle', 'apple'], ['running', 'morning'],
  ['crown', 'own'], ['heaven', 'even'], ['river', 'never'], ['moon', 'sun'], ['verse', 'horse'], ['tomb', 'bomb'], ['friend', 'fiend'],
  ['good', 'food'],
];

describe('rhyme, by sound', () => {
  it(`rhymes ${RHYMES.length} pairs from real verse`, () => {
    expect(RHYMES.length).toBeGreaterThanOrEqual(60);
    for (const [a, b] of RHYMES) expect([a, b, pron.knownWord(a) && pron.knownWord(b)]).toEqual([a, b, true]);
    expect(RHYMES.filter(([a, b]) => !rhymes(a, b) || !rhymes(b, a))).toEqual([]);
  });
  it(`refuses ${NOT_RHYMES.length} pairs that do not rhyme`, () => {
    expect(NOT_RHYMES.length).toBeGreaterThanOrEqual(30);
    for (const [a, b] of NOT_RHYMES) expect([a, b, pron.knownWord(a) && pron.knownWord(b)]).toEqual([a, b, true]);
    expect(NOT_RHYMES.filter(([a, b]) => rhymes(a, b) || rhymes(b, a))).toEqual([]);
  });
  it('a word never rhymes with itself, whatever its spelling', () => {
    expect(rhymes('night', 'night')).toBe(false);
    expect(rhymes('Night', 'night')).toBe(false);
    expect(rhymes('café', 'cafe')).toBe(false);
  });
  it('only English is read from the table', () => {
    // "come" and "home" do not rhyme in English; in Italian "come" / "nome" do, by their endings.
    expect(rhymes('come', 'nome', 'it')).toBe(true);
    expect(pron.knownWord('come', 'it')).toBe(false);
    expect(rhymes('corazón', 'canción', 'es')).toBe(true);
  });
});

/** Syllables as a reader of verse counts them. Where a word is said two ways, both are listed, commonest first. */
const SYLLABLES: Record<string, number[]> = {
  // Every part of every character's name in the catalogue.
  the: [1], sonnet: [2], man: [1], romeo: [3, 2], juliet: [3, 2], hamlet: [2], ophelia: [3, 4], mercutio: [4], puck: [1], titania: [3, 4],
  prince: [1], escalus: [3], friar: [2, 1], lawrence: [2], nurse: [1], prospero: [3], ariel: [3], caliban: [3], benvolio: [4, 3], tybalt: [2],
  king: [1], claudius: [3], oberon: [3], macbeth: [2], lady: [2], banquo: [2], viola: [3], malvolio: [4, 3], olivia: [4], brutus: [2],
  cassius: [3, 2], mark: [1], antony: [3], lord: [1], montague: [3], capulet: [3], horatio: [3, 4], bottom: [2], paris: [2], miranda: [3],
  william: [2], wordsworth: [2], samuel: [2], coleridge: [2, 3], john: [1], keats: [1], byron: [2], mary: [2], shelley: [2], edgar: [2],
  allan: [2], poe: [1], blake: [1], percy: [2], bysshe: [1], elizabeth: [4], barrett: [2], browning: [2], christina: [3], rossetti: [3],
  zeus: [1], athena: [3], apollo: [3], aphrodite: [4], hermes: [2], hades: [2, 1], persephone: [4], odysseus: [4, 3], medusa: [3], achilles: [3],
  // The words the review found miscounted.
  poem: [2], being: [2], crying: [2], playing: [2], quiet: [2], lion: [2], idea: [3], create: [2], science: [2], beyond: [2], naked: [2],
  tables: [2], candles: [2], poetry: [3], every: [3, 2],
  // Everyday verse words, including the ones spelling gets wrong.
  stage: [1], candle: [2], question: [2], banished: [2], wanted: [2], tomorrow: [3], beautiful: [3], queen: [1], rhythm: [2], leaves: [1],
  takes: [1], roses: [2], wishes: [2], ages: [2], them: [1], fire: [2, 1], hour: [2, 1], flower: [2, 1], power: [2, 1], heaven: [2], spirit: [2],
  diamond: [2], poet: [2], business: [2], marriage: [2], ocean: [2], patient: [2], ancient: [2], special: [2], nation: [2], glorious: [3],
  curious: [3], serious: [3], video: [3], area: [3], radio: [3], piano: [3], riot: [2], giant: [2], dying: [2], going: [2], seeing: [2],
  creature: [2], theatre: [3], museum: [3], loved: [1], wicked: [2], wandered: [2], remembered: [3], whispered: [2], people: [2], little: [2],
  castle: [2], rhyme: [1], thee: [1], thou: [1], hath: [1],
};

describe('syllables, by sound', () => {
  it(`counts ${Object.keys(SYLLABLES).length} words`, () => {
    expect(Object.keys(SYLLABLES).length).toBeGreaterThanOrEqual(80);
    const wrong: Array<[string, number[] | null]> = [];
    for (const [word, counts] of Object.entries(SYLLABLES)) {
      const got = text.syllableCounts(word);
      if (JSON.stringify(got) !== JSON.stringify(counts)) wrong.push([word, got]);
      expect([word, syllablesInWord(word)]).toEqual([word, counts[0]]);
    }
    expect(wrong).toEqual([]);
  });
  it('covers every character name in the catalogue', () => {
    const parts = new Set(CARD_CATALOG.filter((c) => c.type === 'Character').flatMap((c) => c.name.toLowerCase().split(/\s+/)));
    expect(parts.size).toBeGreaterThan(60);
    for (const part of parts) {
      expect([part, part in SYLLABLES]).toEqual([part, true]);
      expect([part, pron.knownWord(part)]).toEqual([part, true]);
    }
  });
  it('gives a line the range it can be read with', () => {
    expect(text.syllableSpan('Romeo is gone')).toEqual({ min: 4, max: 5, guessed: 0 });
    expect(text.syllableSpan('The fire of every hour')).toEqual({ min: 6, max: 9, guessed: 0 });
    expect(text.syllableSpan('Zorblatt is gone')).toMatchObject({ guessed: 1 });
    expect(text.syllableSpan("'Tis the well-known hour")).toMatchObject({ guessed: 0 });
  });
  it('the table is a separate file, loaded on demand, and the rules work without it', async () => {
    pron.installPronunciation(null);
    try {
      expect(pron.pronunciationLoaded()).toBe(false);
      expect(pron.knownWord('night')).toBe(false);
      expect(rhymes('night', 'light')).toBe(true);
      expect(syllablesInWord('candle')).toBe(2);
    } finally {
      expect(await pron.loadPronunciation()).toBe(true);
    }
    expect(pron.pronunciationLoaded()).toBe(true);
  });
  it("carries the dictionary's licence inside the data, where a minified build keeps it", async () => {
    const data = (await import('./pron-en')).default;
    const notice = data.split('\n').filter((l) => l.startsWith('#'));
    expect(notice.join('\n')).toContain('Copyright (C) 1993-2015 Carnegie Mellon');
    expect(notice.join('\n')).toContain('POSSIBILITY OF SUCH DAMAGE.');
    // The notice is read as no word at all.
    expect(notice.every((l) => !l.includes('\t'))).toBe(true);
    expect(pron.knownWord('carnegie')).toBe(true);
    expect(pron.knownWord('#')).toBe(false);
  });
});

describe('similarity: how much of a verse is taken from another', () => {
  const source = 'Thy rhymes are candles guttering in the night\nMine is the sun, and thou hast lost the light';
  it('is 1 for a copy, however it is dressed', () => {
    expect(text.similarity(source, source)).toBe(1);
    expect(text.similarity(source.toUpperCase().replace(/,/g, ' !'), source)).toBe(1);
    expect(text.similarity(source.split('\n').reverse().join('\n'), source)).toBe(1);
    // A filler between every two words adds one word of the verse's own, not half the verse.
    expect(text.similarity(source.split(' ').join(' yea '), source)).toBeGreaterThan(0.85);
  });
  it('is high for a retouched copy and low for an answer', () => {
    const retouched = 'Thy rhymes are candles guttering in the dark\nMine is the sun, and thou hast lost the spark';
    expect(text.similarity(retouched, source)).toBeGreaterThanOrEqual(0.7);
    const answer = 'Who lit these candles? Not the sun, I think\nI put the question while thy verses sink';
    expect(text.similarity(answer, source)).toBeLessThan(0.3);
    // Throwing a phrase back is an answer, not a copy, and so is one whole line taken with an answer of one's own.
    const quoting = 'Thou sayest I have "lost the light"? Then hear\nHow darkness sings when better bards are near';
    expect(text.similarity(quoting, source)).toBeLessThan(0.5);
    expect(text.similarity('Mine is the sun, and thou hast lost the light\nSo says the mirror I hold up tonight', source)).toBeLessThan(0.5);
    expect(text.similarity('Anything at all', '')).toBe(0);
    expect(text.similarity('', source)).toBe(0);
  });
  it('is a share: a number from 0 to 1 that grows with what is taken', () => {
    const none = text.similarity('A wholly different pair of lines\nWith nothing borrowed, nothing shared', source);
    const some = text.similarity('Thy rhymes are candles, so I hear\nAnd mine a bonfire, burning near', source);
    const most = text.similarity('Thy rhymes are candles guttering in the gloom\nMine is the sun, and thou hast lost the room', source);
    expect(none).toBe(0);
    expect(some).toBeGreaterThan(none);
    expect(most).toBeGreaterThan(some);
    expect(most).toBeLessThanOrEqual(1);
  });
});

describe('substance: a verse, or tokens laid out like one', () => {
  it('needs a word in every line and as many different words as lines', () => {
    for (const thin of ['Never\nNever\nNever', 'dare\ndare\ndare', 'a\na a\na a a', 'w\ni\nt', 'x', '?\n?', 'so\nso', 'go go\ngo go', 'Never fear\nNever\nNever', 'question', 'zz!!', 'Hear this', 'Never the night falls\nnever the night falls!\nNever, the night falls', 'Thy verse is weak\nThy verse is weak']) {
      expect([thin, text.substance(thin, 'en').ok]).toEqual([thin, false]);
    }
    for (const real of ['Never fear\nNever yield\nNever kneel', 'Kneel\nWeep, fool\nThy doom has come', 'A candle?\nThen I snuff it', 'To be or not to be', 'Bold\nAnd\nRash\nDeeds', 'I\nI rise\nI rise again', 'O!\nRomeo, wherefore art thou', 'Oh Rome, oh Rome\nThy walls are tall\nOh Rome, oh Rome\nThy walls shall fall']) {
      expect([real, text.substance(real, 'en').ok]).toEqual([real, true]);
    }
    expect(text.substance('Never\nNever\nNever')).toEqual({ ok: false, distinct: 1, needed: 3, known: 1, telling: 1 });
  });
  it('counts characters where lines are counted in characters', () => {
    const hao = String.fromCodePoint(0x597d);
    expect(text.substance(`${hao}\n${hao}${hao}\n${hao}${hao}${hao}`, 'zh').ok).toBe(false);
    // Three lines of a real quatrain's characters: far more than four different ones.
    const chun = String.fromCodePoint(0x6625, 0x7720, 0x4e0d, 0x89c9, 0x6653);
    const chu = String.fromCodePoint(0x5904, 0x5904, 0x95fb, 0x557c, 0x9e1f);
    const ye = String.fromCodePoint(0x591c, 0x6765, 0x98ce, 0x96e8, 0x58f0);
    expect(text.substance(`${chun}\n${chu}\n${ye}`, 'zh').ok).toBe(true);
    expect(text.similarity(`${chun}\n${chu}`, `${chun}\n${chu}`, 'zh')).toBe(1);
    expect(text.similarity(ye, `${chun}\n${chu}`, 'zh')).toBe(0);
  });
});
