import type { LanguagePack } from './index';

// Spanish. Rhymes are consonant rhymes from the stressed vowel, as ./rhyme checks them.
const pack: LanguagePack = {
  lang: 'es',
  acrostic: ['luna', 'rosa', 'amor', 'rey', 'mar', 'arte', 'sol'],
  forbidden: ['s', 'r', 'n', 'l', 'd', 't'],
  relics: {
    'RL-001': ['calavera', 'burla', 'tumba', 'risa', 'polvo'],
    'RL-002': ['tormenta', 'hechizo', 'báculo', 'isla', 'naufragio'],
    'RL-003': ['daga', 'sangre', 'sueño', 'visión', 'mano'],
    'RL-004': ['anillo', 'juramento', 'noche', 'destierro', 'beso'],
    'RL-005': ['oro', 'elección', 'clemencia', 'plomo', 'cofre'],
    'RL-006': ['corona', 'trono', 'ambición', 'bruja', 'rey'],
    'RL-007': ['libro', 'tempestad', 'magia', 'página', 'naufragio'],
    'RL-008': ['lágrimas', 'verdad', 'hija', 'nada', 'corazón'],
    'RL-009': ['máscara', 'sueño', 'bufón', 'comedia', 'luna'],
  },
  written: {
    couplet: [
      'Tus versos son un cirio que agoniza\nLos míos, la llama que te hace ceniza',
      'Sube, pobre cómico, pavonea tu hora\nQue el público bosteza y nadie te llora',
    ],
    'quatrain-aabb': [
      'Vienes armado de un ingenio prestado\nY te extraña que ningún golpe haya acertado\nYo he visto reyes y bufones en escena\nTú eres la nota al pie de una página ajena',
      'El público vino a ver una batalla\nY tu verso es un soldado que se calla\nHabla otra vez, más alto, sin temor\nYo respondo al trueno; tú eres un rumor',
    ],
    'quatrain-abab': [
      'Pisé estas tablas antes que nacieras\nMi verso era ley cuando el tuyo era ruido\nYa cae el telón sobre tus quimeras\nLa escena pide un hombre, no un niño perdido',
      'Tu verso entra cojeando en una pierna\nY pide al público un poco de piedad\nNo pateo a quien mendiga en la taberna\nLo dejo sentado con su soledad',
    ],
    tercet: [
      'Tienes lengua, lo admito, pero no el arte\nVaga como un borracho por lo oscuro\nY nunca llega a ninguna parte',
      '¿A eso llamas verso? Yo lo llamo error\nUna línea coja que pide descanso\nY yo se lo concedo, por puro favor',
    ],
    anaphora: [
      'Nunca oí decir tanto sobre tan poco\nNunca un tablado soportó voz tan flaca\nNunca más, sospecho, te escuchará esta gente',
      'Habla, y las velas se apartan de ti\nHabla, y el público cuenta las salidas\nHabla, que yo responderé cuando importe',
    ],
    crescendo: [
      'Eres poca cosa\nTu verso es menos todavía\nY yo he aplastado cosas mucho mayores que tú antes del desayuno',
      'Oye esto\nLa escena es mía esta noche\nY cada palabra que sale de tu boca es otro clavo en tu derrota',
    ],
    epistrophe: [
      'Viniste a ganar y encontraste la escena\nHablaste una vez y perdiste la escena\nAhora saluda y déjame la escena',
      'Te presté oídos y malgastaste el tiempo\nTu rima se secó antes de tiempo\nYa solo te queda perder el tiempo',
    ],
    haiku: [
      'Tu verso cae\nComo las hojas secas\nEl viento ríe',
      'Una voz lejos\nVuelvo la cara por si\nEra el viento',
    ],
    'heroic-couplet': [
      'Tu verso es sombra sobre la pared\nMi verso es fuego; tú mueres de sed',
      'Traigo truenos, relámpagos y llama\nTú, la vela que el aire reclama',
    ],
  },
  acrosticLines: {
    l: ['Llegas tarde, y tu verso llega aún más tarde', 'Lo mejor de tu rima es que se acaba'],
    u: ['Un aplauso para ti: el último', 'Una vez más abres la boca en vano'],
    n: ['Nadie guardó jamás tanto silencio por ti', 'No hay público que aguante esa cojera'],
    a: ['Aún sigues ahí, esperando la derrota', 'Ahora escucha cómo suena un verso'],
    r: ['Rimar es esgrima, y tú trajiste una cuchara', 'Retírate, que las puertas siguen abiertas'],
    o: ['Otra vez hablas, y otra vez en balde', 'Oye cómo calla la sala cuando acabas'],
    s: ['Se acabó la lección; llévatela a casa', 'Sobran tus palabras y falta tu ingenio'],
    m: ['Mi peor verso vale por el mejor tuyo', 'Mira bien, que no pienso repetirlo'],
    e: ['Esta noche la escena solo me recuerda a mí', 'En toda mi vida oí rima tan pobre'],
    y: ['Ya basta: el público ha dictado sentencia', 'Y aun así vuelves a intentarlo'],
    t: ['Tu lengua es rápida, pero la prisa no es ingenio', 'Todo lo que dices ya lo dije mejor'],
  },
};

export default pack;
