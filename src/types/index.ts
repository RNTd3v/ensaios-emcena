export type UserRole = 'admin' | 'participante'

export interface AppUser {
  uid: string
  email: string
  displayName: string
  photoURL: string | null
  role: UserRole
  active: boolean
  createdAt: string
}

export type Area = 'elenco' | 'staff' | 'figurino' | 'tecnica'

export const AREA_LABELS: Record<Area, string> = {
  elenco: 'Elenco',
  staff: 'Staff / Produção',
  figurino: 'Figurino',
  tecnica: 'Técnica (som/luz)',
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
