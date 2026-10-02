/**
 * Roteiro do modo apresentação (desktop): cada tópico aparece nas laterais da moldura do iPhone e,
 * ao clicar, o app navega pra `rota`. A primeira metade vai pra coluna da esquerda, o resto pra direita.
 * Edite à vontade — a ordem aqui é a ordem da apresentação.
 */
export type AcaoApresentacao = 'reportar' | 'foto'

export interface TopicoApresentacao {
  titulo: string
  /** Frase curta embaixo do título, pra lembrar o que mostrar. */
  descricao?: string
  rota: string
  /** Algo a abrir junto, além de navegar (ex.: o diálogo de reportar problema). */
  acao?: AcaoApresentacao
  /** Mostra algo que só o admin vê no app — o tópico ganha o escudo de admin. */
  admin?: boolean
  /** Mostra um painel grande sobre a tela (ex.: a lista de funções e permissões). */
  slide?: 'instalacao' | 'permissoes' | 'notificacoes' | 'conclusao'
}

/**
 * Tópico 1, só na tela de login (a apresentação começa antes de entrar). Os de dentro do app
 * continuam a numeração a partir de `NUMERO_PRIMEIRO_TOPICO_APP`.
 */
export const TOPICO_LOGIN: TopicoApresentacao = {
  titulo: 'Instalar o app',
  descricao: 'iPhone e Android · passo a passo e QR code',
  rota: '/login',
  slide: 'instalacao',
}
export const NUMERO_PRIMEIRO_TOPICO_APP = 2

/** Segue a demonstração do roteiro de apresentação (doc "Roteiro de apresentação — RNT Ensaios"). */
export const TOPICOS_APRESENTACAO: TopicoApresentacao[] = [
  { titulo: 'Notificações', descricao: 'O sino · ativar ao vivo', rota: '/notificacoes' },
  { titulo: 'Quem notifica quem', descricao: 'Avisos, lembretes pra confirmar e automáticas', rota: '/notificacoes', slide: 'notificacoes' },
  { titulo: 'Minha inscrição', descricao: 'Dados, disponibilidade, dependentes · staff/técnica: em que quer ajudar', rota: '/inscricao' },
  { titulo: 'Home', descricao: 'Card “Instale o app” · próximo ensaio, metas e roteiro', rota: '/' },
  { titulo: 'Minha foto', descricao: 'Menu → toque na foto · trocar a do Google', rota: '/', acao: 'foto' },
  { titulo: 'Minhas cenas', descricao: 'Confirmar presença ou avisar que não vai · dá pra mudar de ideia', rota: '/cenas' },
  { titulo: 'Personagem', descricao: 'Na cena, toque num personagem · foto de figurino', rota: '/cenas' },
  { titulo: 'Equipes', descricao: 'Tarefas com responsável e prazo · status · quem quer ajudar', rota: '/equipes' },
  { titulo: 'Funções e permissões', descricao: 'Quem pode fazer o quê', rota: '/equipes', slide: 'permissoes' },
  { titulo: 'Músicas e figurinos', descricao: 'Tocar uma música · anotação no tempo', rota: '/musicas' },
  { titulo: 'Relógio de oração', descricao: 'Quero orar nesse horário · pedidos', rota: '/oracao' },
  { titulo: 'Metas e gastos', descricao: 'Arrecadação × gastos · Sorteio Cesta de Natal e Doces', rota: '/metas-gastos' },
  { titulo: 'Reportar problema', descricao: '“Reporte por aqui, não no grupo”', rota: '/', acao: 'reportar' },
  { titulo: 'Conclusão e perguntas', descricao: 'O que fazer hoje · QR code do app', rota: '/', slide: 'conclusao' },
]

/**
 * Quem pode fazer o quê, pro slide de funções. Segue as regras das telas (CenaDetalhe, EquipeDetalhe,
 * Notificacoes, Oracao, MetasGastos...) — se uma regra mudar lá, atualize aqui.
 */
export interface FuncaoApresentacao {
  funcao: string
  grupo: 'geral' | 'cena' | 'equipe'
  /** Líder mostra a coroa e assistente a mãozinha, como nas listas do app. */
  lider?: boolean
  assistente?: boolean
  pode: string[]
}

