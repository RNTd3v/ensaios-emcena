import { useEffect, useMemo, useState } from 'react'
import { subscribeToCenasDoParticipante, subscribeToCenasDosMeusDependentes } from '@/services/firebase/cenas'
import { subscribeToEnsaiosDaCena } from '@/services/firebase/ensaios'
import type { Cena, Ensaio } from '@/types'

/**
 * As cenas ativas em que a pessoa tem personagem e os ensaios de cada uma (ao vivo). `cenas` é
 * `null` enquanto carrega. Modo dependente: `uid` é um filho de `dependenteDe`.
 */
export function useEnsaiosDasMinhasCenas(uid: string, dependenteDe?: string) {
  const [cenas, setCenas] = useState<Cena[] | null>(null)
  const [ensaiosPorCena, setEnsaiosPorCena] = useState<Record<string, Ensaio[]>>({})

  useEffect(
    () =>
      dependenteDe
        ? subscribeToCenasDosMeusDependentes(dependenteDe, lista => setCenas(lista.filter(c => c.participantes.includes(uid))))
        : subscribeToCenasDoParticipante(uid, setCenas),
    [uid, dependenteDe],
  )

  const minhasCenas = useMemo(
    () => (cenas ?? []).filter(c => c.ativo && c.personagens.some(p => p.participanteUid === uid)),
    [cenas, uid],
  )
  const cenaIdsKey = minhasCenas.map(c => c.id).sort().join(',')

  // Uma assinatura por cena — a regra de `ensaios` só libera leitura filtrando por `cenaId`.
  useEffect(() => {
    if (!cenaIdsKey) return
    const unsubs = cenaIdsKey.split(',').map(cenaId =>
      subscribeToEnsaiosDaCena(cenaId, ensaios => setEnsaiosPorCena(prev => ({ ...prev, [cenaId]: ensaios }))),
    )
    return () => unsubs.forEach(u => u())
  }, [cenaIdsKey])

  return { cenas, minhasCenas, ensaiosPorCena }
}
