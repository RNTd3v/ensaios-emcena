import type { CronometroEnsaio } from '@/types'

export const CRONOMETRO_ZERADO: CronometroEnsaio = { acumuladoSeg: 0, inicioMs: null }

/** Segundos no cronômetro do ensaio agora: o acumulado mais a corrida atual, se estiver correndo. */
export function segundosDoCronometro(c: CronometroEnsaio) {
  const correndo = c.inicioMs === null ? 0 : Math.max(0, Math.floor((Date.now() - c.inicioMs) / 1000))
  return c.acumuladoSeg + correndo
}
