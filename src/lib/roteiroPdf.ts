/**
 * Recorte do PDF do roteiro (só no navegador do admin, carregado sob demanda — `pdf-lib` e
 * `pdfjs-dist` não entram no app de quem só assiste): copia as páginas da cena pra um PDF novo e
 * extrai o texto delas pra montar as falas.
 */
import { PDFDocument } from 'pdf-lib'
// Build "legacy" do pdf.js: a padrão (v6) usa APIs novíssimas do JS (ex.: Map.getOrInsertComputed)
// sem polyfill e quebra em quase todo navegador atual; a legacy traz os polyfills.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export interface RecortePdf {
  /** PDF só com as páginas pedidas. */
  pdf: Uint8Array
  /** Texto dessas páginas, uma linha do PDF por linha. */
  texto: string
  totalPaginas: number
}

interface ItemTexto {
  str: string
  hasEOL: boolean
  transform: number[]
}

/**
 * Os itens de texto da página. Não usa `getTextContent()`: ele percorre um ReadableStream com
 * `for await`, que o Safari não suporta ("undefined is not a function") — aqui lê o mesmo stream
 * com `getReader()`.
 */
async function itensDaPagina(pagina: pdfjs.PDFPageProxy): Promise<(ItemTexto | object)[]> {
  const leitor = (pagina.streamTextContent() as ReadableStream<{ items: (ItemTexto | object)[] }>).getReader()
  const itens: (ItemTexto | object)[] = []
  for (;;) {
    const { done, value } = await leitor.read()
    if (done) break
    itens.push(...value.items)
  }
  return itens
}

/** Texto de uma página, reconstruindo as linhas (quebra quando o item marca fim de linha ou a altura muda). */
async function textoDaPagina(pagina: pdfjs.PDFPageProxy): Promise<string> {
  let texto = ''
  let ultimoY: number | null = null
  for (const item of await itensDaPagina(pagina)) {
    if (!('str' in item)) continue
    const y = item.transform[5]
    if (ultimoY !== null && Math.abs(y - ultimoY) > 2 && !texto.endsWith('\n')) texto += '\n'
    texto += item.str
    if (item.hasEOL) texto += '\n'
    ultimoY = y
  }
  return texto
}

/** Páginas 1-indexadas, inclusivas. Lança erro com mensagem amigável se o intervalo não existir. */
export async function recortarPdf(original: ArrayBuffer, paginaInicio: number, paginaFim: number): Promise<RecortePdf> {
  const origem = await PDFDocument.load(original, { ignoreEncryption: true })
  const totalPaginas = origem.getPageCount()
  if (paginaInicio < 1 || paginaFim < paginaInicio || paginaFim > totalPaginas) {
    throw new Error(`O roteiro tem ${totalPaginas} páginas — confira o intervalo.`)
  }
  const indices = Array.from({ length: paginaFim - paginaInicio + 1 }, (_, i) => paginaInicio - 1 + i)

  const novo = await PDFDocument.create()
  for (const p of await novo.copyPages(origem, indices)) novo.addPage(p)
  const pdf = await novo.save()

  // `data` é transferido pro worker do pdf.js — cópia, pra não invalidar o buffer original.
  const tarefa = pdfjs.getDocument({ data: new Uint8Array(original.slice(0)) })
  const doc = await tarefa.promise
  const partes: string[] = []
  for (let n = paginaInicio; n <= paginaFim; n++) partes.push(await textoDaPagina(await doc.getPage(n)))
  await tarefa.destroy()

  return { pdf, texto: partes.join('\n'), totalPaginas }
}
