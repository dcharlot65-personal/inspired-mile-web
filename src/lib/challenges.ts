/**
 * Quote Completion Challenges — Fill in the missing words.
 */

export interface QuoteChallenge {
  fullQuote: string;
  displayQuote: string; // with blanks shown as ___
  missingWords: string[];
  play: string;
  character: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export const CHALLENGE_BANK: QuoteChallenge[] = [
  {
    fullQuote: 'To be, or not to be, that is the question.',
    displayQuote: 'To ___, or not to ___, that is the question.',
    missingWords: ['be', 'be'],
    play: 'Hamlet', character: 'Hamlet', difficulty: 'easy',
  },
  {
    fullQuote: 'All that glitters is not gold.',
    displayQuote: 'All that ___ is not ___.',
    missingWords: ['glitters', 'gold'],
    play: 'The Merchant of Venice', character: 'Morocco', difficulty: 'easy',
  },
  {
    fullQuote: 'Parting is such sweet sorrow.',
    displayQuote: '___ is such sweet ___.',
    missingWords: ['parting', 'sorrow'],
    play: 'Romeo and Juliet', character: 'Juliet', difficulty: 'easy',
  },
  {
    fullQuote: 'We are such stuff as dreams are made on.',
    displayQuote: 'We are such stuff as ___ are made on.',
    missingWords: ['dreams'],
    play: 'The Tempest', character: 'Prospero', difficulty: 'easy',
  },
  {
    fullQuote: 'The lady doth protest too much, methinks.',
    displayQuote: 'The lady doth ___ too much, methinks.',
    missingWords: ['protest'],
    play: 'Hamlet', character: 'Gertrude', difficulty: 'medium',
  },
  {
    fullQuote: 'Brevity is the soul of wit.',
    displayQuote: '___ is the soul of ___.',
    missingWords: ['brevity', 'wit'],
    play: 'Hamlet', character: 'Polonius', difficulty: 'medium',
  },
  {
    fullQuote: 'Love looks not with the eyes, but with the mind.',
    displayQuote: 'Love looks not with the ___, but with the ___.',
    missingWords: ['eyes', 'mind'],
    play: 'A Midsummer Night\'s Dream', character: 'Helena', difficulty: 'medium',
  },
  {
    fullQuote: 'Some are born great, some achieve greatness, and some have greatness thrust upon them.',
    displayQuote: 'Some are born ___, some achieve ___, and some have ___ thrust upon them.',
    missingWords: ['great', 'greatness', 'greatness'],
    play: 'Twelfth Night', character: 'Malvolio', difficulty: 'medium',
  },
  {
    fullQuote: 'The fault, dear Brutus, is not in our stars, but in ourselves.',
    displayQuote: 'The fault, dear Brutus, is not in our ___, but in ___.',
    missingWords: ['stars', 'ourselves'],
    play: 'Julius Caesar', character: 'Cassius', difficulty: 'hard',
  },
  {
    fullQuote: 'Though she be but little, she is fierce.',
    displayQuote: 'Though she be but ___, she is ___.',
    missingWords: ['little', 'fierce'],
    play: 'A Midsummer Night\'s Dream', character: 'Helena', difficulty: 'hard',
  },
  {
    fullQuote: 'Cowards die many times before their deaths; the valiant never taste of death but once.',
    displayQuote: 'Cowards die many times before their deaths; the ___ never taste of death but ___.',
    missingWords: ['valiant', 'once'],
    play: 'Julius Caesar', character: 'Caesar', difficulty: 'hard',
  },
  {
    fullQuote: 'Hell is empty and all the devils are here.',
    displayQuote: '___ is empty and all the ___ are here.',
    missingWords: ['hell', 'devils'],
    play: 'The Tempest', character: 'Ariel', difficulty: 'hard',
  },
];

/** Get a random challenge */
export function getRandomChallenge(): QuoteChallenge {
  return CHALLENGE_BANK[Math.floor(Math.random() * CHALLENGE_BANK.length)];
}

/** Check if the user's answers match (case-insensitive) */
export function checkAnswers(challenge: QuoteChallenge, answers: string[]): boolean {
  if (answers.length !== challenge.missingWords.length) return false;
  return challenge.missingWords.every(
    (word, i) => answers[i]?.trim().toLowerCase() === word.toLowerCase(),
  );
}
