/** Lojas sugeridas no cadastro de links de compra — o domínio identifica a loja pelo link colado. */
const LOJAS: { nome: string; dominios: string[] }[] = [
  { nome: 'Shopee', dominios: ['shopee.com', 'shp.ee'] },
  { nome: 'Mercado Livre', dominios: ['mercadolivre.com', 'mercadolibre.com', 'meli.la'] },
  { nome: 'Amazon', dominios: ['amazon.com', 'amzn.to', 'a.co'] },
  { nome: 'Shein', dominios: ['shein.com'] },
  { nome: 'AliExpress', dominios: ['aliexpress.com', 'aliexpress.us', 'a.aliexpress.com'] },
  { nome: 'Temu', dominios: ['temu.com'] },
  { nome: 'Magazine Luiza', dominios: ['magazineluiza.com', 'magalu.com'] },
  { nome: 'Americanas', dominios: ['americanas.com'] },
  { nome: 'Casas Bahia', dominios: ['casasbahia.com'] },
  { nome: 'Renner', dominios: ['lojasrenner.com'] },
  { nome: 'Riachuelo', dominios: ['riachuelo.com'] },
  { nome: 'C&A', dominios: ['cea.com'] },
  { nome: 'Havan', dominios: ['havan.com'] },
  { nome: 'Leroy Merlin', dominios: ['leroymerlin.com'] },
  { nome: 'Kalunga', dominios: ['kalunga.com'] },
  { nome: 'Elo7', dominios: ['elo7.com'] },
  { nome: 'Centauro', dominios: ['centauro.com'] },
  { nome: 'Decathlon', dominios: ['decathlon.com'] },
]

export const LOJAS_SUGERIDAS = LOJAS.map(l => l.nome)

/** Nome da loja pelo link (ex.: "https://produto.mercadolivre.com.br/..." → "Mercado Livre"). */
export function lojaDaUrl(url: string): string | undefined {
  let host: string
  try {
    host = new URL(normalizarUrl(url)).hostname.toLowerCase()
  } catch {
    return undefined
  }
  return LOJAS.find(l => l.dominios.some(d => host === d || host.endsWith(`.${d}`) || host.startsWith(`${d}.`) || host.includes(`.${d}.`)))?.nome
}

/**
 * Página de produto da Shein ("...-p-562144461.html") com os parâmetros de rastreio da busca
 * (detailBusinessFrom, src_identifier...) às vezes abre outro produto — fica só o endereço dele.
 * Links curtos/de compartilhar da Shein precisam da query e ficam como estão.
 */
function limparShein(url: string): string {
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    if (!(host === 'shein.com' || host.endsWith('.shein.com')) || !/-p-\d+\.html$/i.test(u.pathname)) return url
    return `${u.origin}${u.pathname}`
  } catch {
    return url
  }
}

/**
 * Link limpo a partir do que foi colado. O "compartilhar" dos apps de loja manda texto junto
 * ("Confira X na Shopee! https://s.shopee.com.br/abc") — pega só o link. Sem protocolo vira
 * https:// — o pessoal cola "loja.com/produto".
 */
export function normalizarUrl(url: string): string {
  const u = url.trim()
  const http = u.match(/https?:\/\/[^\s<>"']+/i)
  if (http) return limparShein(http[0])
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(u)) return limparShein(u)
  const semEspaco = u.split(/\s+/).find(p => /^[^\s/]+\.[a-z]{2,}(\/|$)/i.test(p))
  return limparShein(`https://${semEspaco ?? u}`)
}
