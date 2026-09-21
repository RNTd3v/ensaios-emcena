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

export interface AppSettings {
  eventName: string
  posterImageUrl?: string
  posterImageDesktopUrl?: string
  /** Imagem de fundo do cabeçalho nas telas internas (logado), diferente da imagem de login. */
  internalBgUrl?: string
  eventDate?: string // YYYY-MM-DD
  callToActionText?: string
  updatedAt?: string
}
