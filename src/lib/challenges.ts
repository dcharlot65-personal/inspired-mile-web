/**
 * Quote Completion Challenges — Fill in the missing words.
 * V1: Expanded to 42 challenges across easy/medium/hard.
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
  // ========================================
  // EASY — Famous, recognizable quotes
  // ========================================
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
    fullQuote: 'Romeo, Romeo, wherefore art thou Romeo?',
    displayQuote: 'Romeo, Romeo, ___ art thou Romeo?',
    missingWords: ['wherefore'],
    play: 'Romeo and Juliet', character: 'Juliet', difficulty: 'easy',
  },
  {
    fullQuote: 'Friends, Romans, countrymen, lend me your ears.',
    displayQuote: 'Friends, Romans, countrymen, lend me your ___.',
    missingWords: ['ears'],
    play: 'Julius Caesar', character: 'Mark Antony', difficulty: 'easy',
  },
  {
    fullQuote: 'A rose by any other name would smell as sweet.',
    displayQuote: 'A ___ by any other name would smell as ___.',
    missingWords: ['rose', 'sweet'],
    play: 'Romeo and Juliet', character: 'Juliet', difficulty: 'easy',
  },
  {
    fullQuote: 'Double, double toil and trouble; fire burn and cauldron bubble.',
    displayQuote: 'Double, double ___ and ___; fire burn and cauldron bubble.',
    missingWords: ['toil', 'trouble'],
    play: 'Macbeth', character: 'The Witches', difficulty: 'easy',
  },
  {
    fullQuote: 'Et tu, Brute?',
    displayQuote: 'Et tu, ___?',
    missingWords: ['brute'],
    play: 'Julius Caesar', character: 'Caesar', difficulty: 'easy',
  },
  {
    fullQuote: 'Now is the winter of our discontent.',
    displayQuote: 'Now is the ___ of our ___.',
    missingWords: ['winter', 'discontent'],
    play: 'Richard III', character: 'Richard III', difficulty: 'easy',
  },
  {
    fullQuote: 'All the world\'s a stage, and all the men and women merely players.',
    displayQuote: 'All the world\'s a ___, and all the men and women merely ___.',
    missingWords: ['stage', 'players'],
    play: 'As You Like It', character: 'Jaques', difficulty: 'easy',
  },
  {
    fullQuote: 'Out, damned spot! Out, I say!',
    displayQuote: 'Out, damned ___! Out, I say!',
    missingWords: ['spot'],
    play: 'Macbeth', character: 'Lady Macbeth', difficulty: 'easy',
  },
  {
    fullQuote: 'A plague on both your houses!',
    displayQuote: 'A ___ on both your ___!',
    missingWords: ['plague', 'houses'],
    play: 'Romeo and Juliet', character: 'Mercutio', difficulty: 'easy',
  },
  {
    fullQuote: 'If music be the food of love, play on.',
    displayQuote: 'If ___ be the food of ___, play on.',
    missingWords: ['music', 'love'],
    play: 'Twelfth Night', character: 'Orsino', difficulty: 'easy',
  },

  // ========================================
  // MEDIUM — Well-known but require thought
  // ========================================
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
    fullQuote: 'The course of true love never did run smooth.',
    displayQuote: 'The course of true ___ never did run ___.',
    missingWords: ['love', 'smooth'],
    play: 'A Midsummer Night\'s Dream', character: 'Lysander', difficulty: 'medium',
  },
  {
    fullQuote: 'Good night, good night! Parting is such sweet sorrow, that I shall say good night till it be morrow.',
    displayQuote: 'Good night, good night! Parting is such sweet ___, that I shall say good night till it be ___.',
    missingWords: ['sorrow', 'morrow'],
    play: 'Romeo and Juliet', character: 'Juliet', difficulty: 'medium',
  },
  {
    fullQuote: 'There is nothing either good or bad, but thinking makes it so.',
    displayQuote: 'There is nothing either good or bad, but ___ makes it so.',
    missingWords: ['thinking'],
    play: 'Hamlet', character: 'Hamlet', difficulty: 'medium',
  },
  {
    fullQuote: 'Lord, what fools these mortals be!',
    displayQuote: 'Lord, what ___ these ___ be!',
    missingWords: ['fools', 'mortals'],
    play: 'A Midsummer Night\'s Dream', character: 'Puck', difficulty: 'medium',
  },
  {
    fullQuote: 'Is this a dagger which I see before me, the handle toward my hand?',
    displayQuote: 'Is this a ___ which I see before me, the handle toward my ___?',
    missingWords: ['dagger', 'hand'],
    play: 'Macbeth', character: 'Macbeth', difficulty: 'medium',
  },
  {
    fullQuote: 'Shall I compare thee to a summer\'s day? Thou art more lovely and more temperate.',
    displayQuote: 'Shall I compare thee to a ___\'s day? Thou art more lovely and more ___.',
    missingWords: ['summer', 'temperate'],
    play: 'Sonnet 18', character: 'The Poet', difficulty: 'medium',
  },
  {
    fullQuote: 'Uneasy lies the head that wears a crown.',
    displayQuote: 'Uneasy lies the ___ that wears a ___.',
    missingWords: ['head', 'crown'],
    play: 'Henry IV, Part 2', character: 'King Henry', difficulty: 'medium',
  },
  {
    fullQuote: 'The better part of valour is discretion.',
    displayQuote: 'The better part of ___ is ___.',
    missingWords: ['valour', 'discretion'],
    play: 'Henry IV, Part 1', character: 'Falstaff', difficulty: 'medium',
  },
  {
    fullQuote: 'How sharper than a serpent\'s tooth it is to have a thankless child.',
    displayQuote: 'How sharper than a ___\'s tooth it is to have a ___ child.',
    missingWords: ['serpent', 'thankless'],
    play: 'King Lear', character: 'Lear', difficulty: 'medium',
  },
  {
    fullQuote: 'This above all: to thine own self be true.',
    displayQuote: 'This above all: to thine own ___ be ___.',
    missingWords: ['self', 'true'],
    play: 'Hamlet', character: 'Polonius', difficulty: 'medium',
  },
  {
    fullQuote: 'By the pricking of my thumbs, something wicked this way comes.',
    displayQuote: 'By the pricking of my ___, something ___ this way comes.',
    missingWords: ['thumbs', 'wicked'],
    play: 'Macbeth', character: 'Second Witch', difficulty: 'medium',
  },

  // ========================================
  // HARD — Deep cuts, longer quotes
  // ========================================
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
  {
    fullQuote: 'The quality of mercy is not strained; it droppeth as the gentle rain from heaven.',
    displayQuote: 'The quality of ___ is not strained; it droppeth as the gentle ___ from heaven.',
    missingWords: ['mercy', 'rain'],
    play: 'The Merchant of Venice', character: 'Portia', difficulty: 'hard',
  },
  {
    fullQuote: 'These violent delights have violent ends.',
    displayQuote: 'These violent ___ have violent ___.',
    missingWords: ['delights', 'ends'],
    play: 'Romeo and Juliet', character: 'Friar Lawrence', difficulty: 'hard',
  },
  {
    fullQuote: 'What\'s in a name? That which we call a rose by any other name would smell as sweet.',
    displayQuote: 'What\'s in a ___? That which we call a ___ by any other name would smell as sweet.',
    missingWords: ['name', 'rose'],
    play: 'Romeo and Juliet', character: 'Juliet', difficulty: 'hard',
  },
  {
    fullQuote: 'The evil that men do lives after them; the good is oft interred with their bones.',
    displayQuote: 'The evil that men do lives after them; the ___ is oft ___ with their bones.',
    missingWords: ['good', 'interred'],
    play: 'Julius Caesar', character: 'Mark Antony', difficulty: 'hard',
  },
  {
    fullQuote: 'I am not what I am.',
    displayQuote: 'I am ___ what I ___.',
    missingWords: ['not', 'am'],
    play: 'Othello', character: 'Iago', difficulty: 'hard',
  },
  {
    fullQuote: 'O, beware, my lord, of jealousy! It is the green-eyed monster which doth mock the meat it feeds on.',
    displayQuote: 'O, beware, my lord, of ___! It is the ___-eyed monster which doth mock the meat it feeds on.',
    missingWords: ['jealousy', 'green'],
    play: 'Othello', character: 'Iago', difficulty: 'hard',
  },
  {
    fullQuote: 'Tomorrow, and tomorrow, and tomorrow, creeps in this petty pace from day to day.',
    displayQuote: 'Tomorrow, and tomorrow, and tomorrow, ___ in this petty ___ from day to day.',
    missingWords: ['creeps', 'pace'],
    play: 'Macbeth', character: 'Macbeth', difficulty: 'hard',
  },
  {
    fullQuote: 'Life\'s but a walking shadow, a poor player that struts and frets his hour upon the stage.',
    displayQuote: 'Life\'s but a walking ___, a poor player that struts and frets his ___ upon the stage.',
    missingWords: ['shadow', 'hour'],
    play: 'Macbeth', character: 'Macbeth', difficulty: 'hard',
  },
  {
    fullQuote: 'Be not afraid of greatness. Some are born great, some achieve greatness, and others have greatness thrust upon them.',
    displayQuote: 'Be not ___ of greatness. Some are born great, some ___ greatness, and others have greatness thrust upon them.',
    missingWords: ['afraid', 'achieve'],
    play: 'Twelfth Night', character: 'Malvolio', difficulty: 'hard',
  },
];

/** Get a random challenge */
export function getRandomChallenge(): QuoteChallenge {
  return CHALLENGE_BANK[Math.floor(Math.random() * CHALLENGE_BANK.length)];
}

/** Get a random challenge by difficulty */
export function getRandomChallengeByDifficulty(difficulty: 'easy' | 'medium' | 'hard'): QuoteChallenge {
  const filtered = CHALLENGE_BANK.filter(c => c.difficulty === difficulty);
  return filtered[Math.floor(Math.random() * filtered.length)];
}

/** Check if the user's answers match (case-insensitive) */
export function checkAnswers(challenge: QuoteChallenge, answers: string[]): boolean {
  if (answers.length !== challenge.missingWords.length) return false;
  return challenge.missingWords.every(
    (word, i) => answers[i]?.trim().toLowerCase() === word.toLowerCase(),
  );
}
