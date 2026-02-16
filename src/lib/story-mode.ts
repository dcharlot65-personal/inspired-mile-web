/**
 * Story Mode — PvE campaign with 5 Acts.
 * Each act has themed encounters against AI opponents.
 * Progress persists to localStorage + server sync.
 */

export interface Encounter {
  id: string;
  name: string;
  description: string;
  opponent: string; // card ID of the AI opponent
  difficulty: 'easy' | 'medium' | 'hard';
  narrative: string;
}

export interface Act {
  id: number;
  name: string;
  setting: string;
  description: string;
  encounters: Encounter[];
}

export interface StoryProgress {
  currentAct: number;
  completedEncounters: string[];
  totalStars: number; // 1-3 stars per encounter
}

const STORAGE_KEY = 'inspired-mile-story';

export const ACTS: Act[] = [
  {
    id: 1,
    name: 'The Streets of Verona',
    setting: 'Verona',
    description: 'Begin your journey in the sun-drenched streets where Montagues and Capulets clash.',
    encounters: [
      { id: '1-1', name: 'Street Brawl', description: 'A Capulet servant challenges you.', opponent: 'CA-002', difficulty: 'easy', narrative: 'The morning air is thick with tension. A Capulet servant blocks your path, hand on his sword hilt. "Do you bite your thumb at me, sir?"' },
      { id: '1-2', name: 'The Nurse\'s Riddle', description: 'Answer the Nurse\'s wordplay challenge.', opponent: 'VC-003', difficulty: 'easy', narrative: 'The Nurse waddles toward you, chuckling. "Young one, if you seek Romeo, you must first prove your wit is sharp enough for Verona\'s courts."' },
      { id: '1-3', name: 'Mercutio\'s Challenge', description: 'Face the silver-tongued Mercutio.', opponent: 'MO-002', difficulty: 'medium', narrative: '"A plague on both your houses!" Mercutio cries, but his eyes sparkle. "Come, match me word for word, and I shall tell you of Queen Mab."' },
      { id: '1-4', name: 'The Prince\'s Judgment', description: 'Prove your worth before Prince Escalus.', opponent: 'VC-001', difficulty: 'medium', narrative: 'Prince Escalus summons you to the palace. "Too many have died in these streets. Show me you wield words, not swords, and I will grant you passage."' },
    ],
  },
  {
    id: 2,
    name: 'The Halls of Elsinore',
    setting: 'Denmark',
    description: 'Something is rotten in the state of Denmark. Unravel the court\'s dark secrets.',
    encounters: [
      { id: '2-1', name: 'The Ghost\'s Warning', description: 'Decipher the ghost\'s cryptic verse.', opponent: 'DC-003', difficulty: 'medium', narrative: 'On the battlements at midnight, a spectral figure appears. King Claudius\'s ghost — or is it? The spirit speaks in riddles that only a true wordsmith can untangle.' },
      { id: '2-2', name: 'Ophelia\'s Garden', description: 'A poetic duel among the flowers.', opponent: 'DC-002', difficulty: 'easy', narrative: 'In the castle garden, Ophelia weaves flower crowns and speaks in the language of blooms. "There\'s rosemary, that\'s for remembrance. Can you read my floral verses?"' },
      { id: '2-3', name: 'The Mousetrap', description: 'Outsmart the cunning King Claudius.', opponent: 'DC-003', difficulty: 'hard', narrative: '"The play\'s the thing wherein I\'ll catch the conscience of the king." You must perform a verse so piercing that truth itself takes the stage.' },
      { id: '2-4', name: 'Hamlet\'s Soliloquy', description: 'Face the prince himself in a battle of words.', opponent: 'DC-001', difficulty: 'hard', narrative: 'In the great hall, Hamlet paces. "To be, or not to be..." He turns to you. "But what is YOUR answer, stranger? Speak, and let the cosmos judge."' },
    ],
  },
  {
    id: 3,
    name: 'The Enchanted Forest',
    setting: 'Forest of Arden',
    description: 'Wander through a magical wood where fairies play and mortals dream.',
    encounters: [
      { id: '3-1', name: 'Puck\'s Pranks', description: 'Outwit the mischievous sprite.', opponent: 'FA-001', difficulty: 'easy', narrative: '"Lord, what fools these mortals be!" Puck somersaults from a mushroom ring. "Catch me in a verse, mortal, and I\'ll lead you to the fairy queen."' },
      { id: '3-2', name: 'Bottom\'s Dream', description: 'Navigate a dreamer\'s riddle.', opponent: 'FA-004', difficulty: 'medium', narrative: 'Bottom stumbles through the trees, half-man, half-donkey, entirely confused. "I have had a most rare vision! Help me speak it, and I shall share the queen\'s favor."' },
      { id: '3-3', name: 'Titania\'s Court', description: 'Perform before the fairy queen.', opponent: 'FA-002', difficulty: 'medium', narrative: 'The fairy queen reclines on a bed of moonflowers. "Mortal, your kind amuse me. Weave words that shimmer like starlight, and I shall grant you a boon."' },
      { id: '3-4', name: 'Oberon\'s Trial', description: 'Face the fairy king\'s judgment.', opponent: 'FA-003', difficulty: 'hard', narrative: 'Oberon materializes from shadow. "You have danced through my domain uninvited. Only mastery of language earns safe passage. Begin."' },
    ],
  },
  {
    id: 4,
    name: 'Tempest Island',
    setting: 'The Tempest',
    description: 'Shipwrecked on a mysterious island ruled by a powerful sorcerer.',
    encounters: [
      { id: '4-1', name: 'Caliban\'s Rage', description: 'Survive Caliban\'s fury.', opponent: 'TP-003', difficulty: 'medium', narrative: '"This island\'s mine!" Caliban howls from his cave. "You taught me language, and my profit on\'t is, I know how to curse. Let us see whose curses ring truer."' },
      { id: '4-2', name: 'Ariel\'s Song', description: 'Match the spirit\'s ethereal verse.', opponent: 'TP-002', difficulty: 'medium', narrative: 'Ariel floats on the wind, singing of coral bones and sea-changes. "Full fathom five... Can you sing of depths I have not seen, mortal?"' },
      { id: '4-3', name: 'Miranda\'s Wonder', description: 'Impress Prospero\'s daughter.', opponent: 'TP-004', difficulty: 'easy', narrative: '"O brave new world, that has such people in\'t!" Miranda gasps at the sight of you. "Tell me of the world beyond these shores in verse."' },
      { id: '4-4', name: 'Prospero\'s Final Test', description: 'Face the sorcerer-king himself.', opponent: 'TP-001', difficulty: 'hard', narrative: 'Prospero stands at the island\'s peak, staff raised. "Every third thought shall be my grave. But first — show me that language itself is magic enough."' },
    ],
  },
  {
    id: 5,
    name: 'The Globe Theatre',
    setting: 'London',
    description: 'The final act. Face Shakespeare\'s greatest characters on the world\'s stage.',
    encounters: [
      { id: '5-1', name: 'The Scottish King', description: 'Face the bloody Macbeth.', opponent: 'SC-001', difficulty: 'hard', narrative: 'The stage is set for tragedy. Macbeth stands bloodied, crown askew. "Tomorrow, and tomorrow, and tomorrow..." Can you match the weight of his despair?' },
      { id: '5-2', name: 'Rome\'s Betrayal', description: 'Debate with Brutus himself.', opponent: 'RM-001', difficulty: 'hard', narrative: '"Not that I loved Caesar less, but that I loved Rome more." Brutus turns to you from the Senate steps. "Convince me, stranger, that words can mend what daggers broke."' },
      { id: '5-3', name: 'The Final Bow', description: 'Face The Sonnet Man in the ultimate battle.', opponent: 'SM-001', difficulty: 'hard', narrative: 'The Globe Theatre falls silent. A single spotlight illuminates The Sonnet Man himself. "All the world\'s a stage. You have played your part well. Now — one last verse, and the curtain falls."' },
    ],
  },
];

