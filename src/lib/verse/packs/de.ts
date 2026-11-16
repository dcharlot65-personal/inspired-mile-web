import type { LanguagePack } from './index';

// German.
const pack: LanguagePack = {
  lang: 'de',
  acrostic: ['mond', 'rose', 'wort', 'mut', 'tod', 'held', 'narr'],
  forbidden: ['s', 't', 'r', 'i', 'a', 'h'],
  relics: {
    'RL-001': ['Schädel', 'Scherz', 'Grab', 'Lachen', 'Staub'],
    'RL-002': ['Sturm', 'Zauber', 'Stab', 'Insel', 'ertrinken'],
    'RL-003': ['Dolch', 'Blut', 'Schlaf', 'Trugbild', 'Hand'],
    'RL-004': ['Ring', 'Schwur', 'Nacht', 'verbannt', 'Kuss'],
    'RL-005': ['Gold', 'Wahl', 'Gnade', 'Blei', 'Kästchen'],
    'RL-006': ['Krone', 'Thron', 'Ehrgeiz', 'Hexe', 'König'],
    'RL-007': ['Buch', 'Sturm', 'Magie', 'Seite', 'ertrinken'],
    'RL-008': ['Tränen', 'Wahrheit', 'Tochter', 'nichts', 'Herz'],
    'RL-009': ['Maske', 'Traum', 'Narr', 'Spiel', 'Mond'],
  },
  written: {
    couplet: [
      'Dein Reim ist eine Kerze in der Nacht\nMeiner die Sonne, die dich blind gemacht',
      'Tritt vor, armer Spieler, stolziere deine Zeit\nDann welkt dein Vers, und keinem tut es leid',
    ],
    'quatrain-aabb': [
      'Du kommst bewaffnet mit geborgtem Witz\nUnd nennst dein müdes Flackern einen Blitz\nIch sah schon Könige und Narren hier\nDu bist die Fußnote auf leerem Papier',
      'Das Volk kam her, um einen Kampf zu sehn\nUnd deine Verse bleiben kläglich stehn\nSo sprich noch einmal, lauter, wenn du’s wagst\nIch stehe noch, wenn du schon lang verzagst',
    ],
    'quatrain-abab': [
      'Ich stand auf dieser Bühne, eh du krochst\nMein Vers war Recht, als deiner Lärm nur war\nHör, wie der Vorhang fällt, an den du pochst\nDie Bühne braucht kein Kind, das ist doch klar',
      'Dein Vers hinkt auf nur einem Bein herein\nUnd bettelt um ein wenig Mitleid hier\nIch trete keinen Bettler, das muss sein\nIch lass ihn einfach sitzen neben mir',
    ],
    tercet: [
      'Du hast eine Zunge, gut, doch nicht die Kunst\nSie torkelt wie ein Trunkener durchs Dunkel\nUnd findet nie ein Herz, nur blauen Dunst',
      'Das nennst du einen Vers? Ich nenn es Not\nEin lahmes Ding, das um sein Ende fleht\nIch bin so gnädig und erklär es tot',
    ],
    anaphora: [
      'Nie hörte ich so viel über so wenig\nNie trug eine Bühne eine so dünne Stimme\nNie wieder, fürchte ich, hört dir dieses Haus zu',
      'Sprich, und die Kerzen neigen sich von dir weg\nSprich, und das Parkett zählt die Ausgänge\nSprich, und ich antworte, wenn es sich lohnt',
    ],
    crescendo: [
      'Du bist klein\nDein Vers ist noch kleiner\nUnd ich habe vor dem Frühstück schon weit Größeres zermalmt als dich',
      'Hör zu\nHeute Nacht gehört die Bühne mir\nUnd jedes Wort aus deinem Mund ist ein weiterer Nagel in deiner Niederlage',
    ],
    epistrophe: [
      'Du kamst, um zu siegen, und fandst die Bühne\nDu sprachst ein einziges Mal und verlorst die Bühne\nNun verbeug dich und überlass mir die Bühne',
      'Ich lieh dir mein Ohr, du stahlst mir die Zeit\nDein Reim versiegte vor der Zeit\nNun bleibt dir nichts zu verlieren als Zeit',
    ],
    haiku: [
      'Dein Vers fällt wie Laub\nNiemand bückt sich je danach\nDer Wind nimmt es mit',
      'Eine Stimme, fern\nIch dreh den Kopf und horche\nEs war nur der Wind',
    ],
    'heroic-couplet': [
      'Dein Vers ist nur ein Schatten an der Wand\nMeiner das Feuer, hell in meiner Hand',
      'Ich kam, um Blitz und Donner feilzubieten\nUnd du hast nur ein Lichtlein anzubieten',
    ],
  },
  acrosticLines: {
    m: ['Mein schlechtester Vers wiegt deinen besten auf', 'Merk dir das gut, ich sag es nur einmal'],
    o: ['Oh, schon wieder öffnest du vergeblich den Mund', 'Ohne Witz bleibt jeder Reim nur Lärm'],
    n: ['Nie saß ein Saal so still für dich', 'Nun hör, wie Verse klingen sollen'],
    d: ['Dein Vers geht unter, und keiner merkt den Fall', 'Du redest viel und sagst so wenig'],
    r: ['Reimen ist Fechten, und du bringst einen Löffel', 'Renn, solange die Türen offen stehen'],
    s: ['So endet die Lektion; nimm sie mit nach Haus', 'Selten sah ein Saal so schnell zur Uhr'],
    e: ['Es reicht: Das Publikum hat längst entschieden', 'Ein jeder deiner Verse starb im Flug'],
    w: ['Was war das für ein Laut? Ach, deine Niederlage', 'Worte lassen dich im Stich, wie stets'],
    t: ['Tritt ab, solang dir noch ein Rest von Stolz bleibt', 'Träum weiter, kleiner Dichter, träum vom Sieg'],
    u: ['Und wieder kommt dein Vers zu spät', 'Unter uns: selbst das Echo gähnt'],
    h: ['Heute Nacht erinnert sich die Bühne nur an mich', 'Hör gut zu, so klingt ein echter Vers'],
    l: ['Laut ist nicht dasselbe wie gut, mein Freund', 'Lass es gut sein, der Vorhang fällt'],
    a: ['Am Ende stehst du da und wartest auf die Niederlage', 'All deine Zeilen sind geliehen und ungelesen zurück'],
  },
};

export default pack;
