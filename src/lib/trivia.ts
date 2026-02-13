/**
 * Shakespeare Trivia — Question bank for the mini-game.
 * V1: Expanded to 65 questions across categories and difficulties.
 */

export interface TriviaQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

export const TRIVIA_BANK: TriviaQuestion[] = [
  // ========================================
  // EASY — General Shakespeare Knowledge
  // ========================================
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
  {
    question: 'Where was Shakespeare born?',
    options: ['Stratford-upon-Avon', 'London', 'Oxford', 'Canterbury'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'Who kills Romeo in the play Romeo and Juliet?',
    options: ['No one — he kills himself', 'Tybalt', 'Paris', 'Juliet\'s father'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'What is the name of Shakespeare\'s theater?',
    options: ['The Globe Theatre', 'The Rose Theatre', 'The Swan Theatre', 'The Royal Theatre'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'Which of these is a Shakespeare comedy?',
    options: ['A Midsummer Night\'s Dream', 'Hamlet', 'Macbeth', 'Othello'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'What does Juliet stand on when Romeo speaks to her?',
    options: ['A balcony', 'A tower', 'A bridge', 'A rooftop'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: '"Friends, Romans, countrymen, lend me your ears" is from which play?',
    options: ['Julius Caesar', 'Coriolanus', 'Antony and Cleopatra', 'Titus Andronicus'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'How many plays did Shakespeare write?',
    options: ['37', '15', '50', '100'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'What famous Scottish king is the subject of a Shakespeare tragedy?',
    options: ['Macbeth', 'Duncan', 'Malcolm', 'Banquo'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'Which play features a magical island?',
    options: ['The Tempest', 'Twelfth Night', 'The Winter\'s Tale', 'Pericles'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'Romeo belongs to which family?',
    options: ['Montague', 'Capulet', 'Escalus', 'Laurence'],
    correctIndex: 0, difficulty: 'easy',
  },

  // ========================================
  // MEDIUM — Character & Plot Knowledge
  // ========================================
  {
    question: 'Which play features the character Puck?',
    options: ['A Midsummer Night\'s Dream', 'The Tempest', 'Twelfth Night', 'As You Like It'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'What is Prospero\'s magical servant in The Tempest?',
    options: ['Ariel', 'Puck', 'Caliban', 'Oberon'],
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
  {
    question: 'What kills Hamlet at the end of the play?',
    options: ['A poisoned sword', 'A dagger', 'Poison in his drink', 'He falls from a tower'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'Which play features three witches?',
    options: ['Macbeth', 'The Tempest', 'Hamlet', 'A Midsummer Night\'s Dream'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'Who says "Et tu, Brute?" as he is dying?',
    options: ['Julius Caesar', 'Brutus', 'Mark Antony', 'Cassius'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'What is the name of the mischievous spirit in A Midsummer Night\'s Dream?',
    options: ['Puck (Robin Goodfellow)', 'Ariel', 'Caliban', 'Tinker Bell'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'Which character in Hamlet is told "Get thee to a nunnery"?',
    options: ['Ophelia', 'Gertrude', 'Rosencrantz', 'Horatio'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'In The Merchant of Venice, what does Shylock demand as his bond?',
    options: ['A pound of flesh', 'A bag of gold', 'A ship', 'A ring'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'Who is Prospero\'s monstrous servant in The Tempest?',
    options: ['Caliban', 'Ariel', 'Ferdinand', 'Stephano'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'Lady Macbeth says "Out, damned ___!" What word fills the blank?',
    options: ['Spot', 'Blood', 'Hand', 'Stain'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'In which play does a character hold a skull and say "Alas, poor Yorick"?',
    options: ['Hamlet', 'Macbeth', 'Richard III', 'King Lear'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'Which play features the characters Beatrice and Benedick?',
    options: ['Much Ado About Nothing', 'The Taming of the Shrew', 'As You Like It', 'Twelfth Night'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'What does Macbeth see floating before him that leads him to Duncan\'s chamber?',
    options: ['A dagger', 'A ghost', 'A crown', 'A torch'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'Who is the Prince of Verona in Romeo and Juliet?',
    options: ['Escalus', 'Paris', 'Mercutio', 'Tybalt'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'What is the subtitle of Twelfth Night?',
    options: ['Or, What You Will', 'Or, As You Like It', 'Or, The Comedy of Errors', 'Or, All\'s Well'],
    correctIndex: 0, difficulty: 'medium',
  },

  // ========================================
  // HARD — Deep Knowledge & Interpretation
  // ========================================
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
  {
    question: 'In which play does a character turn into a donkey?',
    options: ['A Midsummer Night\'s Dream', 'The Tempest', 'The Merry Wives of Windsor', 'Twelfth Night'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'What is Iago\'s rank in Othello?',
    options: ['Ensign', 'Captain', 'General', 'Lieutenant'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'Which Shakespeare play is also known as "The Scottish Play"?',
    options: ['Macbeth', 'Hamlet', 'King Lear', 'Richard III'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: '"Now is the winter of our discontent" opens which play?',
    options: ['Richard III', 'King Lear', 'Henry V', 'The Winter\'s Tale'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'Which of Shakespeare\'s plays is his longest?',
    options: ['Hamlet', 'King Lear', 'Othello', 'Richard III'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'Prospero breaks his staff and drowns his book at the end of which play?',
    options: ['The Tempest', 'A Midsummer Night\'s Dream', 'The Winter\'s Tale', 'Cymbeline'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'Which character says "Lord, what fools these mortals be!"?',
    options: ['Puck', 'Oberon', 'Titania', 'Bottom'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: '"The quality of mercy is not strained" is from which play?',
    options: ['The Merchant of Venice', 'Measure for Measure', 'The Winter\'s Tale', 'All\'s Well That Ends Well'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'What flower\'s juice does Oberon use to make people fall in love?',
    options: ['Love-in-idleness (a pansy)', 'A rose', 'A lily', 'A violet'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'In King Lear, how many daughters does Lear have?',
    options: ['Three', 'Two', 'Four', 'One'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'Which Shakespearean villain says "I am not what I am"?',
    options: ['Iago', 'Edmund', 'Richard III', 'Aaron'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'What prophecy do the witches give Macbeth about Birnam Wood?',
    options: [
      'He won\'t be defeated until the wood moves to his castle',
      'He must burn the wood to stay safe',
      'The wood hides his enemies',
      'A tree will fall and crush him',
    ],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'Shakespeare\'s "Dark Lady" appears in which group of works?',
    options: ['The Sonnets', 'The Histories', 'The Romances', 'The Problem Plays'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: '"These violent delights have violent ends" is said by which character?',
    options: ['Friar Lawrence', 'Romeo', 'Juliet', 'The Prince'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'Which play features the characters Rosalind and Orlando in the Forest of Arden?',
    options: ['As You Like It', 'A Midsummer Night\'s Dream', 'The Tempest', 'Love\'s Labour\'s Lost'],
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
