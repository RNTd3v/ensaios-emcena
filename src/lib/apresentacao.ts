/**
 * Roteiro do modo apresentação (desktop): cada tópico aparece nas laterais da moldura do iPhone e,
 * ao clicar, o app navega pra `rota`. A primeira metade vai pra coluna da esquerda, o resto pra direita.
 * Edite à vontade — a ordem aqui é a ordem da apresentação.
 */
export interface TopicoApresentacao {
  titulo: string
  /** Frase curta embaixo do título, pra lembrar o que mostrar. */
  descricao?: string
  rota: string
  /** Algo a abrir junto, além de navegar (ex.: o diálogo de reportar problema). */
  acao?: 'reportar'
  /** Mostra um painel grande sobre a tela (ex.: a lista de funções e permissões). */
  slide?: 'permissoes' | 'notificacoes'
}

/** Segue a demonstração do roteiro de apresentação (doc "Roteiro de apresentação — RNT Ensaios"). */
export const TOPICOS_APRESENTACAO: TopicoApresentacao[] = [
  { titulo: 'Minha inscrição', descricao: 'Dados, disponibilidade e dependentes', rota: '/inscricao' },
  { titulo: 'Home', descricao: 'Card “Instale o app” · próximo ensaio, metas e roteiro', rota: '/' },
  { titulo: 'Minhas cenas', descricao: 'Abra uma cena · confirmar presença', rota: '/cenas' },
  { titulo: 'Personagem', descricao: 'Na cena, toque num personagem · foto de figurino', rota: '/cenas' },
  { titulo: 'Músicas e figurinos', descricao: 'Tocar uma música · anotação no tempo', rota: '/musicas' },
  { titulo: 'Notificações', descricao: 'O sino · ativar ao vivo', rota: '/notificacoes' },
  { titulo: 'Quem notifica quem', descricao: 'Avisos manuais e automáticos', rota: '/notificacoes', slide: 'notificacoes' },
  { titulo: 'Relógio de oração', descricao: 'Quero orar nesse horário · pedidos', rota: '/oracao' },
  { titulo: 'Metas e gastos', descricao: 'Arrecadação × gastos · Rifas e Doces', rota: '/metas-gastos' },
  { titulo: 'Ensaio ao vivo', descricao: 'Volte pra visão de admin · abra uma cena e inicie', rota: '/cenas' },
  { titulo: 'Funções e permissões', descricao: 'Quem pode fazer o quê', rota: '/equipes', slide: 'permissoes' },
  { titulo: 'Reportar problema', descricao: '“Reporte por aqui, não no grupo”', rota: '/', acao: 'reportar' },
]

/**
 * Quem pode fazer o quê, pro slide de funções. Segue as regras das telas (CenaDetalhe, EquipeDetalhe,
 * Notificacoes, Oracao, MetasGastos...) — se uma regra mudar lá, atualize aqui.
 */
export interface FuncaoApresentacao {
  funcao: string
  grupo: 'geral' | 'cena' | 'equipe'
  /** Líder mostra a coroa, como nas listas do app. */
  lider?: boolean
  pode: string[]
}

export const FUNCOES_APRESENTACAO: FuncaoApresentacao[] = [
  {
    funcao: 'Admin',
    grupo: 'geral',
    pode: [
      'Tudo o que as outras funções fazem, em todas as cenas e equipes',
      'Mandar avisos pra todos',
      'Gerenciamento de inscrições',
      'Criar cenas e equipes, escolher líderes',
      'Personagens, calendário geral e disponibilidade',
      'Configurações, liberar a oração e ver problemas reportados',
    ],
  },
  {
    funcao: 'Participante',
    grupo: 'geral',
    pode: [
      'Fazer a inscrição e informar disponibilidade',
      'Confirmar presença ou avisar que não vai',
      'Enviar foto do figurino do seu personagem',
      'Anotar nas músicas das suas cenas',
      'Ver Home, músicas, figurinos e metas',
    ],
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
    funcao: 'Assistente de cena',
    grupo: 'cena',
    pode: ['Confirmar e cancelar ensaios', 'Iniciar e finalizar o ensaio', 'Marcar presença, local e anotações'],
  },
  {
    funcao: 'Líder de equipe',
    grupo: 'equipe',
    lider: true,
    pode: ['Tudo do assistente de equipe', 'Editar a equipe, membros e assistentes', 'Mandar avisos pra equipe'],
  },
  {
    funcao: 'Assistente de equipe',
    grupo: 'equipe',
    pode: ['Criar e editar tarefas: responsável, prazo e cena', 'Definir o prazo do figurino'],
  },
  {
    funcao: 'Membro de equipe',
    grupo: 'equipe',
    pode: ['Atualizar o status das tarefas', 'Cadastrar músicas ou figurinos, se a equipe cuida disso'],
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
  { quando: 'Ensaio daqui a pouco (até 2h antes)', recebe: 'Participantes, menos quem avisou que não vai', dispara: 'O próprio app' },
  { quando: 'Foto de figurino enviada', recebe: 'Líder da cena', dispara: 'Quem enviou a foto' },
  { quando: 'Figurino aprovado ou reprovado', recebe: 'Quem enviou a foto', dispara: 'Líder da cena' },
  { quando: 'Tarefa atribuída', recebe: 'O responsável pela tarefa', dispara: 'Líder ou assistente da equipe' },
  { quando: 'Tarefa bloqueada ou cancelada', recebe: 'Líder e assistentes da equipe', dispara: 'Quem mudou o status' },
  { quando: 'Problema reportado', recebe: 'O suporte', dispara: 'Qualquer pessoa' },
]

/** Liga com `?apresentacao` na URL e desliga com `?apresentacao=0`; vale enquanto a aba estiver aberta. */
const CHAVE = 'modo-apresentacao'

export function lerModoApresentacao(search: string): boolean {
  const param = new URLSearchParams(search).get('apresentacao')
  try {
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