function defaultProgress(): StoryProgress {
  return { currentAct: 1, completedEncounters: [], totalStars: 0 };
}

export function getStoryProgress(): StoryProgress {
  if (typeof window === 'undefined') return defaultProgress();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();
    return { ...defaultProgress(), ...JSON.parse(raw) };
  } catch {
    return defaultProgress();
  }
}

function saveStoryProgress(progress: StoryProgress): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch { /* quota */ }
}

/** Mark an encounter as completed */
export function completeEncounter(encounterId: string, stars: number): StoryProgress {
  const progress = getStoryProgress();
  if (!progress.completedEncounters.includes(encounterId)) {
    progress.completedEncounters.push(encounterId);
    progress.totalStars += Math.min(3, Math.max(1, stars));
  }

  // Check if current act is complete and advance
  const currentAct = ACTS.find(a => a.id === progress.currentAct);
  if (currentAct) {
    const allDone = currentAct.encounters.every(e =>
      progress.completedEncounters.includes(e.id)
    );
    if (allDone && progress.currentAct < ACTS.length) {
      progress.currentAct += 1;
    }
  }

  saveStoryProgress(progress);
  return progress;
}

/** Check if an encounter is unlocked (all previous encounters in the act must be completed) */
export function isEncounterUnlocked(encounterId: string): boolean {
  const progress = getStoryProgress();

  for (const act of ACTS) {
    if (act.id > progress.currentAct) return false;
    for (const encounter of act.encounters) {
      if (encounter.id === encounterId) return true;
      if (act.id === progress.currentAct && !progress.completedEncounters.includes(encounter.id)) {
        return false;
      }
    }
  }
  return false;
}

/** Get total encounter count */
export function getTotalEncounters(): number {
  return ACTS.reduce((sum, act) => sum + act.encounters.length, 0);
}
