import { useEffect, useMemo, useState } from 'react'
import { subscribeToCenasDoParticipante, subscribeToCenasDosMeusDependentes } from '@/services/firebase/cenas'
import { subscribeToProximasSessoes, subscribeToTreinamentos, treinamentoValePara, uidsDoElenco } from '@/services/firebase/treinamentos'
import { toDateKey } from '@/lib/agenda'
import type { Cena, Treinamento, TreinamentoSessao } from '@/types'

/**
 * Se `uid` é do elenco (tem personagem em alguma cena ativa). `undefined` enquanto carrega.
 * `dependenteDe` = `uid` é um filho e quem está vendo é o responsável (as cenas vêm pela lista
 * `responsaveisDependentes`, que é o que a regra deixa ler).
 */
export function useEhElenco(uid: string, dependenteDe?: string): boolean | undefined {
  const [cenas, setCenas] = useState<Cena[] | null>(null)
  useEffect(
    () => (dependenteDe ? subscribeToCenasDosMeusDependentes(dependenteDe, setCenas) : subscribeToCenasDoParticipante(uid, setCenas)),
    [uid, dependenteDe],
  )
  return cenas ? uidsDoElenco(cenas).has(uid) : undefined
}

export interface SessaoDoTreinamento {
  sessao: TreinamentoSessao
  treinamento: Treinamento
}

/**
 * Sessões de treinamento de hoje em diante que valem pra `uid`, em ordem (ver `treinamentoValePara`).
 * Usado no card da Home e pra esconder o ensaio que cai no mesmo dia.
 */
export function useProximosTreinamentos(uid: string, ehElenco: boolean | undefined): SessaoDoTreinamento[] {
  const [treinamentos, setTreinamentos] = useState<Treinamento[]>([])
  const [sessoes, setSessoes] = useState<TreinamentoSessao[]>([])
  const todayKey = toDateKey(new Date())

  useEffect(() => subscribeToTreinamentos(setTreinamentos), [])
  useEffect(() => subscribeToProximasSessoes(todayKey, setSessoes), [todayKey])

  return useMemo(() => {
    const porId = new Map(treinamentos.map(t => [t.id, t]))
    return sessoes.flatMap(sessao => {
      const treinamento = porId.get(sessao.treinamentoId)
      if (!treinamento || !treinamentoValePara(treinamento, uid, ehElenco)) return []
      return [{ sessao, treinamento }]
    })
  }, [treinamentos, sessoes, uid, ehElenco])
}
