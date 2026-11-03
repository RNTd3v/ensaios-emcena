import { uidsAusentes } from '@/services/firebase/ensaios'
import { ensaioStatus } from '@/lib/ensaioStatus'
import type { Cena, Ensaio, Personagem } from '@/types'

/**
 * Como a pessoa de um personagem ficou num ensaio que já passou:
 * - `presente`: chamada e marcada presente;
 * - `avisouFalta`: chamada, disse que não ia (com motivo);
 * - `semResposta`: chamada e não apareceu nem avisou — não deu satisfação;
 * - `dispensado`: o ensaio tinha obrigatórios e o personagem não estava entre eles (não precisava ir);
 * - `extra`: não foi chamada, mas apareceu mesmo assim.
 */
export type SituacaoFrequencia = 'presente' | 'avisouFalta' | 'semResposta' | 'dispensado' | 'extra'

export const SITUACAO_LABELS: Record<SituacaoFrequencia, string> = {
  presente: 'Presente',
  avisouFalta: 'Avisou que não ia',
  semResposta: 'Não deu satisfação',
  dispensado: 'Não precisava ir',
  extra: 'Foi sem ser chamado',
}

export interface RegistroFrequencia {
  ensaio: Ensaio
  cena: Cena
  personagem: Personagem
  uid: string
  situacao: SituacaoFrequencia
}

export interface ResumoFrequencia {
  /** Ensaios em que a pessoa era chamada (presente + avisouFalta + semResposta). */
  chamados: number
  presente: number
  avisouFalta: number
  semResposta: number
  dispensado: number
  extra: number
  /** presente / chamados, de 0 a 1 — `null` sem nenhum ensaio chamado. */
  taxa: number | null
}

/**
 * Ensaios que contam pra frequência: os que já aconteceram (finalizados, ou com a data já passada
 * mesmo sem registro), sem os cancelados. Mais recentes primeiro.
 */
export function ensaiosQueContam(ensaios: Ensaio[], todayKey: string): Ensaio[] {
  return ensaios
    .filter(e => {
      const s = ensaioStatus(e, todayKey)
      return s === 'realizado' || s === 'semRegistro'
    })
    .sort((a, b) => b.data.localeCompare(a.data) || b.horario.localeCompare(a.horario))
}

/**
 * Situação de quem faz `personagem` (vínculo atual) em `ensaio`. Chamado = ensaio sem obrigatórios
 * (a cena toda) ou com o personagem entre eles — mesma regra de `elencoDoEnsaio`.
 */
export function situacaoNoEnsaio(ensaio: Ensaio, personagem: Personagem, uid: string): SituacaoFrequencia {
  const chamado = !ensaio.obrigatorios?.length || ensaio.obrigatorios.includes(personagem.id)
  const presente = !!ensaio.presencas?.includes(uid)
  if (!chamado) return presente ? 'extra' : 'dispensado'
  if (presente) return 'presente'
  return uidsAusentes(ensaio).includes(uid) ? 'avisouFalta' : 'semResposta'
}

/** Registros de um personagem (com pessoa) nos ensaios da cena dele — `ensaios` já filtrados por `ensaiosQueContam`. */
export function registrosDoPersonagem(cena: Cena, personagem: Personagem, ensaios: Ensaio[]): RegistroFrequencia[] {
  const uid = personagem.participanteUid
  if (!uid) return []
  return ensaios
    .filter(e => e.cenaId === cena.id)
    .map(ensaio => ({ ensaio, cena, personagem, uid, situacao: situacaoNoEnsaio(ensaio, personagem, uid) }))
}

export function resumir(registros: RegistroFrequencia[]): ResumoFrequencia {
  const r = { chamados: 0, presente: 0, avisouFalta: 0, semResposta: 0, dispensado: 0, extra: 0 }
  for (const { situacao } of registros) {
    r[situacao]++
    if (situacao === 'presente' || situacao === 'avisouFalta' || situacao === 'semResposta') r.chamados++
  }
  return { ...r, taxa: r.chamados ? r.presente / r.chamados : null }
}

export function formatTaxa(taxa: number | null): string {
  return taxa === null ? '—' : `${Math.round(taxa * 100)}%`
}
