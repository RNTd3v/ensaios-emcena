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
}

/** Uma faixa de música da cena, guardada no Storage — mesmo raciocínio de `uploadedAt` do FigurinoImagem. */
export interface Musica {
  id: string
  nome: string
  url: string
  path: string
  uploadedByUid: string
  uploadedAt: string
}

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

export interface AppSettings {
  eventName: string
  posterImageUrl?: string
  posterImageDesktopUrl?: string
  /** Imagem de fundo do cabeçalho nas telas internas (logado), diferente da imagem de login. */
  internalBgUrl?: string
  eventDate?: string // YYYY-MM-DD
  callToActionText?: string
  /** Mensagem de boas-vindas exibida na Home, personalizável pelo admin. */
  welcomeMessage?: string
  /** Quantas horas antes do ensaio o check-in de presença fecha. */
  checkinLimiteHoras?: number
  updatedAt?: string
}
