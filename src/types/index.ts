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
 * Grupo de ensaio: um conjunto de participantes reunidos num dia/horário. Não tem relação com o
 * conceito de "núcleo" (roteiro, personagens, música etc.) ainda em discussão — é deliberadamente
 * mais simples.
 */
export interface Elenco {
  id: string
  nome: string
  participantes: string[]
  /** uid de um dos participantes, marcado como líder desse elenco. */
  liderUid?: string
  dias: DiaSemana[]
  /** Horário único, válido pra todos os dias. Mutuamente exclusivo com `horarios` (por dia). */
  horario?: string
  /** Um horário por dia da semana, quando o elenco não tem um horário comum a todos os dias. */
  horarios?: Partial<Record<DiaSemana, string>>
  observacao?: string
  /**
   * "Excluir" um elenco só desativa (soft delete) — só admin reativa. Exclusão de verdade
   * (deleteElencoPermanently) é ação separada, só pra admin.
   */
  ativo: boolean
  createdByUid?: string
  createdAt: string
  updatedByUid?: string
  updatedAt?: string
  deactivatedByUid?: string
  deactivatedAt?: string
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
  updatedAt?: string
}
