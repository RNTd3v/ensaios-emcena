/**
 * Totais públicos dos apps de vendas (outros projetos Firebase), lidos pela API REST do Firestore —
 * sem login, só documentos com leitura pública. Ver docs/integracao-vendas.md.
 *
 * - Rifas (`vendas-rifas-emcena`): `stats/public` { totalArrecadado, totalVendido } — já existe,
 *   atualizado pelo app de rifas quando o admin dele abre a tela Admin.
 * - Doces (`vendas-doces-emcena575`): ainda NÃO tem total público; até ter, doces entram como
 *   lançamento manual aqui. `DOCES_INTEGRADO` liga a leitura quando o outro app estiver pronto.
 */

const RIFAS_STATS_URL =
  'https://firestore.googleapis.com/v1/projects/vendas-rifas-emcena/databases/(default)/documents/stats/public'
const DOCES_STATS_URL =
  'https://firestore.googleapis.com/v1/projects/vendas-doces-emcena575/databases/(default)/documents/stats/public'

/** Ligar depois que o app de doces publicar `stats/public` (e aí parar de lançar doces à mão). */
export const DOCES_INTEGRADO = false

export interface TotalExterno {
  arrecadado: number
  quantidade: number
  atualizadoEm?: string
}

type Campo = { integerValue?: string; doubleValue?: number; timestampValue?: string }

function numero(c: Campo | undefined): number {
  if (!c) return 0
  if (c.doubleValue !== undefined) return c.doubleValue
  return Number(c.integerValue ?? 0)
}

async function lerStats(url: string, campoQtd: string): Promise<TotalExterno | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const json = (await res.json()) as { fields?: Record<string, Campo> }
    const f = json.fields ?? {}
    return { arrecadado: numero(f.totalArrecadado), quantidade: numero(f[campoQtd]), atualizadoEm: f.updatedAt?.timestampValue }
  } catch {
    return null
  }
}

/** `null` = não deu pra ler (sem internet, doc inexistente, regra fechada). */
export function lerTotalRifas(): Promise<TotalExterno | null> {
  return lerStats(RIFAS_STATS_URL, 'totalVendido')
}

export function lerTotalDoces(): Promise<TotalExterno | null> {
  return DOCES_INTEGRADO ? lerStats(DOCES_STATS_URL, 'totalPedidos') : Promise.resolve(null)
}
