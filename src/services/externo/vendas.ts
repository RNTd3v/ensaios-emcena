/**
 * Totais públicos dos apps de vendas (outros projetos Firebase), lidos pela API REST do Firestore —
 * sem login, só documentos com leitura pública (só somas, nenhum dado de comprador/pedido). Ver
 * docs/integracao-vendas.md.
 *
 * - Rifas (`vendas-rifas-emcena`): `stats/public` { totalArrecadado, totalVendido }.
 * - Doces (`vendas-doces-emcena575`): `stats/public` { porMeta: { [metaId]: { total, pedidos } } } —
 *   conta só a meta dos doces escolhida em Metas e gastos (`FinanceiroConfig.docesMetaId`), porque o
 *   app de doces também vende pra outras causas.
 */

/** Endereços públicos dos apps de vendas (links no menu e em Metas e gastos). */
export const APP_RIFAS_URL = 'https://vendas-rifas-emcena.web.app'
export const APP_DOCES_URL = 'https://vendas-doces-emcena575.web.app'

const BASE = 'https://firestore.googleapis.com/v1/projects'
const RIFAS_STATS_URL = `${BASE}/vendas-rifas-emcena/databases/(default)/documents/stats/public`
const DOCES_STATS_URL = `${BASE}/vendas-doces-emcena575/databases/(default)/documents/stats/public`
const DOCES_METAS_URL = `${BASE}/vendas-doces-emcena575/databases/(default)/documents/metas`

export interface TotalExterno {
  arrecadado: number
  quantidade: number
  atualizadoEm?: string
  /** O doc de total ainda não existe no outro app (ele nunca gerou) — não é erro de leitura. */
  naoGerado?: boolean
}

export interface MetaDoces {
  id: string
  titulo: string
  ativo: boolean
}

type Campo = {
  integerValue?: string
  doubleValue?: number
  stringValue?: string
  booleanValue?: boolean
  timestampValue?: string
  mapValue?: { fields?: Record<string, Campo> }
}

function numero(c: Campo | undefined): number {
  if (!c) return 0
  if (c.doubleValue !== undefined) return c.doubleValue
  return Number(c.integerValue ?? 0)
}

/** `'naoGerado'` = 404 (o outro app ainda não criou o doc); `null` = erro de verdade. */
async function lerDoc(url: string): Promise<Record<string, Campo> | 'naoGerado' | null> {
  try {
    const res = await fetch(url)
    if (res.status === 404) return 'naoGerado'
    if (!res.ok) return null
    const json = (await res.json()) as { fields?: Record<string, Campo> }
    return json.fields ?? {}
  } catch {
    return null
  }
}

/** `null` = não deu pra ler (sem internet, doc inexistente, regra fechada). */
export async function lerTotalRifas(): Promise<TotalExterno | null> {
  const f = await lerDoc(RIFAS_STATS_URL)
  if (!f) return null
  if (f === 'naoGerado') return { arrecadado: 0, quantidade: 0, naoGerado: true }
  return { arrecadado: numero(f.totalArrecadado), quantidade: numero(f.totalVendido), atualizadoEm: f.updatedAt?.timestampValue }
}

/** Total dos doces só da meta `metaId`. `null` = não deu pra ler; meta sem pedidos = zero. */
export async function lerTotalDoces(metaId: string): Promise<TotalExterno | null> {
  const f = await lerDoc(DOCES_STATS_URL)
  if (!f) return null
  if (f === 'naoGerado') return { arrecadado: 0, quantidade: 0, naoGerado: true }
  const daMeta = f.porMeta?.mapValue?.fields?.[metaId]?.mapValue?.fields
  return {
    arrecadado: numero(daMeta?.total),
    quantidade: numero(daMeta?.pedidos),
    atualizadoEm: f.updatedAt?.timestampValue,
  }
}

/** Metas cadastradas no app de doces (leitura pública lá), pra escolher qual conta pro musical. */
export async function listarMetasDoces(): Promise<MetaDoces[] | null> {
  try {
    const res = await fetch(DOCES_METAS_URL)
    if (!res.ok) return null
    const json = (await res.json()) as { documents?: { name: string; fields?: Record<string, Campo> }[] }
    return (json.documents ?? [])
      .map(d => ({
        id: d.name.split('/').pop() ?? '',
        titulo: d.fields?.titulo?.stringValue ?? 'Sem título',
        ativo: d.fields?.ativo?.booleanValue ?? false,
      }))
      .sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.titulo.localeCompare(b.titulo, 'pt-BR'))
  } catch {
    return null
  }
}
