/**
 * The playground page, in English: the reference for this area. Every other
 * language's file has exactly these keys and the same {placeholders}
 * (src/i18n/pages/play-areas.test.ts checks it).
 *
 * Also here, because the playground is where they are shown: the daily streak's
 * pack names (src/lib/streaks.ts) and the weekly events (src/lib/weekly-events.ts).
 */
const messages: Record<string, string> = {
  'pg.meta.title': 'Playground',
  'pg.meta.description': 'Earn digital cards through mini-games, trivia, challenges, and more. Build your Shakespeare collection.',
  'pg.badge': 'Digital Playground',
  'pg.title': 'The Playground',
  'pg.intro': 'Earn digital cards through mini-games, trivia, and challenges. Every card you win is yours to keep, collect, and trade.',
  'pg.stat.cards': 'Cards Owned',
  'pg.stat.wins': 'Battle Wins',
  'pg.stat.trivia': 'Trivia Score',
  'pg.viewCollection': 'View Collection',
  'pg.spending': 'Daily spending:',
  'pg.credits': 'credits',

  'pg.packs.title': 'Card Packs',
  'pg.packs.sub': 'Open packs to reveal cards',
  'pg.starter.name': 'Starter Pack',
  'pg.starter.desc': '3 cards to begin your collection',
  'pg.daily.name': 'Daily Pack',
  'pg.daily.desc': '1 free card every 24 hours',
  'pg.free': 'FREE',
  'pg.claimed': 'CLAIMED',

  'pg.odds.title': 'Card Pack Drop Rates',
  'pg.odds.rarity': 'Rarity Drop Rates',
  'pg.odds.tiers': 'Pack Tiers (purchased with Credits)',
  'pg.odds.standard': 'Standard Pack',
  'pg.odds.standardLine': '3 cards · 50 Credits',
  'pg.odds.standardNote': 'Standard odds',
  'pg.odds.rare': 'Rare Pack',
  'pg.odds.rareLine': '5 cards · 150 Credits',
  'pg.odds.rareNote': '1 Rare guaranteed',
  'pg.odds.epic': 'Epic Pack',
  'pg.odds.epicLine': '5 cards · 400 Credits',
  'pg.odds.epicNote': '1 Epic guaranteed',
  'pg.odds.note': 'All packs use Credits earned through gameplay. No real money purchases. Each card draw is independent.',
  'pg.odds.moreBefore': 'For more details, see our',
  'pg.odds.moreAfter': '.',

  'pg.battle.sub': 'Win rap battles to earn cards',
  'pg.battle.body': 'Challenge the Master Thespian in a Shakespeare rap battle. Win a round and earn a random card from the collection.',
  'pg.battle.cta': 'Enter the Arena',

  'pg.trivia.title': 'Shakespeare Trivia',
  'pg.trivia.sub': 'Test your knowledge, earn cards',
  'pg.trivia.body': 'Answer 5 questions about Shakespeare. Score 3 or more to earn a card.',
  'pg.trivia.start': 'Start Trivia',
  'pg.trivia.progress': 'Question {n} / {total}',
  'pg.trivia.correct': '{n} correct',
  'pg.trivia.complete': 'Complete!',
  'pg.trivia.generating': 'Generating questions...',
  'pg.trivia.aiBadge': 'AI Generated',
  'pg.trivia.won': 'You scored {n} / {total}!',
  'pg.trivia.lost': 'You scored {n} / {total}',
  'pg.trivia.need': 'You need at least 3 correct to earn a card. Try again!',
  'pg.worldCard': 'World Card Unlocked! {city}: +{bonus} {axis}',

  'pg.challenge.title': 'Quote Challenge',
  'pg.challenge.sub': 'Complete the famous quote',
  'pg.challenge.body': 'Fill in the missing words from a Shakespeare quote. Get it right, earn a card.',
  'pg.challenge.start': 'Start Challenge',
  'pg.challenge.crafting': 'Crafting challenge...',
  'pg.challenge.blank': 'Blank {n}:',
  'pg.challenge.placeholder': 'Missing word...',
  'pg.challenge.check': 'Check Answer',
  'pg.challenge.hint': 'Hint: Think about the original Shakespeare quote',
  'pg.challenge.full': 'The full quote:',
  'pg.challenge.correct': 'Correct! You earned a card:',
  'pg.challenge.wrong': 'Not quite!',
  'pg.challenge.answer': 'The answer was:',
  'pg.challenge.later': 'Try Again Later',
  'pg.challenge.original': "In Shakespeare's original English",
  'pg.challenge.translator': 'Translation: {translator}',

  'pg.difficulty.easy': 'easy',
  'pg.difficulty.medium': 'medium',
  'pg.difficulty.hard': 'hard',

  'pg.earned': 'You earned a card:',
  'pg.collect': 'Collect',
  'pg.close': 'Close',
  'pg.reveal.title': 'Card Revealed!',
  'pg.reveal.starter': 'Starter Pack!',
  'pg.reveal.daily': 'Daily Card!',

  'pg.onb.skip': 'Skip',
  'pg.onb.next': 'Next',
  'pg.onb.done': 'Got it!',
  'pg.onb.1.title': 'Claim Your Starter Pack',
  'pg.onb.1.desc': 'Start here! Open your free starter pack to get your first 3 cards.',
  'pg.onb.2.title': 'Test Your Knowledge',
  'pg.onb.2.desc': 'Play trivia and quote challenges to earn more cards for your collection.',
  'pg.onb.3.title': 'Enter the Battle Arena',
  'pg.onb.3.desc': 'Challenge the AI Master Thespian to a Shakespeare rap battle. Win rounds, win cards!',

  // --- Daily streak (src/lib/streaks.ts) ---
  'streak.pack.common': 'Common Pack',
  'streak.pack.uncommon': 'Uncommon Pack',
  'streak.pack.rare': 'Rare Pack',
  'streak.pack.epic': 'Epic Reward Pack',
  'streak.available': 'Available now!',
  'countdown.hm': '{h}h {m}m',
  'countdown.m': '{m}m',

  // --- Weekly events (src/lib/weekly-events.ts) ---
  'event.now': 'Now!',
  'event.trivia-tuesday.name': 'Trivia Tuesday',
  'event.trivia-tuesday.desc': '2x XP from trivia questions today!',
  'event.world-wednesday.name': 'World Wednesday',
  'event.world-wednesday.desc': 'Free city variant attempt today!',
  'event.challenge-thursday.name': 'Challenge Thursday',
  'event.challenge-thursday.desc': 'Bonus quote challenges available today!',
  'event.battle-weekend.name': 'Battle Weekend',
  'event.battle-weekend.desc': '2x XP from battles this weekend!',
};

export default messages;
