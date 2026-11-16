import type { LanguagePack } from './index';

const pack: LanguagePack = {
  lang: 'en',
  acrostic: ['bard', 'moon', 'king', 'rose', 'fate', 'wit', 'play', 'star'],
  forbidden: ['s', 't', 'r', 'n', 'o', 'i'],
  relics: {
    'RL-001': ['skull', 'jest', 'grave', 'laugh', 'dust'],
    'RL-002': ['storm', 'spell', 'staff', 'island', 'drown'],
    'RL-003': ['dagger', 'blood', 'sleep', 'vision', 'hand'],
    'RL-004': ['ring', 'vow', 'night', 'banished', 'kiss'],
    'RL-005': ['gold', 'choice', 'mercy', 'lead', 'casket'],
    'RL-006': ['crown', 'throne', 'ambition', 'witch', 'king'],
    'RL-007': ['book', 'tempest', 'magic', 'page', 'drown'],
    'RL-008': ['tears', 'truth', 'daughter', 'nothing', 'heart'],
    'RL-009': ['mask', 'dream', 'fool', 'play', 'moon'],
  },
  written: {
    couplet: [
      'Thy rhymes are candles guttering in the night\nMine is the sun, and thou hast lost the light',
      'Step up, poor player, strut thy little hour\nThen watch thy verses wither like a flower',
      'I have heard braver thunder from a mouse\nA plague of silence fall upon thy house',
    ],
    'quatrain-aabb': [
      'Thou comest armed with borrowed, blunted wit\nAnd wonder why no blow of thine has hit\nI have faced kings and fools upon this stage\nThou art the footnote on a missing page',
      'The crowd came here to see a battle fought\nAnd all thy lines are leftovers, cheaply bought\nSo speak again, and louder, if thou dare\nI answer storms; thou art a breath of air',
    ],
    'quatrain-abab': [
      'I walked these boards before thy kind could crawl\nMy lines were law when thine were only noise\nNow hear the curtain and the candle fall\nThe stage has men enough; it wants no boys',
      'Thy verse limps in upon a single leg\nAnd begs the crowd to pity its poor sound\nI will not kick a man who comes to beg\nI simply leave him sitting on the ground',
    ],
    tercet: [
      'Thou hast a tongue, I grant, but not the art\nIt wanders like a drunkard in the dark\nAnd never once arrives at any heart',
      'Call that a verse? I call it a mistake\nA limping line that begs to be put down\nAnd I am kind enough, for mercy’s sake',
    ],
    anaphora: [
      'Never have I heard so much said of so little\nNever has a stage endured so thin a voice\nNever again, I think, will this crowd listen',
      'Speak, and the candles lean away from thee\nSpeak, and the groundlings count the exits\nSpeak, and I shall answer when it matters',
    ],
    crescendo: [
      'Thou art small\nThy verse is smaller still\nAnd I have crushed far greater things than thee before my breakfast',
      'Hear this\nThe stage is mine tonight\nAnd every word that leaves thy mouth is one more nail in thy defeat',
    ],
    epistrophe: [
      'Thou camest here to win, and found the stage\nThou spokest once, and lost the stage\nNow bow, and leave to me the stage',
      'I lent thee ears, and thou hast wasted time\nThy rhyme ran dry before its time\nNow all thou hast to lose is time',
    ],
    haiku: [
      'Thy verse falls like leaves\nNo one stoops to gather them\nThe wind takes them all',
      'A small voice, far off\nI turn my head to hear it\nIt was the wind, friend',
    ],
    'heroic-couplet': [
      'Thy verse is but a shadow on the wall\nMine is the fire that casts it, large and tall',
      'I came to trade in thunder and in flame\nAnd thou hast brought a candle to the game',
    ],
  },
  acrosticLines: {
    a: ['And still thou standest, waiting to be beaten', 'All thy lines are borrowed and returned unread'],
    b: ['Bold words, for one so easily undone', 'Bring thy best; I have not started yet'],
    d: ['Down goes thy verse, and no one marks the fall', 'Dare again, and louder, little voice'],
    e: ['Every line of thine has died upon the air', 'Enough: the crowd has made its mind up'],
    f: ['Fools rush to stages wiser men avoid', 'Fear not; this will be over very soon'],
    g: ['Go home, and tell them thou hast met thy better', 'Great talk, small verse: the old, old story'],
    i: ['I have heard better music from a hinge', 'In all my years I never met so weak a rhyme'],
    k: ['Kneel, for the verdict has been spoken', 'Kings have lost to me; what art thou?'],
    l: ['Let the record show thou hadst thy chance', 'Loud is not the same as good, my friend'],
    m: ['My worst line is the equal of thy best', 'Mark this well, for I shall not repeat it'],
    n: ['No crowd has ever sat so still for thee', 'Now hear how verses ought to sound'],
    o: ['Once more thou openest thy mouth in vain', 'Out, out, brief candle of a rhyme'],
    p: ['Poor player, strutting on a borrowed stage', 'Pray silence for a verse that earns it'],
    r: ['Rhyme is a blade, and thou hast brought a spoon', 'Run, while the exits are still open'],
    s: ['So ends the lesson; take it home with thee', 'Small wonder that the crowd has turned away'],
    t: ['Thy tongue is quick, but quickness is not wit', 'Tonight the stage remembers only me'],
    w: ['What was that sound? Ah, thy defeat', 'Words fail thee, as they always will'],
    y: ['Yield now, and keep what pride is left', 'Yet again thy line arrives too late'],
  },
};

export default pack;