export const FUNCOES_APRESENTACAO: FuncaoApresentacao[] = [
  {
    funcao: 'Participante',
    grupo: 'geral',
    pode: [
      'Fazer a inscrição, informar disponibilidade e em que quer ajudar',
      'Confirmar presença, avisar que não vai e mudar de ideia',
      'Trocar a própria foto',
      'Enviar foto do figurino do seu personagem',
      'Anotar nas músicas das suas cenas',
      'Ver Home, músicas, figurinos e metas',
    ],
  },
  {
    funcao: 'Admin',
    grupo: 'geral',
    pode: [
      'Tudo o que as outras funções fazem, em todas as cenas e equipes',
      'Mandar avisos pra todos',
      'Gerenciamento de inscrições',
      'Criar cenas e equipes, escolher líderes',
      'Personagens e calendário geral',
      'Disponibilidade: ver a inscrição e pôr na cena ou na equipe',
      'Configurações, liberar a oração e ver problemas reportados',
    ],
  },
  {
    funcao: 'Assistente de cena',
    grupo: 'cena',
    assistente: true,
    pode: ['Confirmar e cancelar ensaios', 'Iniciar e finalizar o ensaio', 'Marcar presença, local e anotações'],
  },
  {
    funcao: 'Líder de cena',
    grupo: 'cena',
    lider: true,
    pode: [
      'Tudo do assistente de cena',
      'Agenda recorrente, nome e roteiro da cena',
      'Adicionar e remover participantes, escolher assistentes',
      'Personagens da cena',
      'Aprovar fotos de figurino',
      'Mandar avisos pra cena',
    ],
  },
  {
    funcao: 'Membro de equipe',
    grupo: 'equipe',
    pode: ['Atualizar o status das tarefas', 'Cadastrar músicas ou figurinos, se a equipe cuida disso'],
  },
  {
    funcao: 'Assistente de equipe',
    grupo: 'equipe',
    assistente: true,
    pode: ['Tudo do membro de equipe', 'Criar e editar tarefas: responsável, prazo e cena', 'Definir o prazo do figurino'],
  },
  {
    funcao: 'Líder de equipe',
    grupo: 'equipe',
    lider: true,
    pode: [
      'Tudo do assistente de equipe',
      'Editar a equipe, membros e assistentes (quem quer ajudar aparece primeiro)',
      'Mandar avisos pra equipe',
    ],
  },
]

/**
 * Pro slide de notificações. Avisos: Notificacoes.tsx + firestore.rules (avisos) + `avisoCriado`;
 * automáticas: as Cloud Functions em functions/src/index.ts.
 */
export const AVISOS_APRESENTACAO: { quem: string; lider?: boolean; paraQuem: string }[] = [
  { quem: 'Admin', paraQuem: 'Todo mundo, qualquer cena, qualquer equipe ou pessoas escolhidas' },
  { quem: 'Líder de cena', lider: true, paraQuem: 'Os participantes da cena que lidera' },
  { quem: 'Líder de equipe', lider: true, paraQuem: 'Os membros da equipe que lidera' },
  { quem: 'Assistentes, membros e participantes', paraQuem: 'Não mandam avisos' },
]

export const AUTOMATICAS_APRESENTACAO: { quando: string; recebe: string; dispara: string }[] = [
  { quando: 'Ensaio confirmado, cancelado ou alterado', recebe: 'Participantes da cena', dispara: 'Líder ou assistente da cena' },
  { quando: 'Hoje tem ensaio (às 8h do dia)', recebe: 'Participantes, menos quem avisou que não vai', dispara: 'O próprio app' },
  { quando: 'Confirme sua presença (2h, 1h, 30 e 10 min antes de fechar)', recebe: 'Só quem ainda não respondeu', dispara: 'O próprio app' },
  { quando: 'Ensaio daqui a pouco (até 2h antes)', recebe: 'Participantes, menos quem avisou que não vai', dispara: 'O próprio app' },
  { quando: 'Foto de figurino enviada', recebe: 'Líder da cena', dispara: 'Quem enviou a foto' },
  { quando: 'Figurino aprovado ou reprovado', recebe: 'Quem enviou a foto', dispara: 'Líder da cena' },
  { quando: 'Tarefa atribuída', recebe: 'O responsável pela tarefa', dispara: 'Líder ou assistente da equipe' },
  { quando: 'Tarefa bloqueada ou cancelada', recebe: 'Líder e assistentes da equipe', dispara: 'Quem mudou o status' },
  { quando: 'Problema reportado', recebe: 'O suporte', dispara: 'Qualquer pessoa' },
]

