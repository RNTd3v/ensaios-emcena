export type Area = 'elenco' | 'staff' | 'figurino' | 'tecnica'

export const AREA_LABELS: Record<Area, string> = {
  elenco: 'Elenco',
  staff: 'Staff',
  figurino: 'Figurino',
  tecnica: 'Técnica',
}

/**
 * 'lider' ainda não tem escopo (núcleo/área/seção) associado — é só a marcação de perfil.
 * O escopo (onde essa pessoa lidera) virá com a estrutura de atribuições, quando núcleo existir.
 */
export type UserRole = 'admin' | 'participante' | 'lider'

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  participante: 'Participante',
  lider: 'Líder',
}

export interface AppUser {
  uid: string
  email: string
  displayName: string
  photoURL: string | null
  role: UserRole
  active: boolean
  /** uid de quem revogou o acesso (setado junto com active=false, limpo ao reativar). */
  revokedByUid?: string
  revokedAt?: string
  createdAt: string
}

export type DiaSemana = 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab'

export const DIA_SEMANA_LABELS: Record<DiaSemana, string> = {
  seg: 'Seg',
  ter: 'Ter',
  qua: 'Qua',
  qui: 'Qui',
  sex: 'Sex',
  sab: 'Sáb',
}

export type InscricaoStatus = 'pendente' | 'confirmado' | 'recusado'

export interface Inscricao {
  uid: string
  nomeCompleto: string
  apelido: string
  telefone: string
  email: string
  menorDeIdade: boolean
  responsavel?: {
    nome: string
    telefone: string
  }
  areas: Area[]
  disponibilidade: {
    dias: DiaSemana[]
    observacao?: string
  }
  /** Datas específicas (YYYY-MM-DD) em que a pessoa NÃO pode, além dos dias da semana. */
  indisponibilidade?: string[]
  observacoes?: string
  status: InscricaoStatus
  createdAt: string
  updatedAt?: string
}

/**
 * Um personagem da cena, opcionalmente interpretado por um dos participantes dela. Um mesmo
 * participante pode ter mais de um personagem (por isso o vínculo fica no personagem, não o
 * inverso) — a lista de personagens é independente da lista de participantes.
 * A tela de detalhe do personagem (com infos próprias) ainda não existe.
 */
export interface Personagem {
  id: string
  nome: string
  /** uid de um dos participantes da cena que interpreta esse personagem. */
  participanteUid?: string
  /** Se true, esse personagem pode ser reaproveitado (por nome) ao cadastrar personagens em outras cenas. */
  recorrente?: boolean
  /** "Ficha do personagem" preenchida por quem interpreta — só o próprio ator/atriz edita, os demais só veem. */
  ficha?: PersonagemFicha
  /** Data limite (YYYY-MM-DD) pra enviar a foto do figurino — definida por admin/líder. */
  prazoFigurino?: string
}

/**
 * Entrada do catálogo de personagens (coleção `personagens`, só admin) — guarda os personagens
 * criados pela tela de Personagens, inclusive os que ainda não estão em nenhuma cena. O id do doc
 * é a chave normalizada do nome (ver `personagemKey`), que é o que agrupa as instâncias do mesmo
 * personagem espalhadas pelas cenas. Quando o personagem está em alguma cena, os dados da cena
 * prevalecem — o catálogo é só o fallback.
 */
export interface PersonagemCatalogo {
  id: string
  nome: string
  participanteUid?: string
  createdAt: string
}

export interface PersonagemFicha {
  idade?: string
  sexo?: string
  profissao?: string
  personalidade?: string
  estiloMusical?: string
  descricao?: string
}

/**
 * Uma foto de referência de figurino guardada no Storage. `uploadedAt` é gerado no cliente (ISO)
 * em vez de `serverTimestamp()` porque o item vive dentro de um array — precisa ser um valor
 * estável pra `arrayUnion`/`arrayRemove` conseguirem casar o mesmo item depois.
 */
export interface FigurinoImagem {
  id: string
  url: string
  /** Path no Storage — usado pra excluir o arquivo. */
  path: string
  /** id de um personagem da cena — ausente/undefined significa "geral" (não é de um personagem específico). */
  personagemId?: string
  uploadedByUid: string
  uploadedAt: string
  /** Campos da coleção `figurinos` (fase 4) — no legado (array dentro da cena) não existem. */
  cenaId?: string
  cenaNome?: string
  personagemNome?: string
  legenda?: string
  /** Equipe (com `gerencia` incluindo 'figurinos') em nome de quem foi cadastrado — base da permissão. */
  equipeId?: string
  /**
   * Foto enviada pelo ator/atriz do próprio figurino (página do personagem) passa por aprovação do
   * líder da cena. Ausente = cadastrada pela equipe (referência), já vale. Só `aprovado` (ou
   * ausente) aparece nas galerias.
   */
  aprovacao?: 'pendente' | 'aprovado' | 'reprovado'
  avaliadoPorUid?: string
  avaliadoEm?: string
  motivoReprovacao?: string
}

