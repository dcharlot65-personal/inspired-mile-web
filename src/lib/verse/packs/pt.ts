import type { LanguagePack } from './index';

// Portuguese (Brazilian spelling; the verses use the theatrical "tu").
const pack: LanguagePack = {
  lang: 'pt',
  acrostic: ['lua', 'rosa', 'mar', 'rei', 'arte', 'amor', 'fado'],
  forbidden: ['s', 'r', 't', 'n', 'd', 'm'],
  relics: {
    'RL-001': ['caveira', 'gracejo', 'túmulo', 'riso', 'pó'],
    'RL-002': ['tempestade', 'feitiço', 'cajado', 'ilha', 'naufrágio'],
    'RL-003': ['punhal', 'sangue', 'sono', 'visão', 'mão'],
    'RL-004': ['anel', 'jura', 'noite', 'exílio', 'beijo'],
    'RL-005': ['ouro', 'escolha', 'clemência', 'chumbo', 'cofre'],
    'RL-006': ['coroa', 'trono', 'ambição', 'bruxa', 'rei'],
    'RL-007': ['livro', 'tempestade', 'magia', 'página', 'naufrágio'],
    'RL-008': ['lágrimas', 'verdade', 'filha', 'nada', 'coração'],
    'RL-009': ['máscara', 'sonho', 'bobo', 'comédia', 'lua'],
  },
  written: {
    couplet: [
      'Teus versos são candeias na noite escura\nO meu é o sol, e a tua luz não dura',
      'Sobe, pobre ator, pavoneia a tua hora\nDepois vê o teu verso murchar lá fora',
    ],
    'quatrain-aabb': [
      'Vens armado de um engenho emprestado\nE te espantas de nenhum golpe ter acertado\nJá vi reis e bobos nesta cena\nTu és nota de rodapé, e dás pena',
      'O povo veio ver uma batalha\nE o teu verso é um soldado de palha\nFala outra vez, mais alto, sem temor\nEu respondo a trovões; tu és um rumor',
    ],
    'quatrain-abab': [
      'Pisei estas tábuas antes de nasceres\nO meu verso era lei, o teu, ruído\nCai o pano agora sobre os teus prazeres\nO palco quer um homem, não um menino perdido',
      'O teu verso entra manco, numa perna só\nE pede ao público um pouco de piedade\nNão dou pontapés em quem me mete dó\nDeixo-o sentado com a sua saudade',
    ],
    tercet: [
      'Tens língua, admito, mas não tens a arte\nAnda como um bêbado no escuro\nE nunca chega a nenhuma parte',
      'Chamas a isso verso? Eu chamo engano\nUma linha manca que pede descanso\nE eu concedo, por ser tão humano',
    ],
    anaphora: [
      'Nunca ouvi dizer tanto sobre tão pouco\nNunca um palco aguentou voz tão fraca\nNunca mais, creio eu, esta plateia te ouvirá',
      'Fala, e as velas se afastam de ti\nFala, e a plateia conta as saídas\nFala, que eu respondo quando importar',
    ],
    crescendo: [
      'És pequeno\nO teu verso é menor ainda\nE eu já esmaguei coisas bem maiores do que tu antes do café da manhã',
      'Ouve bem\nEsta noite o palco é meu\nE cada palavra que te sai da boca é mais um prego na tua derrota',
    ],
    epistrophe: [
      'Vieste para vencer e encontraste o palco\nFalaste uma vez e perdeste o palco\nAgora curva-te e deixa-me o palco',
      'Dei-te ouvidos e gastaste o tempo\nA tua rima secou antes do tempo\nJá só te resta perder tempo',
    ],
    haiku: [
      'O teu verso cai\nComo as folhas secas\nE o vento ri',
      'Uma voz longe\nViro-me e escuto\nEra o vento',
    ],
    'heroic-couplet': [
      'O teu verso é sombra na parede\nO meu é o fogo que nunca cede',
      'Trago trovões, relâmpagos e chama\nTu, a vela que o vento reclama',
    ],
  },
  acrosticLines: {
    l: ['Longe daqui talvez alguém te aplauda', 'Lamento, mas o pano já caiu'],
    u: ['Um aplauso para ti: o último', 'Uma vez mais abres a boca em vão'],
    a: ['Ainda aí estás, à espera da derrota', 'Agora ouve como soa um verso'],
    r: ['Rimar é esgrima, e tu trouxeste uma colher', 'Retira-te, que as portas ainda estão abertas'],
    o: ['Outra vez falas, outra vez em vão', 'Ouve o silêncio da sala quando acabas'],
    s: ['Se isto é o teu melhor, guarda o resto', 'Silêncio, que agora fala quem sabe'],
    m: ['Meu pior verso vale o teu melhor', 'Mede bem as palavras, restam-te poucas'],
    e: ['Esta noite o palco só se lembra de mim', 'E assim acaba a lição; leva-a para casa'],
    i: ['Insistes, e a plateia já boceja', 'Ingênuo, julgavas que isto era fácil'],
    t: ['Tens a língua rápida, mas pressa não é engenho', 'Tudo o que dizes, já eu disse melhor'],
    f: ['Foge, enquanto a saída está livre', 'Fôlego gasto, o teu, do princípio ao fim'],
    d: ['Dizes muito e não dizes nada', 'Desce do palco, que ele não é teu'],
  },
};

export default pack;