/**
 * Slide de instalação: o mesmo passo a passo do card "Instale o app" da Home (InstalarAppCard) e da
 * ativação do push (Notificacoes.tsx). `icone` = qual ícone mostrar no passo.
 */
export interface PassoInstalacao {
  texto: string
  destaque?: string
  icone?: 'compartilhar' | 'adicionar' | 'menu' | 'baixar' | 'sino'
}

export const INSTALACAO_APRESENTACAO: { plataforma: string; navegador: string; passos: PassoInstalacao[]; notificacoes: string }[] = [
  {
    plataforma: 'iPhone',
    navegador: 'Safari',
    passos: [
      { texto: 'Abra o link no', destaque: 'Safari' },
      { texto: 'Toque em', destaque: 'Compartilhar', icone: 'compartilhar' },
      { texto: 'Escolha', destaque: 'Adicionar à Tela de Início', icone: 'adicionar' },
      { texto: 'Abra pelo ícone', destaque: 'Vila Esperança' },
      { texto: 'No app, toque no', destaque: '→ Ativar notificações → Permitir', icone: 'sino' },
    ],
    notificacoes: 'No iPhone, as notificações só chegam com o app instalado (iOS 16.4 ou mais novo).',
  },
  {
    plataforma: 'Android',
    navegador: 'Chrome',
    passos: [
      { texto: 'Abra o link no', destaque: 'Chrome' },
      { texto: 'Na Home, toque em', destaque: 'Instalar app', icone: 'baixar' },
      { texto: 'Ou no menu', destaque: '→ Instalar app', icone: 'menu' },
      { texto: 'Abra pelo ícone', destaque: 'Vila Esperança' },
      { texto: 'No app, toque no', destaque: '→ Ativar notificações → Permitir', icone: 'sino' },
    ],
    notificacoes: 'No Android funciona até pelo navegador, mas instalado é mais garantido.',
  },
]

/** Slide de conclusão: o que cada um faz hoje, antes de ir embora. */
export const PEDIDOS_CONCLUSAO = [
  'Instale o app na tela de início do celular',
  'Complete sua inscrição com a sua disponibilidade',
  'Staff e técnica: conte em que equipe quer ajudar',
  'Ative as notificações no sino',
]

export const APP_URL_APRESENTACAO = 'https://ensaios-emcena.web.app'

/** Liga com `?apresentacao` na URL e desliga com `?apresentacao=0`; vale enquanto a aba estiver aberta. */
const CHAVE = 'modo-apresentacao'
const CHAVE_LAYOUT = 'modo-apresentacao-layout'

/**
 * Como os tópicos aparecem ao lado do iPhone: `enxuto` = só o tópico atual + progresso (pro
 * público); `lista` = todos os tópicos (ferramenta do apresentador). Alterna com a tecla L.
 */
export type LayoutApresentacao = 'enxuto' | 'lista'

export function lerLayoutApresentacao(): LayoutApresentacao {
  try {
    return sessionStorage.getItem(CHAVE_LAYOUT) === 'lista' ? 'lista' : 'enxuto'
  } catch {
    return 'enxuto'
  }
}

export function salvarLayoutApresentacao(layout: LayoutApresentacao) {
  try {
    sessionStorage.setItem(CHAVE_LAYOUT, layout)
  } catch {
    // sem storage: vale só até recarregar
  }
}

/** Total de tópicos, contando o da tela de login. */
export const TOTAL_TOPICOS = () => TOPICOS_APRESENTACAO.length + NUMERO_PRIMEIRO_TOPICO_APP - 1

export function lerModoApresentacao(search: string): boolean {
  const param = new URLSearchParams(search).get('apresentacao')
  try {
    // `?apresentacao=lista` / `?apresentacao=enxuto` já escolhem o layout.
    if (param === 'lista' || param === 'enxuto') salvarLayoutApresentacao(param)
    if (param !== null) sessionStorage.setItem(CHAVE, param === '0' ? '0' : '1')
    return sessionStorage.getItem(CHAVE) === '1'
  } catch {
    return param !== null && param !== '0'
  }
}

export function sairModoApresentacao() {
  try {
    sessionStorage.setItem(CHAVE, '0')
  } catch {
    // sem storage: basta recarregar sem o parâmetro
  }
}
