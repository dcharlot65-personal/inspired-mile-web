/**
 * English for every message the engine can produce.
 *
 * Two readers need it. The model: the prompt that asks it for a verse is
 * written in English whatever language the duel is in (it names the language
 * to write in), so the engine must be able to render a form, a device or a
 * curse in English without the page's i18n runtime. And the English locale
 * (src/i18n/locales/en.ts), which spreads this table so there is one source.
 *
 * A key ending in `.char` is the wording for languages whose lines are counted
 * in characters (Chinese, Japanese); `.words` for an acrostic spelled word by
 * word (Thai); `.kana` for Japanese sounds; `.theirs` is a curse's rule as told
 * to the one who cast it.
 */
import { interpolate, type Msg } from './msg';

/**
 * The lines from the plays behind six of the house devices. Quotations stay in
 * English in every language (they are the source text of the signature
 * mechanic), so every locale spreads this table rather than translating it.
 */
export const HOUSE_QUOTES: Record<string, string> = {
  'house.danish-court.why': '"To be, or not to be, that is the question."',
  'house.capulet.why': '"O Romeo, Romeo!"',
  'house.forest-of-arden.why': '"Whereat, with blade, with bloody blameful blade."',
  'house.scottish-court.why': '"Tomorrow, and tomorrow, and tomorrow."',
  'house.illyria.why': '"Brevity is the soul of wit."',
  'house.rome.why': '"Friends, Romans, countrymen."',
};