/** Uma faixa de música da cena, guardada no Storage — mesmo raciocínio de `uploadedAt` do FigurinoImagem. */
export interface Musica {
  id: string
  nome: string
  url: string
  path: string
  uploadedByUid: string
  uploadedAt: string
  /** Campos da coleção `musicas` (fase 4) — cena é opcional. */
  cenaId?: string
  cenaNome?: string
  equipeId?: string
}

/** O que uma equipe pode cadastrar em nome da peça toda (fase 4 — permissões por equipe). */
export type MidiaTipo = 'musicas' | 'figurinos'

/**
 * Grupo de ensaio: um conjunto de participantes reunidos num dia/horário, com os personagens da
 * cena e quem interpreta cada um. Não tem relação com o conceito de "núcleo" (roteiro, música
 * etc.) ainda em discussão — é deliberadamente mais simples.
 */
export interface Cena {
  id: string
  nome: string
  participantes: string[]
  /** uid de um dos participantes, marcado como líder dessa cena. */
  liderUid?: string
  /**
   * uids de participantes que ajudam o líder no dia a dia dos ensaios (confirmar, iniciar,
   * presença, local, anotações) — sem mexer na estrutura da cena. Líder/admin definem.
   */
  assistentes?: string[]
  personagens: Personagem[]
  dias: DiaSemana[]
  /** Horário único, válido pra todos os dias. Mutuamente exclusivo com `horarios` (por dia). */
  horario?: string
  /** Um horário por dia da semana, quando a cena não tem um horário comum a todos os dias. */
  horarios?: Partial<Record<DiaSemana, string>>
  /**
   * O roteiro em si não vive nesse app ainda — aqui é só uma referência (ex.: "Ato 1 - Cena 3")
   * e um link externo (Google Docs etc.) pra quem quiser abrir.
   */
  roteiroReferencia?: string
  roteiroUrl?: string
  /** Fotos de referência de figurino — armazenadas no Storage, quem sobe/exclui é admin ou o líder da cena. */
  figurinos?: FigurinoImagem[]
  /** Faixas de música da cena — armazenadas no Storage, só admin sobe/troca/exclui. */
  musicas?: Musica[]
  /** Data (YYYY-MM-DD) a partir da qual os ensaios dessa cena passam a valer. */
  inicioEnsaios?: string
  observacao?: string
  /**
   * "Excluir" uma cena só desativa (soft delete) — só admin reativa. Exclusão de verdade
   * (deleteCenaPermanently) é ação separada, só pra admin.
   */
  ativo: boolean
  createdByUid?: string
  createdAt: string
  updatedByUid?: string
  updatedAt?: string
  deactivatedByUid?: string
  deactivatedAt?: string
}

/** Motivo de uma ausência (`ensaios/{id}/ausencias/{uid}`) — só admin, líder da cena e a própria pessoa leem. */
export interface AusenciaMotivo {
  uid: string
  motivo: string
  registradaEm: string
}

/** Uma ocorrência de ensaio confirmada (data + horário) de uma cena — um documento por data. */
export interface Ensaio {
  id: string
  cenaId: string
  /** YYYY-MM-DD */
  data: string
  /** HH:mm */
  horario: string
  /** Onde o ensaio acontece (texto livre) — preenchido por admin ou líder da cena. */
  local?: string
  confirmedByUid: string
  confirmedAt: string
  createdAt: string
  /** uids de quem (do elenco, com personagem nessa cena) confirmou presença nesse ensaio. */
  presencas?: string[]
  /**
   * uids de quem avisou que não vai — visível pra todos. O motivo fica na subcoleção privada
   * `ensaios/{id}/ausencias/{uid}` (ver `AusenciaMotivo`). Confirmar presença tira daqui.
   */
  ausentes?: string[]
  /**
   * Legado: motivos gravados no próprio ensaio (visíveis a todo participante da cena). Migrados pra
   * subcoleção quando admin/líder abre a página do ensaio — não gravar mais aqui.
   */
  ausencias?: Record<string, { motivo: string; registradaEm: string }>
  /** ids de personagens (da cena) com presença obrigatória nesse ensaio específico. */
  obrigatorios?: string[]
  /** Ensaio geral (com todo o elenco reunido, geralmente próximo da apresentação). */
  geral?: boolean
  /** Ensaio em que o figurino deve ser usado. */
  comFigurino?: boolean
  /** Setado quando o ensaio é cancelado — o documento continua existindo (pra mostrar quem cancelou). */
  canceledByUid?: string
  canceledAt?: string
  /**
   * Preenchidos ao encerrar o ensaio pela tela "Iniciar ensaio" — o registro do que aconteceu
   * na sessão (duração cronometrada, anotações). Um ensaio com `finalizadoAt` vira um registro
   * consultável no card "Anotações" da cena.
   */
  anotacoes?: string
  duracaoSegundos?: number
  finalizadoByUid?: string
  finalizadoAt?: string
}

