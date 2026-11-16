// Português (grafia brasileira). Termos fixos: turma, professor (escrito «professor ou professora» onde cabe), estudante, tarefa, código de acesso; anúncio (mercado), chave (torneio), créditos; estrofe, duelo, carta como no resto do jogo. Tratamento: você.
// Page area "season": the Season Pass (/season).
// Where each term comes from and how these strings were checked: docs/language/pages-rest.md
const messages: Record<string, string> = {
  'season.meta.title': 'Passe de temporada',
  'season.meta.description': 'Suba o nível do seu Passe de temporada para desbloquear recompensas no Inspired Mile.',
  'season.badge': 'Temporada {n}',
  'season.title': 'Passe de temporada',
  'season.intro': 'Jogue batalhas, quizzes e desafios para ganhar XP. Cada novo nível desbloqueia cartas, créditos e títulos.',
  'season.loading': 'Carregando…',
  'season.level': 'Nível',
  'season.xp': '{n} XP',
  'season.xpGain': '+{n} XP',
  'season.next': 'Faltam {n} XP para o próximo nível',
  'season.maxed': 'Nível máximo alcançado',
  'season.track': 'Trilha de recompensas',
  'season.track.empty': 'Esta temporada ainda não tem recompensas.',
  'season.reward.level': 'Nível {n}',
  'season.reward.pack': 'Pacote de cartas: {name}',
  'season.reward.card': 'Carta: {name}',
  'season.reward.title': 'Título: {name}',
  'season.reward.unknown': 'Recompensa: {name}',
  'season.reward.premium': 'Premium',
  'season.claim': 'Resgatar',
  'season.claimed': 'Resgatada',
  'season.locked': 'Alcance o nível {n}',
  'season.signIn': 'Entre na sua conta para manter o progresso do seu Passe de temporada em todos os dispositivos.',
};

export default messages;