export const ENGINE_EN: Record<string, string> = {
  // Forms
  'form.couplet.name': 'Couplet',
  'form.couplet.brief': 'Two lines that rhyme.',
  'form.quatrain-aabb.name': 'Paired Quatrain',
  'form.quatrain-aabb.brief': 'Four lines: the first two rhyme, and the last two rhyme.',
  'form.quatrain-abab.name': 'Crossed Quatrain',
  'form.quatrain-abab.brief': 'Four lines: line 1 rhymes with 3, line 2 with 4.',
  'form.tercet.name': 'Tercet',
  'form.tercet.brief': 'Three lines; the first and last rhyme.',
  'form.anaphora.name': 'Anaphora',
  'form.anaphora.brief': 'Three lines that all begin with the same word.',
  'form.anaphora.brief.char': 'Three lines that all begin with the same character.',
  'form.acrostic.name': 'Acrostic',
  'form.acrostic.brief': 'One line per letter: the first letters must spell {word}.',
  'form.acrostic.brief.words': 'One line per word: the lines must open, in order, with {word}.',
  'form.crescendo.name': 'Crescendo',
  'form.crescendo.brief': 'Three lines, each longer than the one before.',
  'form.epistrophe.name': 'Epistrophe',
  'form.epistrophe.brief': 'Three lines that all end on the same word.',
  'form.epistrophe.brief.char': 'Three lines that all end on the same character.',
  'form.haiku.name': 'Haiku',
  'form.haiku.brief': 'Three lines of 5, 7 and 5 syllables.',
  'form.haiku.brief.char': 'Three lines of 5, 7 and 5 characters.',
  'form.haiku.brief.kana': 'Three lines of 5, 7 and 5 sounds. Write in kana so the sounds can be counted.',
  'form.heroic-couplet.name': 'Heroic Couplet',
  'form.heroic-couplet.brief': 'Two rhyming lines of about ten syllables each, as Shakespeare closed his sonnets.',
  'form.jueju.name': 'Jueju',
  'form.jueju.brief': 'Four lines, all of five characters or all of seven, the shape of a classical quatrain.',
  'form.luc-bat.name': 'Lục Bát',
  'form.luc-bat.brief': 'A line of six syllables, then one of eight whose sixth syllable rhymes with the end of the first.',

  // Requirements of a form
  'check.lines': 'Exactly {n, plural, one {# line} other {# lines}}',
  'check.rhyme': 'Lines {a} and {b} rhyme',
  'check.syllables': 'Line {line}: {n, plural, one {# syllable} other {# syllables}}',
  'check.syllables.about': 'Line {line}: about {n, plural, one {# syllable} other {# syllables}}',
  'check.syllables.char': 'Line {line}: {n, plural, one {# character} other {# characters}}',
  'check.syllables.kana': 'Line {line}: {n, plural, one {# sound} other {# sounds}}, in kana',
  'check.same-opening': 'Every line opens with the same word',
  'check.same-opening.char': 'Every line opens with the same character',
  'check.same-ending': 'Every line ends on the same word',
  'check.same-ending.char': 'Every line ends on the same character',
  'check.spells': 'First letters spell {word}',
  'check.spells.words': 'Lines open, in order, with {word}',
  'check.growing': 'Each line has more words than the last',
  'check.growing.char': 'Each line has more characters than the last',
  'check.jueju-length': 'Every line has five characters, or every line has seven',
  'check.luc-bat-rhyme': 'The sixth syllable of each line rhymes',

  // Devices
  'device.question.name': 'The Question',
  'device.question.brief': 'Ask a question: end a line with a question mark.',
  'device.exclaim.name': 'The Outcry',
  'device.exclaim.brief': 'Cry out: end a line with an exclamation mark.',
  'device.alliteration.name': 'Alliteration',
  'device.alliteration.brief': 'Start three words in one line with the same letter.',
  'device.repetition.name': 'The Drumbeat',
  'device.repetition.brief': 'Repeat one strong word three times.',
  'device.internal-rhyme.name': 'Inner Rhyme',
  'device.internal-rhyme.brief': 'Rhyme two words inside a single line.',
  'device.riposte.name': 'The Riposte',
  'device.riposte.brief': "Turn a word of {n, plural, one {# letter} other {# letters}} or more from your opponent's last verse back on them.",
  'device.brevity.name': 'Brevity',
  'device.brevity.brief': 'Keep every line to {n, plural, one {# word} other {# words}} or fewer.',
  'device.brevity.brief.char': 'Keep every line to {n, plural, one {# character} other {# characters}} or fewer.',
  'device.swell.name': 'The Swell',
  'device.swell.brief': 'Make your last line your longest.',
  'device.balance.name': 'Balance',
  'device.balance.brief': 'Give every line the same number of words.',
  'device.balance.brief.char': 'Give every line the same number of characters.',
  'device.ring.name': 'The Ring',
  'device.ring.brief': 'End your verse on the same word it began with.',
  'device.ring.brief.char': 'End your verse on the same character it began with.',
  'device.invocation.name': 'Invocation',
  'device.invocation.brief': 'Call on a character by name.',
  'device.grandeur.name': 'Grandeur',
  'device.grandeur.brief': 'Use two words of {n, plural, one {# letter} other {# letters}} or more.',
  'device.monorhyme.name': 'One Rhyme',
  'device.monorhyme.brief': 'End every line on the same rhyme.',

  // Curses
  'curse.forbidden-letter.name': 'Forbidden Letter',
  'curse.forbidden-letter.brief': 'Your verse may not contain the letter {letter}.',
  'curse.forbidden-letter.theirs': 'Their verse may not contain the letter {letter}.',
  'curse.short-words.name': 'Tongue-Tied',
  'curse.short-words.brief': 'No word of yours may be longer than {n, plural, one {# letter} other {# letters}}.',
  'curse.short-words.theirs': 'No word of theirs may be longer than {n, plural, one {# letter} other {# letters}}.',
  'curse.no-repeats.name': 'No Echoes',
  'curse.no-repeats.brief': 'You may not use any word of {n, plural, one {# letter} other {# letters}} or more twice.',
  'curse.no-repeats.theirs': 'They may not use any word of {n, plural, one {# letter} other {# letters}} or more twice.',
  'curse.short-lines.name': 'Short Breath',
  'curse.short-lines.brief': 'No line of yours may be longer than {n, plural, one {# word} other {# words}}.',
  'curse.short-lines.brief.char': 'No line of yours may be longer than {n, plural, one {# character} other {# characters}}.',
  'curse.short-lines.theirs': 'No line of theirs may be longer than {n, plural, one {# word} other {# words}}.',
  'curse.short-lines.theirs.char': 'No line of theirs may be longer than {n, plural, one {# character} other {# characters}}.',

  // Why each house fights as it does. Six of them are quotations (HOUSE_QUOTES above).
  ...HOUSE_QUOTES,
  'house.montague.why': "Mercutio's quick tongue rhymes mid-line.",
  'house.verona-court.why': 'The court weighs every word said against you.',
  'house.the-tempest.why': 'The storm builds until it breaks.',
  'house.legendary.why': 'The Sonnet Man rides one rhyme all the way down.',
  'house.lake-district.why': 'The Romantics measured every line.',
  'house.gothic-circle.why': 'The tale ends where it began.',
  'house.olympus.why': 'The gods speak in thunderous words.',
  'house.underworld.why': 'The dead remember everything you said.',
};

/** An engine message in English, whatever the interface language. */
export function en(m: Msg): string {
  return interpolate(ENGINE_EN[m.key] ?? m.key, m.vars);
}

/** A curse's brief as told to the one who cast it: the same message with `.brief` read as `.theirs`. */
export function theirs(m: Msg): Msg {
  return { ...m, key: m.key.replace('.brief', '.theirs') };
}