/**
 * Local de ensaio cadastrado pelo admin (coleção `locais`). O ensaio guarda só o nome em
 * `Ensaio.local` (texto), então renomear um local aqui não muda ensaios já marcados com o nome antigo.
 */
export interface LocalEnsaio {
  id: string
  nome: string
  endereco?: string
  observacao?: string
  /** Chave de um ícone de `LOCAL_ICONS` (@/lib/localIcons). */
  icone?: string
  createdAt: string
}

/** Versículo cadastrado pelo admin (coleção `versiculos`) — a Home sorteia um a cada carregamento. */
export interface Versiculo {
  id: string
  texto: string
  /** Ex.: "Colossenses 3:23" */
  referencia: string
  createdAt: string
}

/**
 * Resumo de metas e gastos (doc único `financeiro/resumo`), editado pelo admin em Configurações
 * enquanto a página própria de metas e gastos não existe. Valores em reais.
 */
export interface Financeiro {
  /** Meta de arrecadação total. */
  metaTotal?: number
  rifasVendidas?: number
  rifasMeta?: number
  rifasValor?: number
  docesVendidos?: number
  docesMeta?: number
  docesValor?: number
  ofertasValor?: number
  /** Orçamento previsto de gastos (opcional). */
  gastosOrcamento?: number
  gastosTotal?: number
  updatedAt?: string
}

/**
 * Horário de oração de uma pessoa (doc `horariosOracao/{uid}` — um por pessoa). Repete toda semana
 * nos `dias` marcados (0 = domingo … 6 = sábado, como `Date.getDay()`).
 */
export interface HorarioOracao {
  uid: string
  /** HH:mm */
  inicio: string
  duracaoMin: number
  dias: number[]
  updatedAt?: string
}

/** Pedido de oração (coleção `pedidosOracao`) — cadastrado pelo líder/assistente da oração ou admin. */
export interface PedidoOracao {
  id: string
  texto: string
  /** Por quem/o quê orar (opcional, ex.: "Família da Ana"). */
  titulo?: string
  respondido?: boolean
  createdByUid: string
  createdAt: string
}

/** Configuração da página de oração (doc `oracao/config`): quem lidera e as orientações. */
export interface OracaoConfig {
  liderUid?: string
  assistentes?: string[]
  orientacoes?: string
}

/**
 * Equipe de staff (coleção `equipes`) — Cenário, Iluminação, Figurino etc.; admin cria outras.
 * Um líder só, vários assistentes; `membros` inclui todo mundo da equipe (líder e assistentes também).
 */
export interface Equipe {
  id: string
  nome: string
  /** Chave de `EQUIPE_ICONS` (@/lib/equipeIcons). */
  icone?: string
  descricao?: string
  liderUid?: string
  assistentes: string[]
  membros: string[]
  /** O que os membros dessa equipe podem cadastrar/editar em qualquer cena (só admin define). */
  gerencia?: MidiaTipo[]
  /** Equipe de figurino: prazo (YYYY-MM-DD) pro elenco mandar a foto do figurino — líder/assistentes definem. */
  prazoFigurino?: string
  createdAt: string
}

export type TarefaStatus = 'a_fazer' | 'fazendo' | 'feito' | 'bloqueado' | 'cancelado'

/**
 * Tarefa de uma equipe (`equipes/{equipeId}/tarefas/{id}`). Admin, líder e assistentes da equipe
 * criam e editam; membros só atualizam o status. Bloqueado/cancelado exigem `justificativa`.
 */
export interface Tarefa {
  id: string
  equipeId: string
  titulo: string
  descricao?: string
  status: TarefaStatus
  justificativa?: string
  responsavelUid?: string
  /** YYYY-MM-DD */
  prazo?: string
  cenaId?: string
  /** Nome da cena copiado na tarefa — quem não enxerga a cena (regras) ainda vê de qual se trata. */
  cenaNome?: string
  createdByUid: string
  createdAt: string
  statusAtualizadoPorUid?: string
  statusAtualizadoEm?: string
}

export interface AppSettings {
  eventName: string
  posterImageUrl?: string
  posterImageDesktopUrl?: string
  /** Imagem de fundo do cabeçalho nas telas internas (logado), diferente da imagem de login. */
  internalBgUrl?: string
  eventDate?: string // YYYY-MM-DD
  /** Horários das apresentações nesse dia, separados por vírgula (ex.: "10:00, 19:00"). */
  apresentacaoHorarios?: string
  /** Link do roteiro (Google Docs/Drive etc.) — sem link, a Home mostra "Em breve". */
  roteiroUrl?: string
  callToActionText?: string
  /** Mensagem de boas-vindas exibida na Home, personalizável pelo admin. */
  welcomeMessage?: string
  /** Quantas horas antes do ensaio o check-in de presença fecha. */
  checkinLimiteHoras?: number
  updatedAt?: string
}
