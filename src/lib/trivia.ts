/**
 * Shakespeare Trivia — Question bank for the mini-game.
 * V2: Expanded to 200 questions (51 easy, 75 medium, 75 hard).
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

  // ========================================
  // EASY — Expanded (35 new questions)
  // ========================================
  {
    question: 'What is the name of Shakespeare\'s wife?',
    options: ['Anne Hathaway', 'Mary Arden', 'Elizabeth Tudor', 'Catherine Parr'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'In what century was Shakespeare born?',
    options: ['The 16th century', 'The 15th century', 'The 17th century', 'The 14th century'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'Which of these is a Shakespeare tragedy?',
    options: ['Othello', 'The Taming of the Shrew', 'Twelfth Night', 'The Merry Wives of Windsor'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'What is the setting of Hamlet?',
    options: ['Denmark', 'England', 'Scotland', 'Norway'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'Who is the title character in The Merchant of Venice?',
    options: ['Antonio', 'Shylock', 'Bassanio', 'Portia'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'In Romeo and Juliet, what method does Juliet use to fake her death?',
    options: ['A sleeping potion', 'A magic spell', 'Holding her breath', 'Poison'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'Which character is the Prince of Denmark?',
    options: ['Hamlet', 'Claudius', 'Horatio', 'Fortinbras'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'Shakespeare is often called "The ____ of Avon." What fills the blank?',
    options: ['Bard', 'King', 'Poet', 'Master'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'Juliet belongs to which family?',
    options: ['Capulet', 'Montague', 'Escalus', 'Laurence'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'In which country are most of Shakespeare\'s comedies set?',
    options: ['Italy', 'England', 'France', 'Greece'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'Who kills Macbeth at the end of the play?',
    options: ['Macduff', 'Malcolm', 'Banquo', 'Duncan'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'What does "Hamlet" mean when he says "the rest is silence"?',
    options: ['He is dying and can say no more', 'He wants everyone to be quiet', 'He is going to sleep', 'He has no opinion'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'Which Shakespeare play involves shipwrecked twins?',
    options: ['Twelfth Night', 'The Tempest', 'The Comedy of Errors', 'Pericles'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'What animal does Bottom get the head of in A Midsummer Night\'s Dream?',
    options: ['A donkey', 'A horse', 'A bear', 'A pig'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'In which English city did Shakespeare spend most of his career?',
    options: ['London', 'Stratford-upon-Avon', 'Oxford', 'Cambridge'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'What is the Friar\'s name in Romeo and Juliet?',
    options: ['Friar Lawrence', 'Friar Tuck', 'Friar John', 'Friar Francis'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'Who is the ruler of the magical island in The Tempest?',
    options: ['Prospero', 'Ariel', 'Caliban', 'Alonso'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'Which play features a character named Shylock?',
    options: ['The Merchant of Venice', 'Othello', 'The Tempest', 'Hamlet'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'Who is the ghost that appears at the beginning of Hamlet?',
    options: ['Hamlet\'s father', 'Hamlet\'s grandfather', 'Polonius', 'Yorick'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'What famous line begins "Shall I compare thee to a summer\'s day?"',
    options: ['Sonnet 18', 'Sonnet 1', 'Sonnet 130', 'Sonnet 116'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'What is Macbeth\'s title at the beginning of the play?',
    options: ['Thane of Glamis', 'King of Scotland', 'Duke of Albany', 'Earl of Northumberland'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'Which Shakespeare play is about a jealous Moor?',
    options: ['Othello', 'The Merchant of Venice', 'Titus Andronicus', 'Antony and Cleopatra'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'How does Ophelia die in Hamlet?',
    options: ['She drowns', 'She is poisoned', 'She is stabbed', 'She falls from a tower'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'Which monarch ruled England during most of Shakespeare\'s career?',
    options: ['Queen Elizabeth I', 'King Henry VIII', 'King James I', 'Queen Mary I'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'What does Prospero\'s daughter Miranda say when she first sees other people?',
    options: ['"O brave new world"', '"What magic is this"', '"Father, who are they"', '"I must be dreaming"'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'In which play does a character disguise herself as a lawyer named Balthazar?',
    options: ['The Merchant of Venice', 'Twelfth Night', 'As You Like It', 'Measure for Measure'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'What was the name of Shakespeare\'s acting company under King James I?',
    options: ['The King\'s Men', 'The Queen\'s Players', 'The Admiral\'s Men', 'The Chamberlain\'s Servants'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'Which play opens with a storm at sea?',
    options: ['The Tempest', 'Twelfth Night', 'Othello', 'Pericles'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'In Julius Caesar, who leads the conspiracy to kill Caesar?',
    options: ['Brutus and Cassius', 'Mark Antony and Octavius', 'Calpurnia and Portia', 'Cicero and Casca'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'What genre is A Midsummer Night\'s Dream?',
    options: ['Comedy', 'Tragedy', 'History', 'Romance'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'Which Shakespeare play features the Forest of Arden?',
    options: ['As You Like It', 'A Midsummer Night\'s Dream', 'The Merry Wives of Windsor', 'Love\'s Labour\'s Lost'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'In what year did Shakespeare die?',
    options: ['1616', '1600', '1623', '1590'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'Who is Romeo\'s best friend?',
    options: ['Mercutio', 'Benvolio', 'Tybalt', 'Paris'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'What is the name of Prospero\'s daughter in The Tempest?',
    options: ['Miranda', 'Cordelia', 'Perdita', 'Helena'],
    correctIndex: 0, difficulty: 'easy',
  },
  {
    question: 'Which play features the phrase "If music be the food of love, play on"?',
    options: ['Twelfth Night', 'A Midsummer Night\'s Dream', 'Romeo and Juliet', 'The Tempest'],
    correctIndex: 0, difficulty: 'easy',
  },

  // ========================================
  // MEDIUM — Expanded (55 new questions)
  // ========================================
  {
    question: 'What title does Macbeth receive after his first battle victory?',
    options: ['Thane of Cawdor', 'Thane of Glamis', 'Duke of Albany', 'Earl of Ross'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'In Twelfth Night, what is Viola\'s male disguise name?',
    options: ['Cesario', 'Sebastian', 'Orsino', 'Antonio'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'Who kills Tybalt in Romeo and Juliet?',
    options: ['Romeo', 'Mercutio', 'Benvolio', 'Paris'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'In King Lear, which daughter truly loves her father?',
    options: ['Cordelia', 'Goneril', 'Regan', 'All three equally'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'What object does Othello use to kill Desdemona?',
    options: ['A pillow (he smothers her)', 'A dagger', 'A poison', 'A rope'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'In which play does the character Malvolio appear?',
    options: ['Twelfth Night', 'Much Ado About Nothing', 'The Merry Wives of Windsor', 'As You Like It'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'What is the name of Hamlet\'s mother?',
    options: ['Gertrude', 'Ophelia', 'Cordelia', 'Desdemona'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'In The Taming of the Shrew, what is the name of the "shrew"?',
    options: ['Katherina (Kate)', 'Bianca', 'Adriana', 'Helena'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'Who is Desdemona\'s father in Othello?',
    options: ['Brabantio', 'Gratiano', 'Lodovico', 'Montano'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'Which character delivers the "Once more unto the breach" speech?',
    options: ['King Henry V', 'King Henry IV', 'Richard III', 'King John'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'In The Winter\'s Tale, the character Perdita is a princess of which kingdom?',
    options: ['Sicilia', 'Bohemia', 'Illyria', 'Navarre'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'Who is the Duke of Illyria in Twelfth Night?',
    options: ['Orsino', 'Malvolio', 'Sebastian', 'Sir Toby Belch'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'What does Portia disguise herself as in The Merchant of Venice?',
    options: ['A male lawyer', 'A merchant', 'A sailor', 'A monk'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'In Much Ado About Nothing, which character fakes her own death?',
    options: ['Hero', 'Beatrice', 'Margaret', 'Ursula'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'What play-within-a-play does Hamlet stage to catch the king\'s conscience?',
    options: ['The Mousetrap', 'The Murder of Gonzago', 'The Play of the King', 'A Mirror for Princes'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'In Julius Caesar, who gives the famous funeral speech beginning "Friends, Romans, countrymen"?',
    options: ['Mark Antony', 'Brutus', 'Cassius', 'Octavius'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'What is the name of Lear\'s loyal companion who is disguised as "Poor Tom"?',
    options: ['Edgar', 'Edmund', 'Kent', 'Gloucester'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'In Othello, what object does Iago use to convince Othello of Desdemona\'s infidelity?',
    options: ['A handkerchief', 'A letter', 'A ring', 'A portrait'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'Which play ends with the line "The rest is silence"?',
    options: ['Hamlet', 'King Lear', 'Othello', 'Macbeth'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'Who disguises herself as a boy named Ganymede in As You Like It?',
    options: ['Rosalind', 'Celia', 'Phebe', 'Audrey'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'What happens to the Globe Theatre in 1613?',
    options: ['It burned down during a performance', 'It was closed by the king', 'It collapsed in a storm', 'It was demolished for rebuilding'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'In Measure for Measure, who is the corrupt deputy left in charge of Vienna?',
    options: ['Angelo', 'Escalus', 'Lucio', 'Claudio'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'Which Shakespeare play features a character named Caliban?',
    options: ['The Tempest', 'A Midsummer Night\'s Dream', 'The Winter\'s Tale', 'Cymbeline'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'What is the name of Petruchio\'s bride in The Taming of the Shrew?',
    options: ['Katherina', 'Bianca', 'Adriana', 'Silvia'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'In Antony and Cleopatra, how does Cleopatra die?',
    options: ['By the bite of an asp (snake)', 'By poison', 'By drowning', 'By a dagger'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'Who is Banquo\'s ghost haunting in Macbeth?',
    options: ['Macbeth', 'Lady Macbeth', 'Macduff', 'Malcolm'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'What is the name of Othello\'s lieutenant whom Iago is jealous of?',
    options: ['Cassio', 'Roderigo', 'Montano', 'Gratiano'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'In Richard III, what does Richard offer to trade his kingdom for?',
    options: ['A horse', 'A sword', 'A crown', 'His life'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'Which twin is Viola\'s brother in Twelfth Night?',
    options: ['Sebastian', 'Antonio', 'Orsino', 'Feste'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'In Henry V, which battle does the famous St. Crispin\'s Day speech precede?',
    options: ['The Battle of Agincourt', 'The Battle of Hastings', 'The Battle of Crecy', 'The Battle of Bosworth Field'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'Who kills King Duncan in Macbeth?',
    options: ['Macbeth', 'Lady Macbeth', 'Macduff', 'Banquo'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'In The Merchant of Venice, which casket must Bassanio choose to win Portia?',
    options: ['The lead casket', 'The gold casket', 'The silver casket', 'The bronze casket'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'What is the name of Hamlet\'s close friend and confidant?',
    options: ['Horatio', 'Laertes', 'Rosencrantz', 'Guildenstern'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'Which Shakespeare play is set in ancient Egypt?',
    options: ['Antony and Cleopatra', 'Julius Caesar', 'Titus Andronicus', 'Coriolanus'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'In King Lear, what does Lear ask his daughters to declare before dividing his kingdom?',
    options: ['How much they love him', 'Their plans for ruling', 'Their marriage prospects', 'Their military strength'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'Who wrote the line "Parting is such sweet sorrow"?',
    options: ['Juliet in Romeo and Juliet', 'Hamlet in Hamlet', 'Portia in The Merchant of Venice', 'Viola in Twelfth Night'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'What does Lady Macbeth obsessively do while sleepwalking?',
    options: ['Wash her hands', 'Recite speeches', 'Search for a dagger', 'Call for her husband'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'In Much Ado About Nothing, who is the villainous schemer?',
    options: ['Don John', 'Don Pedro', 'Claudio', 'Borachio'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'What is the name of the shepherd\'s festival in The Winter\'s Tale?',
    options: ['The sheep-shearing feast', 'The harvest ball', 'The spring carnival', 'The midsummer revel'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'In As You Like It, who speaks the "Seven Ages of Man" speech?',
    options: ['Jaques', 'Rosalind', 'Orlando', 'Duke Senior'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'Which character in A Midsummer Night\'s Dream leads a group of amateur actors?',
    options: ['Peter Quince', 'Bottom', 'Snug', 'Flute'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'Who is Cordelia\'s father in King Lear?',
    options: ['King Lear', 'The Duke of Gloucester', 'The Earl of Kent', 'The Duke of Cornwall'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'In The Tempest, what relationship does Caliban claim to have with the island?',
    options: ['He claims to be its rightful ruler', 'He claims to be its creator', 'He claims to be its protector', 'He claims no relationship'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'What is the name of Brutus\'s wife in Julius Caesar?',
    options: ['Portia', 'Calpurnia', 'Octavia', 'Cornelia'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'Which Shakespeare play takes place in the Athenian woods?',
    options: ['A Midsummer Night\'s Dream', 'As You Like It', 'The Two Gentlemen of Verona', 'Timon of Athens'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'In Measure for Measure, what crime has Claudio been arrested for?',
    options: ['Getting his fiancee pregnant before marriage', 'Theft', 'Murder', 'Treason'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'What is the name of the clown or fool in Twelfth Night?',
    options: ['Feste', 'Touchstone', 'Launcelot', 'Dogberry'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'Who does Ferdinand fall in love with in The Tempest?',
    options: ['Miranda', 'Ariel', 'Claribel', 'Sycorax'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'What does Romeo buy from the apothecary?',
    options: ['Poison', 'A sleeping draught', 'Medicine', 'A love potion'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'In King Lear, who blinds Gloucester?',
    options: ['Cornwall', 'Edmund', 'Regan', 'Oswald'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'What is the name of Shakespeare\'s theater company before King James became patron?',
    options: ['The Lord Chamberlain\'s Men', 'The Admiral\'s Men', 'The Queen\'s Men', 'The Earl of Leicester\'s Men'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'In which play does the character Dogberry appear as a bumbling constable?',
    options: ['Much Ado About Nothing', 'The Merry Wives of Windsor', 'A Midsummer Night\'s Dream', 'Twelfth Night'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'How does Antony die in Antony and Cleopatra?',
    options: ['He falls on his own sword', 'He is killed in battle', 'He is poisoned', 'He is executed'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'Who is Hermione in The Winter\'s Tale?',
    options: ['The Queen of Sicilia', 'A shepherdess', 'A witch', 'A servant'],
    correctIndex: 0, difficulty: 'medium',
  },
  {
    question: 'Which play features a character who wears yellow cross-gartered stockings?',
    options: ['Twelfth Night', 'Much Ado About Nothing', 'As You Like It', 'Love\'s Labour\'s Lost'],
    correctIndex: 0, difficulty: 'medium',
  },

  // ========================================
  // HARD — Expanded (55 new questions)
  // ========================================
  {
    question: 'What is the name of Hamlet\'s play-within-a-play, as Hamlet himself calls it?',
    options: ['The Mousetrap', 'The Murder of Gonzago', 'The King\'s Conscience', 'Revenge of Denmark'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'In which play does a character survive being abandoned as a baby in Bohemia?',
    options: ['The Winter\'s Tale', 'Pericles', 'Cymbeline', 'The Tempest'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'What is the name of Gloucester\'s illegitimate son in King Lear?',
    options: ['Edmund', 'Edgar', 'Oswald', 'Cornwall'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'Which Shakespeare sonnet begins "Let me not to the marriage of true minds / Admit impediments"?',
    options: ['Sonnet 116', 'Sonnet 18', 'Sonnet 130', 'Sonnet 73'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'In Measure for Measure, what is the name of the Duke who disguises himself as a friar?',
    options: ['Vincentio', 'Angelo', 'Escalus', 'Claudio'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'Which of Shakespeare\'s plays is believed to be his last solo-authored work?',
    options: ['The Tempest', 'The Winter\'s Tale', 'Henry VIII', 'Cymbeline'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'What are the names of King Lear\'s three daughters?',
    options: ['Goneril, Regan, and Cordelia', 'Goneril, Rosalind, and Cordelia', 'Helena, Regan, and Cordelia', 'Goneril, Regan, and Ophelia'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'In The Merchant of Venice, what inscription is on the lead casket?',
    options: ['"Who chooseth me must give and hazard all he hath"', '"Who chooseth me shall gain what many men desire"', '"Who chooseth me shall get as much as he deserves"', '"Who chooseth me shall find true love"'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'What is unusual about Sonnet 130 ("My mistress\' eyes are nothing like the sun")?',
    options: ['It is an anti-Petrarchan sonnet that mocks conventional love poetry', 'It is written in free verse instead of iambic pentameter', 'It is the only sonnet addressed to a man', 'It was published separately from the other sonnets'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'In Richard III, what deformity does Richard claim to have?',
    options: ['A hunched back', 'A missing hand', 'A club foot', 'Blindness in one eye'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'Who is Sycorax in The Tempest?',
    options: ['Caliban\'s mother, a witch who ruled the island before Prospero', 'Ariel\'s sister', 'Prospero\'s first wife', 'A sea goddess'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'What is the rhyme scheme of a Shakespearean sonnet?',
    options: ['ABAB CDCD EFEF GG', 'ABBA ABBA CDE CDE', 'AABB CCDD EEFF GG', 'ABAB ABAB CDCD EE'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'In which play does the stage direction "Exit, pursued by a bear" appear?',
    options: ['The Winter\'s Tale', 'The Tempest', 'A Midsummer Night\'s Dream', 'As You Like It'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'What was the name of Shakespeare\'s son who died in childhood?',
    options: ['Hamnet', 'Hamlet', 'Edmund', 'William'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'In Othello, where is Othello from?',
    options: ['He is a Moor (from North Africa)', 'He is from Venice', 'He is from Cyprus', 'He is from Spain'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'Which character in Henry V disguises himself to walk among his soldiers before battle?',
    options: ['King Henry V', 'The Duke of Exeter', 'Captain Fluellen', 'The Earl of Westmoreland'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'What is the first line of Richard III?',
    options: ['"Now is the winter of our discontent / Made glorious summer by this sun of York"', '"A horse, a horse, my kingdom for a horse"', '"Was ever woman in this humour wooed"', '"Off with his head! So much for Buckingham"'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'In The Taming of the Shrew, what is the name of the frame story character who watches the play?',
    options: ['Christopher Sly', 'Lucentio', 'Tranio', 'Grumio'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'Which of Shakespeare\'s works is considered a "problem play"?',
    options: ['Measure for Measure', 'Twelfth Night', 'The Tempest', 'Romeo and Juliet'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'What year was the original Globe Theatre built?',
    options: ['1599', '1576', '1610', '1588'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'In Macbeth, what is the name of Macduff\'s castle where his family is murdered?',
    options: ['Fife', 'Dunsinane', 'Inverness', 'Forres'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'Which character in Julius Caesar has a dream warning her husband not to go to the Senate?',
    options: ['Calpurnia', 'Portia', 'Octavia', 'Cornelia'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'What is the name of the collection in which Shakespeare\'s plays were first published together?',
    options: ['The First Folio', 'The Complete Works', 'The Quarto Collection', 'The Bard\'s Anthology'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'In what year was the First Folio published?',
    options: ['1623', '1616', '1599', '1609'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'Which Shakespeare play features a character named Autolycus, a roguish peddler?',
    options: ['The Winter\'s Tale', 'The Merry Wives of Windsor', 'Twelfth Night', 'As You Like It'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'Who speaks the epilogue at the end of The Tempest?',
    options: ['Prospero', 'Ariel', 'Ferdinand', 'The Narrator'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'In Antony and Cleopatra, what is the name of the decisive naval battle?',
    options: ['The Battle of Actium', 'The Battle of Philippi', 'The Battle of Alexandria', 'The Battle of Salamis'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'What does the word "nunnery" likely mean as a double entendre in Hamlet\'s "Get thee to a nunnery"?',
    options: ['Both a convent and, in Elizabethan slang, a brothel', 'Only a convent', 'A prison', 'A school for women'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'Which Shakespeare play contains the "To-morrow, and to-morrow, and to-morrow" soliloquy?',
    options: ['Macbeth', 'Hamlet', 'King Lear', 'Richard II'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'In King Lear, what does Kent do after being banished?',
    options: ['Disguises himself as a servant named Caius to stay near Lear', 'Flees to France', 'Joins the French army', 'Becomes a hermit'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'Which poet and playwright was Shakespeare\'s contemporary rival, killed in a tavern brawl in 1593?',
    options: ['Christopher Marlowe', 'Ben Jonson', 'Thomas Kyd', 'John Webster'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'In The Winter\'s Tale, how long passes between Acts 3 and 4?',
    options: ['16 years', '5 years', '1 year', '20 years'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'What is the "green-eyed monster" that Iago warns Othello about?',
    options: ['Jealousy', 'Ambition', 'Greed', 'Revenge'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'In A Midsummer Night\'s Dream, what play do the mechanicals perform at the wedding?',
    options: ['Pyramus and Thisbe', 'Troilus and Cressida', 'Romeo and Juliet', 'Hero and Leander'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'Who was the boy actor tradition in Elizabethan theater?',
    options: ['Young boys played all female roles since women were banned from the stage', 'Boys only played children\'s roles', 'Boys acted as stage managers', 'Boys performed only in comedies'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'In which play does Duke Senior say "Sweet are the uses of adversity"?',
    options: ['As You Like It', 'The Tempest', 'Twelfth Night', 'Measure for Measure'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'What is the term for Shakespeare\'s late plays like The Winter\'s Tale and The Tempest?',
    options: ['Romances (or late romances)', 'Tragicomedies', 'Pastoral plays', 'Masques'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'In Macbeth, who says "By the pricking of my thumbs, / Something wicked this way comes"?',
    options: ['The Second Witch', 'The First Witch', 'Lady Macbeth', 'Hecate'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'Which of Lear\'s daughters is married to the Duke of Cornwall?',
    options: ['Regan', 'Goneril', 'Cordelia', 'None of them'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'What is the full title of the play commonly known as Henry V?',
    options: ['The Life of King Henry the Fifth', 'The Chronicle History of Henry V', 'Henry V: The Warrior King', 'The Reign of King Henry V'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'In Measure for Measure, what does Angelo demand from Isabella in exchange for her brother\'s life?',
    options: ['That she sleep with him', 'A large sum of money', 'A public confession', 'That she leave the convent'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'Who says "Cowards die many times before their deaths; the valiant never taste of death but once"?',
    options: ['Julius Caesar', 'Brutus', 'Mark Antony', 'Cassius'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'What was the "pit" or "yard" in the Globe Theatre?',
    options: ['The standing area in front of the stage for the cheapest admission', 'The area below the stage for storage', 'The backstage area for actors', 'The orchestra pit for musicians'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'In Sonnet 18, what does the speaker ultimately claim will make the beloved immortal?',
    options: ['The poem itself ("So long lives this, and this gives life to thee")', 'The beloved\'s beauty', 'The summer sun', 'A painting of the beloved'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'Which character in Hamlet says "Though this be madness, yet there is method in\'t"?',
    options: ['Polonius', 'Claudius', 'Gertrude', 'Horatio'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'In The Merchant of Venice, what condition does Portia\'s deceased father set for her suitors?',
    options: ['They must choose the correct casket out of three (gold, silver, lead)', 'They must defeat each other in combat', 'They must solve a riddle', 'They must prove their wealth'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'What is the name of the epilogue character who personifies Time in The Winter\'s Tale?',
    options: ['Time (as a Chorus)', 'Father Time', 'The Oracle', 'Autolycus'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'Which Shakespeare play was likely written as a tribute to the newly crowned King James I?',
    options: ['Macbeth', 'The Tempest', 'Henry VIII', 'King Lear'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'In Twelfth Night, what trick do Maria and Sir Toby play on Malvolio?',
    options: ['They forge a love letter from Olivia telling him to wear yellow stockings', 'They lock him in a room', 'They steal his clothing', 'They convince him he is going deaf'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'What is the name of the structure above the stage in the Globe Theatre, painted with stars?',
    options: ['The Heavens', 'The Canopy', 'The Firmament', 'The Roof'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'In which play does a character consult the Oracle at Delphi?',
    options: ['The Winter\'s Tale', 'Pericles', 'Troilus and Cressida', 'Timon of Athens'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'Who published Shakespeare\'s sonnets in 1609?',
    options: ['Thomas Thorpe', 'Richard Field', 'William Jaggard', 'Edward Blount'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'In Henry V, what does the Dauphin send Henry as an insulting gift?',
    options: ['Tennis balls', 'A child\'s toy crown', 'A jester\'s cap', 'A wooden sword'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'Which of Shakespeare\'s plays has the famous "band of brothers" speech?',
    options: ['Henry V', 'Henry IV Part 1', 'Richard III', 'Julius Caesar'],
    correctIndex: 0, difficulty: 'hard',
  },
  {
    question: 'What is the term for the audience members who stood in the yard of the Globe Theatre?',
    options: ['Groundlings', 'Penny standers', 'The mob', 'Commoners'],
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
