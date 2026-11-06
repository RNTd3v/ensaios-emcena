import { useEffect, useMemo, useState } from 'react'
import { subscribeToCena, subscribeToCenasDoParticipante, subscribeToCenasDosMeusDependentes } from '@/services/firebase/cenas'
import { subscribeToEnsaiosConvidado, subscribeToEnsaiosDaCena } from '@/services/firebase/ensaios'
import type { Cena, Ensaio } from '@/types'

/**
 * As cenas ativas em que a pessoa tem personagem e os ensaios de cada uma (ao vivo). `cenas` é
 * `null` enquanto carrega. Modo dependente: `uid` é um filho de `dependenteDe`.
 * `cenasDosEnsaios` = `minhasCenas` mais as cenas (ativas) de ensaios pra que a pessoa foi
 * convidada sem ter personagem nelas — dessas, `ensaiosPorCena` traz só os ensaios do convite.
 */
export function useEnsaiosDasMinhasCenas(uid: string, dependenteDe?: string) {
  const [cenas, setCenas] = useState<Cena[] | null>(null)
  const [ensaiosPorCena, setEnsaiosPorCena] = useState<Record<string, Ensaio[]>>({})
  const [convites, setConvites] = useState<Ensaio[]>([])
  const [cenasConvite, setCenasConvite] = useState<Record<string, Cena | null>>({})

  useEffect(
    () =>
      dependenteDe
        ? subscribeToCenasDosMeusDependentes(dependenteDe, lista => setCenas(lista.filter(c => c.participantes.includes(uid))))
        : subscribeToCenasDoParticipante(uid, setCenas),
    [uid, dependenteDe],
  )

  // Convites só pra adultos (criança não é convidada — a resposta seria do responsável).
  useEffect(() => {
    if (dependenteDe) return setConvites([])
    return subscribeToEnsaiosConvidado(uid, setConvites)
  }, [uid, dependenteDe])

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

  // Cenas dos convites em que a pessoa não tem personagem (as outras já vêm acima).
  const conviteCenaIdsKey = [...new Set(convites.map(e => e.cenaId))]
    .filter(id => !minhasCenas.some(c => c.id === id))
    .sort()
    .join(',')
  useEffect(() => {
    if (!conviteCenaIdsKey) return
    const unsubs = conviteCenaIdsKey.split(',').map(cenaId =>
      subscribeToCena(cenaId, cena => setCenasConvite(prev => ({ ...prev, [cenaId]: cena }))),
    )
    return () => unsubs.forEach(u => u())
  }, [conviteCenaIdsKey])

  const cenasDosEnsaios = useMemo(() => {
    if (!conviteCenaIdsKey) return minhasCenas
    const extras = conviteCenaIdsKey
      .split(',')
      .map(id => cenasConvite[id])
      .filter((c): c is Cena => !!c && c.ativo)
    return [...minhasCenas, ...extras]
  }, [minhasCenas, conviteCenaIdsKey, cenasConvite])

  const ensaiosComConvites = useMemo(() => {
    if (!convites.length) return ensaiosPorCena
    const juntos = { ...ensaiosPorCena }
    for (const e of convites) {
      if (minhasCenas.some(c => c.id === e.cenaId)) continue
      juntos[e.cenaId] = [...(juntos[e.cenaId] ?? []).filter(x => x.id !== e.id), e]
    }
    return juntos
  }, [ensaiosPorCena, convites, minhasCenas])

  return { cenas, minhasCenas, cenasDosEnsaios, ensaiosPorCena: ensaiosComConvites }
}
