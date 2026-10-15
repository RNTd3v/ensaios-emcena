import { addDoc, collection, deleteDoc, deleteField, doc, onSnapshot, query, updateDoc, where, type Query } from 'firebase/firestore'
import { db } from './config'
import type { LinkCompra } from '@/types'

/**
 * Links de sugestão de compra das equipes: coleção `linksCompra`. Cada link é de uma cena, de um
 * personagem ou geral (esse pode ser só da equipe).
 */

function assinar(q: Query, callback: (links: LinkCompra[]) => void) {
  return onSnapshot(
    q,
    snap =>
      callback(
        snap.docs
          .map(d => ({ ...d.data(), id: d.id }) as LinkCompra)
          .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm)),
      ),
    () => callback([]),
  )
}

export function subscribeToLinksCompraDaEquipe(equipeId: string, callback: (links: LinkCompra[]) => void) {
  return assinar(query(collection(db, 'linksCompra'), where('equipeId', '==', equipeId)), callback)
}

export function subscribeToLinksCompraDaCena(cenaId: string, callback: (links: LinkCompra[]) => void) {
  return assinar(query(collection(db, 'linksCompra'), where('cenaId', '==', cenaId)), callback)
}

export function subscribeToLinksCompraDoPersonagem(personagemKey: string, callback: (links: LinkCompra[]) => void) {
  return assinar(query(collection(db, 'linksCompra'), where('personagemKey', '==', personagemKey)), callback)
}

/** Página "Sugestões de compra": tudo menos os que são só da equipe. */
export function subscribeToLinksCompraPublicos(callback: (links: LinkCompra[]) => void) {
  return assinar(collection(db, 'linksCompra'), links => callback(links.filter(l => !l.somenteEquipe)))
}

export type LinkCompraDados = Pick<LinkCompra, 'alvo' | 'url'> &
  Partial<Pick<LinkCompra, 'somenteEquipe' | 'cenaId' | 'cenaNome' | 'personagemKey' | 'personagemNome' | 'produto' | 'loja' | 'preco' | 'descricao'>>

/** Sem protocolo vira https:// — o pessoal cola "loja.com/produto". */
export function normalizarUrl(url: string): string {
  const u = url.trim()
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(u) ? u : `https://${u}`
}

function campos(dados: LinkCompraDados) {
  const { alvo } = dados
  return {
    alvo,
    url: normalizarUrl(dados.url),
    somenteEquipe: alvo === 'geral' && dados.somenteEquipe ? true : undefined,
    cenaId: alvo === 'cena' ? dados.cenaId : undefined,
    cenaNome: alvo === 'cena' ? dados.cenaNome : undefined,
    personagemKey: alvo === 'personagem' ? dados.personagemKey : undefined,
    personagemNome: alvo === 'personagem' ? dados.personagemNome : undefined,
    produto: dados.produto?.trim() || undefined,
    loja: dados.loja?.trim() || undefined,
    preco: dados.preco !== undefined && Number.isFinite(dados.preco) && dados.preco >= 0 ? dados.preco : undefined,
    descricao: dados.descricao?.trim() || undefined,
  }
}

export async function createLinkCompra(equipe: { id: string; nome: string }, dados: LinkCompraDados, byUid: string): Promise<void> {
  const c = campos(dados)
  await addDoc(
    collection(db, 'linksCompra'),
    Object.fromEntries(
      Object.entries({ ...c, equipeId: equipe.id, equipeNome: equipe.nome, criadoPorUid: byUid, criadoEm: new Date().toISOString() }).filter(
        ([, v]) => v !== undefined,
      ),
    ),
  )
}

export async function updateLinkCompra(id: string, dados: LinkCompraDados): Promise<void> {
  const c = campos(dados)
  await updateDoc(
    doc(db, 'linksCompra', id),
    Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v ?? deleteField()])),
  )
}

export async function deleteLinkCompra(id: string): Promise<void> {
  await deleteDoc(doc(db, 'linksCompra', id))
}
