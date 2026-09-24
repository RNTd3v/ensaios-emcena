import { useCallback, useEffect, useMemo, useState } from 'react'
import { subscribeToEntradas, subscribeToFinanceiroConfig, subscribeToGastos } from '@/services/firebase/financeiro'
import { lerTotalDoces, lerTotalRifas, type TotalExterno } from '@/services/externo/vendas'
import { resumir } from '@/lib/financeiro'
import type { Entrada, FinanceiroConfig, Gasto } from '@/types'

/**
 * Tudo de metas e gastos junto: config (meta, equipe), entradas manuais, gastos (tempo real) e o
 * total das rifas (lido do app de rifas ao montar e em `atualizarVendas`).
 */
export function useFinanceiro() {
  const [config, setConfig] = useState<FinanceiroConfig | null>(null)
  const [entradas, setEntradas] = useState<Entrada[] | null>(null)
  const [gastos, setGastos] = useState<Gasto[] | null>(null)
  const [rifas, setRifas] = useState<TotalExterno | null | undefined>(undefined)
  const [doces, setDoces] = useState<TotalExterno | null | undefined>(undefined)

  useEffect(() => subscribeToFinanceiroConfig(setConfig), [])
  useEffect(() => subscribeToEntradas(setEntradas), [])
  useEffect(() => subscribeToGastos(setGastos), [])

  const docesMetaId = config?.docesMetaId
  const atualizarVendas = useCallback(() => {
    setRifas(undefined)
    lerTotalRifas().then(setRifas)
    if (docesMetaId) {
      setDoces(undefined)
      lerTotalDoces(docesMetaId).then(setDoces)
    } else {
      setDoces(null)
    }
  }, [docesMetaId])
  useEffect(atualizarVendas, [atualizarVendas])

  const resumo = useMemo(() => {
    const base = resumir(config?.metaTotal, rifas?.arrecadado ?? 0, entradas ?? [], gastos ?? [])
    // Doces integrados (meta dos doces escolhida) somam por cima dos lançamentos manuais.
    if (docesMetaId && doces) {
      base.porFrente.doces += doces.arrecadado
      base.arrecadado += doces.arrecadado
      base.saldo += doces.arrecadado
      base.saldoProjetado += doces.arrecadado
    }
    return base
  }, [config?.metaTotal, rifas, doces, docesMetaId, entradas, gastos])

  return {
    config,
    entradas,
    gastos,
    rifas,
    /** Total dos doces da meta escolhida — `undefined` carregando, `null` sem integração ou erro. */
    doces,
    docesIntegrado: !!docesMetaId,
    resumo,
    carregado: config !== null && entradas !== null && gastos !== null,
    atualizarVendas,
  }
}
