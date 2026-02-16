/**
 * Quote Completion Challenges — Fill in the missing words.
 * V2: Expanded to 104 challenges across easy/medium/hard.
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

  // ========================================
  // EASY — Expansion (16 new)
  // ========================================
  {
    fullQuote: 'We know what we are, but know not what we may be.',
    displayQuote: 'We know what we ___, but know not what we may ___.',
    missingWords: ['are', 'be'],
    play: 'Hamlet', character: 'Ophelia', difficulty: 'easy',
  },
  {
    fullQuote: 'Frailty, thy name is woman!',
    displayQuote: 'Frailty, thy name is ___!',
    missingWords: ['woman'],
    play: 'Hamlet', character: 'Hamlet', difficulty: 'easy',
  },
  {
    fullQuote: 'Off with his head!',
    displayQuote: 'Off with his ___!',
    missingWords: ['head'],
    play: 'Richard III', character: 'Richard III', difficulty: 'easy',
  },
  {
    fullQuote: 'Once more unto the breach, dear friends, once more.',
    displayQuote: 'Once more unto the ___, dear friends, once more.',
    missingWords: ['breach'],
    play: 'Henry V', character: 'King Henry', difficulty: 'easy',
  },
  {
    fullQuote: 'But soft, what light through yonder window breaks?',
    displayQuote: 'But soft, what ___ through yonder window breaks?',
    missingWords: ['light'],
    play: 'Romeo and Juliet', character: 'Romeo', difficulty: 'easy',
  },
  {
    fullQuote: 'Cry havoc, and let slip the dogs of war!',
    displayQuote: 'Cry ___, and let slip the dogs of ___!',
    missingWords: ['havoc', 'war'],
    play: 'Julius Caesar', character: 'Mark Antony', difficulty: 'easy',
  },
  {
    fullQuote: 'Love all, trust a few, do wrong to none.',
    displayQuote: '___ all, trust a few, do wrong to ___.',
    missingWords: ['love', 'none'],
    play: 'All\'s Well That Ends Well', character: 'Countess', difficulty: 'easy',
  },
  {
    fullQuote: 'Beware the ides of March.',
    displayQuote: 'Beware the ___ of March.',
    missingWords: ['ides'],
    play: 'Julius Caesar', character: 'Soothsayer', difficulty: 'easy',
  },
  {
    fullQuote: 'I come to bury Caesar, not to praise him.',
    displayQuote: 'I come to ___ Caesar, not to ___ him.',
    missingWords: ['bury', 'praise'],
    play: 'Julius Caesar', character: 'Mark Antony', difficulty: 'easy',
  },
  {
    fullQuote: 'Give me my robe, put on my crown.',
    displayQuote: 'Give me my ___, put on my ___.',
    missingWords: ['robe', 'crown'],
    play: 'Antony and Cleopatra', character: 'Cleopatra', difficulty: 'easy',
  },
  {
    fullQuote: 'This was the noblest Roman of them all.',
    displayQuote: 'This was the ___ Roman of them all.',
    missingWords: ['noblest'],
    play: 'Julius Caesar', character: 'Mark Antony', difficulty: 'easy',
  },
  {
    fullQuote: 'Something is rotten in the state of Denmark.',
    displayQuote: 'Something is ___ in the state of ___.',
    missingWords: ['rotten', 'Denmark'],
    play: 'Hamlet', character: 'Marcellus', difficulty: 'easy',
  },
  {
    fullQuote: 'Sweets to the sweet.',
    displayQuote: '___ to the ___.',
    missingWords: ['sweets', 'sweet'],
    play: 'Hamlet', character: 'Gertrude', difficulty: 'easy',
  },
  {
    fullQuote: 'If you prick us, do we not bleed?',
    displayQuote: 'If you ___ us, do we not ___?',
    missingWords: ['prick', 'bleed'],
    play: 'The Merchant of Venice', character: 'Shylock', difficulty: 'easy',
  },
  {
    fullQuote: 'My kingdom for a horse!',
    displayQuote: 'My ___ for a ___!',
    missingWords: ['kingdom', 'horse'],
    play: 'Richard III', character: 'Richard III', difficulty: 'easy',
  },
  {
    fullQuote: 'There are more things in heaven and earth, Horatio, than are dreamt of in your philosophy.',
    displayQuote: 'There are more things in heaven and ___, Horatio, than are dreamt of in your ___.',
    missingWords: ['earth', 'philosophy'],
    play: 'Hamlet', character: 'Hamlet', difficulty: 'easy',
  },

  // ========================================
  // MEDIUM — Expansion (22 new)
  // ========================================
  {
    fullQuote: 'When we are born, we cry that we are come to this great stage of fools.',
    displayQuote: 'When we are born, we ___ that we are come to this great stage of ___.',
    missingWords: ['cry', 'fools'],
    play: 'King Lear', character: 'Lear', difficulty: 'medium',
  },
  {
    fullQuote: 'I will wear my heart upon my sleeve for daws to peck at.',
    displayQuote: 'I will wear my ___ upon my ___ for daws to peck at.',
    missingWords: ['heart', 'sleeve'],
    play: 'Othello', character: 'Iago', difficulty: 'medium',
  },
  {
    fullQuote: 'We few, we happy few, we band of brothers.',
    displayQuote: 'We ___, we happy few, we band of ___.',
    missingWords: ['few', 'brothers'],
    play: 'Henry V', character: 'King Henry', difficulty: 'medium',
  },
  {
    fullQuote: 'I am a man more sinned against than sinning.',
    displayQuote: 'I am a man more ___ against than ___.',
    missingWords: ['sinned', 'sinning'],
    play: 'King Lear', character: 'Lear', difficulty: 'medium',
  },
  {
    fullQuote: 'Who ever loved that loved not at first sight?',
    displayQuote: 'Who ever ___ that loved not at first ___?',
    missingWords: ['loved', 'sight'],
    play: 'As You Like It', character: 'Phoebe', difficulty: 'medium',
  },
  {
    fullQuote: 'What a piece of work is a man! How noble in reason! How infinite in faculty!',
    displayQuote: 'What a piece of work is a ___! How noble in ___! How infinite in faculty!',
    missingWords: ['man', 'reason'],
    play: 'Hamlet', character: 'Hamlet', difficulty: 'medium',
  },
  {
    fullQuote: 'The robbed that smiles steals something from the thief.',
    displayQuote: 'The robbed that ___ steals something from the ___.',
    missingWords: ['smiles', 'thief'],
    play: 'Othello', character: 'Duke of Venice', difficulty: 'medium',
  },
  {
    fullQuote: 'I wasted time, and now doth time waste me.',
    displayQuote: 'I wasted ___, and now doth time ___ me.',
    missingWords: ['time', 'waste'],
    play: 'Richard II', character: 'Richard II', difficulty: 'medium',
  },
  {
    fullQuote: 'Sigh no more, ladies, sigh no more, men were deceivers ever.',
    displayQuote: 'Sigh no more, ladies, sigh no more, men were ___ ever.',
    missingWords: ['deceivers'],
    play: 'Much Ado About Nothing', character: 'Balthasar', difficulty: 'medium',
  },
  {
    fullQuote: 'I pray you, do not fall in love with me, for I am falser than vows made in wine.',
    displayQuote: 'I pray you, do not fall in love with me, for I am ___ than vows made in ___.',
    missingWords: ['falser', 'wine'],
    play: 'As You Like It', character: 'Rosalind', difficulty: 'medium',
  },
  {
    fullQuote: 'Misery acquaints a man with strange bedfellows.',
    displayQuote: '___ acquaints a man with strange ___.',
    missingWords: ['misery', 'bedfellows'],
    play: 'The Tempest', character: 'Trinculo', difficulty: 'medium',
  },
  {
    fullQuote: 'Men at some time are masters of their fates.',
    displayQuote: 'Men at some time are ___ of their ___.',
    missingWords: ['masters', 'fates'],
    play: 'Julius Caesar', character: 'Cassius', difficulty: 'medium',
  },
  {
    fullQuote: 'The fool doth think he is wise, but the wise man knows himself to be a fool.',
    displayQuote: 'The ___ doth think he is wise, but the wise man knows himself to be a ___.',
    missingWords: ['fool', 'fool'],
    play: 'As You Like It', character: 'Touchstone', difficulty: 'medium',
  },
  {
    fullQuote: 'Blow, blow, thou winter wind, thou art not so unkind as man\'s ingratitude.',
    displayQuote: 'Blow, blow, thou winter ___, thou art not so ___ as man\'s ingratitude.',
    missingWords: ['wind', 'unkind'],
    play: 'As You Like It', character: 'Amiens', difficulty: 'medium',
  },
  {
    fullQuote: 'Have more than thou showest, speak less than thou knowest.',
    displayQuote: 'Have more than thou ___, speak less than thou ___.',
    missingWords: ['showest', 'knowest'],
    play: 'King Lear', character: 'Fool', difficulty: 'medium',
  },
  {
    fullQuote: 'I must be cruel only to be kind.',
    displayQuote: 'I must be ___ only to be ___.',
    missingWords: ['cruel', 'kind'],
    play: 'Hamlet', character: 'Hamlet', difficulty: 'medium',
  },
  {
    fullQuote: 'Nothing will come of nothing.',
    displayQuote: '___ will come of ___.',
    missingWords: ['nothing', 'nothing'],
    play: 'King Lear', character: 'Lear', difficulty: 'medium',
  },
  {
    fullQuote: 'The first thing we do, let\'s kill all the lawyers.',
    displayQuote: 'The first thing we do, let\'s ___ all the ___.',
    missingWords: ['kill', 'lawyers'],
    play: 'Henry VI, Part 2', character: 'Dick the Butcher', difficulty: 'medium',
  },
  {
    fullQuote: 'Some rise by sin, and some by virtue fall.',
    displayQuote: 'Some rise by ___, and some by ___ fall.',
    missingWords: ['sin', 'virtue'],
    play: 'Measure for Measure', character: 'Escalus', difficulty: 'medium',
  },
  {
    fullQuote: 'Our doubts are traitors, and make us lose the good we oft might win by fearing to attempt.',
    displayQuote: 'Our ___ are traitors, and make us lose the good we oft might win by fearing to ___.',
    missingWords: ['doubts', 'attempt'],
    play: 'Measure for Measure', character: 'Lucio', difficulty: 'medium',
  },
  {
    fullQuote: 'They say best men are moulded out of faults.',
    displayQuote: 'They say best men are ___ out of ___.',
    missingWords: ['moulded', 'faults'],
    play: 'Measure for Measure', character: 'Mariana', difficulty: 'medium',
  },
  {
    fullQuote: 'Wisely and slow; they stumble that run fast.',
    displayQuote: 'Wisely and ___; they stumble that run ___.',
    missingWords: ['slow', 'fast'],
    play: 'Romeo and Juliet', character: 'Friar Lawrence', difficulty: 'medium',
  },

  // ========================================
  // HARD — Expansion (24 new)
  // ========================================
  {
    fullQuote: 'Put out the light, and then put out the light.',
    displayQuote: 'Put out the ___, and then put out the ___.',
    missingWords: ['light', 'light'],
    play: 'Othello', character: 'Othello', difficulty: 'hard',
  },
  {
    fullQuote: 'It is a tale told by an idiot, full of sound and fury, signifying nothing.',
    displayQuote: 'It is a tale told by an ___, full of sound and ___, signifying nothing.',
    missingWords: ['idiot', 'fury'],
    play: 'Macbeth', character: 'Macbeth', difficulty: 'hard',
  },
  {
    fullQuote: 'Reputation is an idle and most false imposition; oft got without merit, and lost without deserving.',
    displayQuote: '___ is an idle and most false imposition; oft got without ___, and lost without deserving.',
    missingWords: ['reputation', 'merit'],
    play: 'Othello', character: 'Iago', difficulty: 'hard',
  },
  {
    fullQuote: 'O, what a rogue and peasant slave am I!',
    displayQuote: 'O, what a ___ and ___ slave am I!',
    missingWords: ['rogue', 'peasant'],
    play: 'Hamlet', character: 'Hamlet', difficulty: 'hard',
  },
  {
    fullQuote: 'The rest is silence.',
    displayQuote: 'The ___ is ___.',
    missingWords: ['rest', 'silence'],
    play: 'Hamlet', character: 'Hamlet', difficulty: 'hard',
  },
  {
    fullQuote: 'As flies to wanton boys are we to the gods; they kill us for their sport.',
    displayQuote: 'As ___ to wanton boys are we to the gods; they kill us for their ___.',
    missingWords: ['flies', 'sport'],
    play: 'King Lear', character: 'Gloucester', difficulty: 'hard',
  },
  {
    fullQuote: 'My salad days, when I was green in judgment.',
    displayQuote: 'My ___ days, when I was green in ___.',
    missingWords: ['salad', 'judgment'],
    play: 'Antony and Cleopatra', character: 'Cleopatra', difficulty: 'hard',
  },
  {
    fullQuote: 'I cannot tell what the dickens his name is.',
    displayQuote: 'I cannot tell what the ___ his name is.',
    missingWords: ['dickens'],
    play: 'The Merry Wives of Windsor', character: 'Mistress Page', difficulty: 'hard',
  },
  {
    fullQuote: 'They do not love that do not show their love.',
    displayQuote: 'They do not ___ that do not ___ their love.',
    missingWords: ['love', 'show'],
    play: 'The Two Gentlemen of Verona', character: 'Julia', difficulty: 'hard',
  },
  {
    fullQuote: 'I dare do all that may become a man; who dares do more is none.',
    displayQuote: 'I dare do all that may ___ a man; who dares do more is ___.',
    missingWords: ['become', 'none'],
    play: 'Macbeth', character: 'Macbeth', difficulty: 'hard',
  },
  {
    fullQuote: 'Age cannot wither her, nor custom stale her infinite variety.',
    displayQuote: 'Age cannot ___ her, nor custom ___ her infinite variety.',
    missingWords: ['wither', 'stale'],
    play: 'Antony and Cleopatra', character: 'Enobarbus', difficulty: 'hard',
  },
  {
    fullQuote: 'My tongue will tell the anger of my heart, or else my heart concealing it will break.',
    displayQuote: 'My tongue will tell the ___ of my heart, or else my heart ___ it will break.',
    missingWords: ['anger', 'concealing'],
    play: 'The Taming of the Shrew', character: 'Katharina', difficulty: 'hard',
  },
  {
    fullQuote: 'No legacy is so rich as honesty.',
    displayQuote: 'No ___ is so rich as ___.',
    missingWords: ['legacy', 'honesty'],
    play: 'All\'s Well That Ends Well', character: 'Mariana', difficulty: 'hard',
  },
  {
    fullQuote: 'This blessed plot, this earth, this realm, this England.',
    displayQuote: 'This blessed ___, this earth, this ___, this England.',
    missingWords: ['plot', 'realm'],
    play: 'Richard II', character: 'John of Gaunt', difficulty: 'hard',
  },
  {
    fullQuote: 'Come what come may, time and the hour runs through the roughest day.',
    displayQuote: 'Come what come may, ___ and the hour runs through the ___ day.',
    missingWords: ['time', 'roughest'],
    play: 'Macbeth', character: 'Macbeth', difficulty: 'hard',
  },
  {
    fullQuote: 'Speak low, if you speak love.',
    displayQuote: 'Speak ___, if you speak ___.',
    missingWords: ['low', 'love'],
    play: 'Much Ado About Nothing', character: 'Don Pedro', difficulty: 'hard',
  },
  {
    fullQuote: 'Thou know\'st the mask of night is on my face, else would a maiden blush bepaint my cheek.',
    displayQuote: 'Thou know\'st the mask of ___ is on my face, else would a maiden ___ bepaint my cheek.',
    missingWords: ['night', 'blush'],
    play: 'Romeo and Juliet', character: 'Juliet', difficulty: 'hard',
  },
  {
    fullQuote: 'For I am nothing if not critical.',
    displayQuote: 'For I am ___ if not ___.',
    missingWords: ['nothing', 'critical'],
    play: 'Othello', character: 'Iago', difficulty: 'hard',
  },
  {
    fullQuote: 'Exit, pursued by a bear.',
    displayQuote: 'Exit, ___ by a ___.',
    missingWords: ['pursued', 'bear'],
    play: 'The Winter\'s Tale', character: 'Stage Direction', difficulty: 'hard',
  },
  {
    fullQuote: 'O, she doth teach the torches to burn bright!',
    displayQuote: 'O, she doth teach the ___ to burn ___!',
    missingWords: ['torches', 'bright'],
    play: 'Romeo and Juliet', character: 'Romeo', difficulty: 'hard',
  },
  {
    fullQuote: 'The wheel is come full circle; I am here.',
    displayQuote: 'The ___ is come full ___; I am here.',
    missingWords: ['wheel', 'circle'],
    play: 'King Lear', character: 'Edmund', difficulty: 'hard',
  },
  {
    fullQuote: 'I had rather have a fool to make me merry than experience to make me sad.',
    displayQuote: 'I had rather have a ___ to make me merry than ___ to make me sad.',
    missingWords: ['fool', 'experience'],
    play: 'As You Like It', character: 'Rosalind', difficulty: 'hard',
  },
  {
    fullQuote: 'A light heart lives long.',
    displayQuote: 'A light ___ lives ___.',
    missingWords: ['heart', 'long'],
    play: 'Love\'s Labour\'s Lost', character: 'Katharine', difficulty: 'hard',
  },
  {
    fullQuote: 'What is past is prologue.',
    displayQuote: 'What is past is ___.',
    missingWords: ['prologue'],
    play: 'The Tempest', character: 'Antonio', difficulty: 'hard',
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
