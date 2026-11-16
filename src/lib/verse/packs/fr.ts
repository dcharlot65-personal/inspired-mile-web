import type { LanguagePack } from './index';

// French. Syllables are counted the classical way: a mute e is silent at the end of a line and before a vowel.
const pack: LanguagePack = {
  lang: 'fr',
  acrostic: ['lune', 'rose', 'roi', 'mer', 'art', 'sort', 'ami'],
  forbidden: ['s', 't', 'r', 'n', 'l', 'u'],
  relics: {
    'RL-001': ['crâne', 'farce', 'tombe', 'rire', 'poussière'],
    'RL-002': ['tempête', 'sortilège', 'bâton', 'île', 'naufrage'],
    'RL-003': ['dague', 'sang', 'sommeil', 'vision', 'main'],
    'RL-004': ['anneau', 'serment', 'nuit', 'exil', 'baiser'],
    'RL-005': ['or', 'choix', 'clémence', 'plomb', 'coffret'],
    'RL-006': ['couronne', 'trône', 'ambition', 'sorcière', 'roi'],
    'RL-007': ['livre', 'tempête', 'magie', 'page', 'naufrage'],
    'RL-008': ['larmes', 'vérité', 'fille', 'rien', 'cœur'],
    'RL-009': ['masque', 'songe', 'bouffon', 'comédie', 'lune'],
  },
  written: {
    couplet: [
      'Tes rimes sont des chandelles dans la nuit\nLa mienne est le soleil, et toi, tu fuis',
      'Monte donc, pauvre acteur, parade une heure\nPuis regarde tes vers faner comme une fleur',
    ],
    'quatrain-aabb': [
      'Tu viens armé d’un esprit emprunté\nEt tu t’étonnes de n’avoir rien touché\nJ’ai vu des rois et des fous sur la scène\nToi, tu n’es qu’une note au bas d’une page vaine',
      'La foule est venue voir un vrai combat\nEt tes vers ne sont que des restes de repas\nParle encore, plus fort, si tu l’oses\nMoi je réponds aux orages, toi aux roses',
    ],
    'quatrain-abab': [
      'J’arpentais ces planches avant ta naissance\nMes vers faisaient loi quand les tiens n’étaient que bruit\nVoici que tombe le rideau, et le silence\nLa scène veut un homme, pas un enfant qui fuit',
      'Ton vers arrive en boitant sur une jambe\nEt mendie à la foule un peu de pitié\nJe ne frappe pas celui que j’enjambe\nJe le laisse assis, seul, sur le pavé',
    ],
    tercet: [
      'Tu as une langue, soit, mais pas le talent\nElle erre comme un ivrogne dans le noir\nEt n’arrive jamais, jamais à temps',
      'Tu appelles ça un vers ? J’appelle ça une erreur\nUne ligne boiteuse qui demande grâce\nEt je la lui accorde, par pure douceur',
    ],
    anaphora: [
      'Jamais on n’a tant dit sur si peu\nJamais une scène n’a porté voix si mince\nJamais plus, je crois, ce public ne t’écoutera',
      'Parle, et les chandelles se détournent de toi\nParle, et le parterre compte les sorties\nParle, je répondrai quand cela comptera',
    ],
    crescendo: [
      'Tu es petit\nTon vers l’est plus encore\nEt j’ai écrasé bien plus grand que toi avant le petit déjeuner',
      'Écoute bien\nCe soir la scène est à moi\nEt chaque mot qui sort de ta bouche est un clou de plus dans ta défaite',
    ],
    epistrophe: [
      'Tu venais pour vaincre, et tu as trouvé la scène\nTu as parlé une fois, et perdu la scène\nSalue maintenant, et laisse-moi la scène',
      'Je t’ai prêté l’oreille, tu as gaspillé mon temps\nTa rime s’est tarie avant son temps\nIl ne te reste plus qu’à perdre ton temps',
    ],
    haiku: [
      'Tes vers sont des feuilles\nNul ne se penche pour eux\nLe vent les emporte',
      'Une voix au loin\nJe tourne la tête un peu\nJuste un peu de vent',
    ],
    'heroic-couplet': [
      'Ton vers n’est qu’une ombre sur le mur\nLe mien est le feu, éclatant et pur',
      'Je venais vendre la foudre et la flamme\nToi, tu n’as qu’une bougie, pauvre âme',
    ],
  },
  acrosticLines: {
    l: ['La salle se tait, et ce n’est pas pour toi', 'Loin d’ici, tes vers trouveront peut-être preneur'],
    u: ['Un mot de plus, et le public s’endort', 'Une fois encore tu ouvres la bouche pour rien'],
    n: ['Nul ne s’est jamais tu si longtemps pour toi', 'Ne confonds pas le bruit avec le talent'],
    e: ['Encore toi ? La foule a déjà tranché', 'Et chacun de tes vers meurt en plein vol'],
    r: ['Rimer, c’est l’escrime, et tu viens avec une cuillère', 'Rentre chez toi, les portes sont encore ouvertes'],
    o: ['On t’écoute, hélas, et l’on regrette déjà', 'Ose encore, plus fort, petite voix'],
    s: ['Si c’est là ton meilleur vers, garde les autres', 'Silence : voici comment sonne un vrai vers'],
    i: ['Il faut du souffle pour monter ici', 'Ici, la scène ne se souvient que de moi'],
    m: ['Mon pire vers vaut ton meilleur', 'Mesure bien tes mots, il t’en reste peu'],
    a: ['Ainsi finit la leçon ; emporte-la chez toi', 'Allons, salue, le rideau tombe sur toi'],
    t: ['Ta langue est vive, mais la hâte n’est pas l’esprit', 'Tu parles, tu parles, et rien ne reste'],
  },
};

export default pack;
