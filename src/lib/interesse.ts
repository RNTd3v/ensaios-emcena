import type { Area, Equipe, Inscricao } from '@/types'

/** Áreas em que a pergunta "em que quer ajudar" é obrigatória. */
const AREAS_COM_EQUIPE: Area[] = ['staff', 'tecnica']

export function perguntaInteresse(areas: Area[]): boolean {
  return areas.some(a => AREAS_COM_EQUIPE.includes(a))
}

export function interesseRespondido(equipesInteresse: string[] | undefined, ajudaOutro: string | undefined): boolean {
  return !!equipesInteresse?.length || !!ajudaOutro?.trim()
}

/** Inscrição de staff/técnica feita antes da pergunta existir (ou sem resposta). */
export function precisaInformarInteresse(i: Pick<Inscricao, 'areas' | 'dependente' | 'equipesInteresse' | 'ajudaOutro'>): boolean {
  return !i.dependente && perguntaInteresse(i.areas) && !interesseRespondido(i.equipesInteresse, i.ajudaOutro)
}

/** Nomes das equipes de interesse, na ordem da lista (ids que não existem mais ficam de fora). */
export function nomesInteresse(ids: string[] | undefined, equipes: Equipe[]): string[] {
  return equipes.filter(e => ids?.includes(e.id)).map(e => e.nome)
}
