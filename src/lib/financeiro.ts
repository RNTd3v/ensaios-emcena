import type { Entrada, FrenteArrecadacao, Gasto, GastoReembolso, GastoStatus } from '@/types'

export const FRENTES: { value: FrenteArrecadacao; label: string }[] = [
  { value: 'rifas', label: 'Rifas' },
  { value: 'doces', label: 'Doces' },
  { value: 'ofertas', label: 'Ofertas' },
  { value: 'outros', label: 'Outros' },
]

/** Frentes que se lança à mão (rifas vêm do app de rifas). */
export const FRENTES_MANUAIS = FRENTES.filter(f => f.value !== 'rifas') as { value: Entrada['frente']; label: string }[]

export const CATEGORIAS_GASTO: { value: string; label: string }[] = [
  { value: 'cenario', label: 'Cenário' },
  { value: 'figurino', label: 'Figurino' },
  { value: 'som_luz', label: 'Som e iluminação' },
  { value: 'objetos', label: 'Objetos de cena' },
  { value: 'alimentacao', label: 'Alimentação' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'divulgacao', label: 'Divulgação' },
  { value: 'material', label: 'Material' },
  { value: 'outros', label: 'Outros' },
]

export function categoriaLabel(value: string): string {
  return CATEGORIAS_GASTO.find(c => c.value === value)?.label ?? 'Outros'
}

export const GASTO_STATUS_LABEL: Record<GastoStatus, string> = { previsto: 'Previsto', pago: 'Pago' }

export const REEMBOLSO_LABEL: Record<GastoReembolso, string> = {
  nao_precisa: 'Não precisa',
  pendente: 'Reembolso pendente',
  reembolsado: 'Reembolsado',
}

export interface ResumoFinanceiro {
  meta: number
  porFrente: Record<FrenteArrecadacao, number>
  arrecadado: number
  gastoPago: number
  gastoPrevisto: number
  /** Arrecadado − gasto pago. */
  saldo: number
  /** Arrecadado − (pago + previsto): quanto sobra se tudo que está previsto for pago. */
  saldoProjetado: number
  reembolsoPendente: number
  porCategoria: { categoria: string; label: string; total: number }[]
  porCena: { chave: string; nome: string; total: number }[]
}

/** Junta meta, rifas (automático), entradas manuais e gastos num resumo só. */
export function resumir(meta: number | undefined, rifas: number, entradas: Entrada[], gastos: Gasto[]): ResumoFinanceiro {
  const porFrente: Record<FrenteArrecadacao, number> = { rifas, doces: 0, ofertas: 0, outros: 0 }
  for (const e of entradas) porFrente[e.frente] += e.valor
  const arrecadado = Object.values(porFrente).reduce((a, b) => a + b, 0)

  let gastoPago = 0
  let gastoPrevisto = 0
  let reembolsoPendente = 0
  const cat = new Map<string, number>()
  const cena = new Map<string, { nome: string; total: number }>()
  for (const g of gastos) {
    if (g.status === 'pago') gastoPago += g.valor
    else gastoPrevisto += g.valor
    if (g.reembolso === 'pendente') reembolsoPendente += g.valor
    cat.set(g.categoria, (cat.get(g.categoria) ?? 0) + g.valor)
    const chave = g.cenaId ?? ''
    const atual = cena.get(chave) ?? { nome: g.cenaNome ?? (g.cenaId ? 'Cena' : 'Geral'), total: 0 }
    atual.total += g.valor
    cena.set(chave, atual)
  }

  return {
    meta: meta ?? 0,
    porFrente,
    arrecadado,
    gastoPago,
    gastoPrevisto,
    saldo: arrecadado - gastoPago,
    saldoProjetado: arrecadado - gastoPago - gastoPrevisto,
    reembolsoPendente,
    porCategoria: [...cat.entries()]
      .map(([categoria, total]) => ({ categoria, label: categoriaLabel(categoria), total }))
      .sort((a, b) => b.total - a.total),
    porCena: [...cena.entries()].map(([chave, v]) => ({ chave, ...v })).sort((a, b) => b.total - a.total),
  }
}
