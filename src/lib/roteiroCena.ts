/**
 * Leitura do texto do roteiro (extraído do PDF) em blocos — falas por personagem e direções de cena.
 * Formato do roteiro do musical:
 *
 *   NOEMI [FALADO]                      ← quem fala + como (falado/cantado)
 *   Eu confiei.                         ← a fala, até o próximo nome
 *   (Enquanto fala caminha...)          ← rubrica (dentro da fala)
 *   [CORTE MUSICAL]                     ← direção de cena
 *
 * Também aceita "NOME: fala" na mesma linha.
 */

export interface LinhaFala {
  texto: string
  /** Linha entre parênteses (rubrica), dentro da fala. */
  rubrica?: boolean
}

export type BlocoRoteiro =
  | {
      tipo: 'fala'
      /** Como está no roteiro (ex.: "NOEMI", "NOEMI E BOAZ"). */
      personagem: string
      /** O que vem entre colchetes depois do nome, em minúsculas (ex.: "falado", "cantado"). */
      modo?: string
      linhas: LinhaFala[]
    }
  | { tipo: 'direcao'; texto: string }

/** Pra comparar nomes: sem acento, minúsculo, espaços normalizados. */
export function normalizarTexto(t: string): string {
  return t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

const temLetra = /\p{L}/u

/** Nome de personagem: tem letra e está todo em maiúsculas. */
function ehNome(t: string): boolean {
  const s = t.trim()
  return s.length > 0 && s.length <= 50 && temLetra.test(s) && s === s.toLocaleUpperCase('pt-BR')
}

/** "NOEMI [FALADO]" → { personagem, modo }. */
function cabecalhoFala(linha: string): { personagem: string; modo?: string; resto?: string } | null {
  const comColchete = linha.match(/^([^[\]()]+?)\s*\[([^\]]+)\]\s*$/)
  if (comColchete && ehNome(comColchete[1])) return { personagem: comColchete[1].trim(), modo: comColchete[2].trim().toLowerCase() }
  const comDoisPontos = linha.match(/^([^:[\]()]{2,50}):\s*(.*)$/)
  if (comDoisPontos && ehNome(comDoisPontos[1])) return { personagem: comDoisPontos[1].trim(), resto: comDoisPontos[2].trim() || undefined }
  return null
}

export function lerRoteiro(texto: string): BlocoRoteiro[] {
  const blocos: BlocoRoteiro[] = []
  let fala: Extract<BlocoRoteiro, { tipo: 'fala' }> | null = null
  // Parêntese/colchete aberto que continua nas linhas seguintes.
  let aberto: { fecha: string; partes: string[]; tipo: 'rubrica' | 'direcao' } | null = null

  function fecharAberto() {
    if (!aberto) return
    const t = aberto.partes.join(' ')
    if (aberto.tipo === 'rubrica' && fala) fala.linhas.push({ texto: t, rubrica: true })
    else blocos.push({ tipo: 'direcao', texto: t })
    aberto = null
  }

  for (const bruta of texto.split('\n')) {
    const linha = bruta.replace(/\s+/g, ' ').trim()
    if (!linha || /^\d+$/.test(linha)) continue // vazia ou número de página

    if (aberto) {
      aberto.partes.push(linha)
      if (linha.endsWith(aberto.fecha)) fecharAberto()
      continue
    }

    const cab = cabecalhoFala(linha)
    if (cab) {
      fala = { tipo: 'fala', personagem: cab.personagem, ...(cab.modo ? { modo: cab.modo } : {}), linhas: [] }
      if (cab.resto) fala.linhas.push({ texto: cab.resto })
      blocos.push(fala)
      continue
    }

    if (linha.startsWith('[')) {
      // Direção de cena encerra a fala atual.
      fala = null
      aberto = { fecha: ']', partes: [linha], tipo: 'direcao' }
      if (linha.endsWith(']')) fecharAberto()
      continue
    }

    if (linha.startsWith('(')) {
      aberto = { fecha: ')', partes: [linha], tipo: fala ? 'rubrica' : 'direcao' }
      if (linha.endsWith(')')) fecharAberto()
      continue
    }

    if (fala) fala.linhas.push({ texto: linha })
    else blocos.push({ tipo: 'direcao', texto: linha })
  }
  fecharAberto()
  // Fala sem nenhuma linha (nome no fim da página, por exemplo) não serve pra nada.
  return blocos.filter(b => b.tipo === 'direcao' || b.linhas.length > 0)
}

/**
 * Se a fala é de um dos `meusPersonagens` (nomes como cadastrados na cena). "NOEMI E BOAZ" conta
 * pra Noemi e pro Boaz.
 */
export function falaDe(personagemDoRoteiro: string, meusPersonagens: string[]): boolean {
  const palavras = ` ${normalizarTexto(personagemDoRoteiro).replace(/[^a-z0-9 ]/g, ' ')} `.replace(/\s+/g, ' ')
  return meusPersonagens.some(nome => {
    const n = normalizarTexto(nome).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
    return !!n && palavras.includes(` ${n} `)
  })
}

/**
 * Corta o texto entre dois marcadores (opcionais): começa na linha que contém `inicio` e para
 * antes da linha que contém `fim`. Pra cena que começa/termina no meio da página.
 */
export function recortarTexto(texto: string, inicio?: string, fim?: string): string {
  let linhas = texto.split('\n')
  const ini = inicio?.trim() ? normalizarTexto(inicio) : ''
  const f = fim?.trim() ? normalizarTexto(fim) : ''
  if (ini) {
    const i = linhas.findIndex(l => normalizarTexto(l).includes(ini))
    if (i >= 0) linhas = linhas.slice(i)
  }
  if (f) {
    const j = linhas.findIndex((l, idx) => idx > 0 && normalizarTexto(l).includes(f))
    if (j >= 0) linhas = linhas.slice(0, j)
  }
  return linhas.join('\n')
}
