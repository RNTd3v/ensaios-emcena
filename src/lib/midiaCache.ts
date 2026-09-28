/**
 * Músicas guardadas no aparelho (Cache Storage): cada pessoa baixa cada música uma vez só — as
 * próximas vezes tocam do celular, sem gastar o download do Storage, e funcionam sem internet.
 *
 * Não é o service worker que faz isso porque o player pede o áudio em pedaços (range requests), e
 * pedaços não dá pra guardar. Aqui o app baixa o arquivo inteiro na primeira vez que a música toca.
 * Depende do CORS do bucket liberado pro domínio do app (cors.json na raiz); sem isso o download
 * falha em silêncio e a música segue tocando direto do Storage, como antes.
 *
 * A URL de download muda quando o arquivo é trocado, então a versão velha nunca é servida — só
 * fica ocupando espaço até sair pelo limite de `MAX_MUSICAS`.
 */

const CACHE = 'musicas-v1'
const MAX_MUSICAS = 50

async function abrirCache(): Promise<Cache | null> {
  try {
    return 'caches' in window ? await caches.open(CACHE) : null
  } catch {
    return null
  }
}

/** A música guardada, como URL local (`blob:`) — `null` se ainda não foi baixada. Quem chama revoga a URL. */
export async function musicaGuardada(url: string): Promise<string | null> {
  try {
    const cache = await abrirCache()
    const resp = await cache?.match(url)
    if (!resp) return null
    return URL.createObjectURL(await resp.blob())
  } catch {
    return null
  }
}

const baixando = new Set<string>()

/** Baixa a música inteira e guarda (em segundo plano, sem atrapalhar o player). */
export async function guardarMusica(url: string): Promise<void> {
  if (baixando.has(url)) return
  baixando.add(url)
  try {
    const cache = await abrirCache()
    if (!cache || (await cache.match(url))) return
    const resp = await fetch(url, { mode: 'cors' })
    if (!resp.ok) return
    await cache.put(url, resp)
    // Mais antigas saem primeiro (a ordem das chaves é a de inclusão).
    const chaves = await cache.keys()
    for (const req of chaves.slice(0, Math.max(0, chaves.length - MAX_MUSICAS))) await cache.delete(req)
  } catch {
    // CORS não liberado, sem internet, sem espaço: segue tocando da rede.
  } finally {
    baixando.delete(url)
  }
}
