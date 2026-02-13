/**
 * Shakespeare Trivia — Question bank for the mini-game.
 */

export interface TriviaQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

export const TRIVIA_BANK: TriviaQuestion[] = [
  // Easy
  {
    question: 'Who wrote "To be, or not to be, that is the question"?',
    options: ['William Shakespeare', 'Christopher Marlowe', 'Ben Jonson', 'John Milton'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'In which play do Romeo and Juliet appear?',
    options: ['Romeo and Juliet', 'A Midsummer Night\'s Dream', 'Hamlet', 'Othello'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'What is the name of Hamlet\'s castle?',
    options: ['Elsinore', 'Camelot', 'Dunsinane', 'Inverness'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'Which character says "A plague on both your houses!"?',
    options: ['Mercutio', 'Romeo', 'Tybalt', 'Benvolio'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'What type of writing is Shakespeare most famous for?',
    options: ['Plays and sonnets', 'Novels', 'Epic poems', 'Short stories'],
    correctIndex: 0, difficulty: 'easy',
  },
  // Medium
  {
    question: 'Which play features the character Puck?',
    options: ['A Midsummer Night\'s Dream', 'The Tempest', 'Twelfth Night', 'As You Like It'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'What is Prospero\'s magical tool in The Tempest?',
    options: ['A staff', 'A wand', 'A ring', 'A book'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: '"Double, double toil and trouble" is from which play?',
    options: ['Macbeth', 'Hamlet', 'King Lear', 'The Tempest'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'How many sonnets did Shakespeare write?',
    options: ['154', '100', '200', '52'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'Which character is the Queen of the Fairies?',
    options: ['Titania', 'Ophelia', 'Juliet', 'Cordelia'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'In which city is Romeo and Juliet set?',
    options: ['Verona', 'Venice', 'Florence', 'Rome'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'Who is Hamlet\'s uncle?',
    options: ['Claudius', 'Polonius', 'Horatio', 'Laertes'],
    correctIndex: 0, difficulty: 'medium',
  },
  // Hard
  {
    question: 'Which play contains the line "All the world\'s a stage"?',
    options: ['As You Like It', 'Hamlet', 'The Merchant of Venice', 'Much Ado About Nothing'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'What is the name of the fairy king in A Midsummer Night\'s Dream?',
    options: ['Oberon', 'Prospero', 'Ariel', 'Caliban'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: '"Brevity is the soul of wit" is said by which character?',
    options: ['Polonius', 'Hamlet', 'Horatio', 'Claudius'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'Which Shakespeare play is set on a remote island?',
    options: ['The Tempest', 'Twelfth Night', 'Pericles', 'The Winter\'s Tale'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'What does Juliet mean when she says "What\'s in a name?"?',
    options: [
      'Names don\'t change who someone really is',
      'She forgot Romeo\'s name',
      'She wants to change her own name',
      'Names are more important than actions',
    ],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'Which of these is NOT a Shakespeare play?',
    options: ['Doctor Faustus', 'The Tempest', 'Othello', 'King Lear'],
    correctIndex: 0, difficulty: 'hard',
  },
];

/** Shuffle array in place (Fisher-Yates) */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Get a random set of trivia questions with shuffled answer options */
export function getRandomQuestions(count: number): TriviaQuestion[] {
  const shuffled = shuffle(TRIVIA_BANK);
  return shuffled.slice(0, count).map(q => {
    // Shuffle options but track the correct answer
    const correctAnswer = q.options[q.correctIndex];
    const shuffledOptions = shuffle(q.options);
    const newCorrectIndex = shuffledOptions.indexOf(correctAnswer);
    return { ...q, options: shuffledOptions, correctIndex: newCorrectIndex };
  });
}
