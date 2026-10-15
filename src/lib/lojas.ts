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
    host = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`).hostname.toLowerCase()
  } catch {
    return undefined
  }
  return LOJAS.find(l => l.dominios.some(d => host === d || host.endsWith(`.${d}`) || host.startsWith(`${d}.`) || host.includes(`.${d}.`)))?.nome
}
