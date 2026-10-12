import { collection, doc, onSnapshot, runTransaction, serverTimestamp, setDoc, writeBatch, type Transaction } from 'firebase/firestore'
import { db } from './config'
import { personagemKey, type PersonagemAgregado } from '@/lib/personagens'
import type { Cena, Personagem, PersonagemCatalogo } from '@/types'

/**
 * Catálogo de personagens (só admin) + as operações da tela de Personagens, que mexem no
 * personagem em todas as cenas onde ele aparece de uma vez (transação, tudo ou nada — e sobre a
 * versão atual de cada cena, pra não desfazer o que outra pessoa salvou nesse meio-tempo).
 * O vínculo com pessoa exige que ela seja participante da cena — por isso vincular/adicionar
 * também inclui a pessoa em `participantes` quando ela ainda não está lá.
 */

function catalogoRef(key: string) {
  // encodeURIComponent porque o id do doc não pode conter '/'.
  return doc(db, 'personagens', encodeURIComponent(key))
}

function isDoAgregado(p: Personagem, agregado: PersonagemAgregado) {
  return personagemKey(p.nome, p.participanteUid) === agregado.key
}

export function subscribeToCatalogoPersonagens(callback: (personagens: PersonagemCatalogo[]) => void) {
  return onSnapshot(collection(db, 'personagens'), snap => {
    callback(
      snap.docs.map(d => {
        const data = d.data()
        return {
          id: d.id,
          nome: data.nome,
          participanteUid: data.participanteUid ?? undefined,
          createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.().toISOString() ?? new Date().toISOString(),
        }
      }),
    )
  })
}

export async function createPersonagem(nome: string, participanteUid: string | undefined): Promise<void> {
  await setDoc(catalogoRef(personagemKey(nome, participanteUid)), { nome: nome.trim(), participanteUid: participanteUid ?? null, createdAt: serverTimestamp() })
}

function dadosCatalogo(nome: string, participanteUid: string | undefined) {
  return { nome: nome.trim(), participanteUid: participanteUid ?? null }
}

/**
 * Aplica `alterar` nos personagens atuais de cada cena (relidos na transação) e, ao vincular,
 * inclui a pessoa em `participantes`. `catalogo` faz as gravações do catálogo na mesma transação.
 */
async function alterarCenas(
  cenaIds: string[],
  alterar: (personagens: Personagem[]) => Personagem[],
  participanteUid: string | undefined,
  byUid: string,
  catalogo: (tx: Transaction) => void,
): Promise<void> {
  const refs = [...new Set(cenaIds)].map(id => doc(db, 'cenas', id))
  await runTransaction(db, async tx => {
    const snaps = await Promise.all(refs.map(ref => tx.get(ref)))
    snaps.forEach((snap, i) => {
      const data = snap.data()
      if (!data) return
      const participantes = (data.participantes as string[] | undefined) ?? []
      tx.update(refs[i], {
        personagens: alterar((data.personagens as Personagem[] | undefined) ?? []),
        ...(participanteUid && !participantes.includes(participanteUid) && { participantes: [...participantes, participanteUid] }),
        updatedByUid: byUid,
        updatedAt: serverTimestamp(),
      })
    })
    catalogo(tx)
  })
}

/**
 * Garante que esses personagens continuem na base (catálogo) — chamado antes de tirá-los de uma
 * cena ou excluir a cena, pra que saiam só da cena e não da tela de Personagens.
 */
export async function preservarPersonagensNoCatalogo(personagens: Personagem[]): Promise<void> {
  if (!personagens.length) return
  const batch = writeBatch(db)
  for (const p of personagens) batch.set(catalogoRef(personagemKey(p.nome, p.participanteUid)), dadosCatalogo(p.nome, p.participanteUid), { merge: true })
  await batch.commit()
}

/** Renomeia e/ou troca a pessoa vinculada, em todas as cenas onde o personagem aparece. */
export async function updatePersonagem(
  agregado: PersonagemAgregado,
  input: { nome: string; participanteUid?: string },
  byUid: string,
): Promise<void> {
  const nome = input.nome.trim()
  await alterarCenas(
    agregado.ocorrencias.map(o => o.cena.id),
    personagens => personagens.map(p => (isDoAgregado(p, agregado) ? { ...p, nome, participanteUid: input.participanteUid } : p)),
    input.participanteUid,
    byUid,
    tx => {
      if (personagemKey(nome, input.participanteUid) !== agregado.key) tx.delete(catalogoRef(agregado.key))
      tx.set(catalogoRef(personagemKey(nome, input.participanteUid)), dadosCatalogo(nome, input.participanteUid), { merge: true })
    },
  )
}

/** Adiciona o personagem numa cena onde ele ainda não está, reaproveitando a ficha de outra cena. */
export async function addPersonagemNaCena(agregado: PersonagemAgregado, cena: Cena, byUid: string): Promise<void> {
  const ficha = agregado.ocorrencias.find(o => o.personagem.ficha)?.personagem.ficha
  const novo: Personagem = {
    id: crypto.randomUUID(),
    nome: agregado.nome,
    participanteUid: agregado.participanteUid,
    recorrente: agregado.ocorrencias.length > 0 || undefined,
    ficha,
  }
  await alterarCenas([cena.id], personagens => [...personagens, novo], agregado.participanteUid, byUid, tx =>
    tx.set(catalogoRef(personagemKey(agregado.nome, agregado.participanteUid)), dadosCatalogo(agregado.nome, agregado.participanteUid), { merge: true }),
  )
}

/**
 * Tira o personagem de uma cena. A pessoa vinculada continua como participante da cena (pode
 * estar lá por outro motivo) — removê-la é pela tela da cena. O catálogo garante que o
 * personagem continue na lista mesmo sem cena nenhuma.
 */
export async function removePersonagemDaCena(agregado: PersonagemAgregado, cena: Cena, byUid: string): Promise<void> {
  await alterarCenas([cena.id], personagens => personagens.filter(p => !isDoAgregado(p, agregado)), undefined, byUid, tx =>
    tx.set(catalogoRef(personagemKey(agregado.nome, agregado.participanteUid)), dadosCatalogo(agregado.nome, agregado.participanteUid), { merge: true }),
  )
}

/** Exclui o personagem de todas as cenas e do catálogo. */
export async function deletePersonagem(agregado: PersonagemAgregado, byUid: string): Promise<void> {
  await alterarCenas(
    agregado.ocorrencias.map(o => o.cena.id),
    personagens => personagens.filter(p => !isDoAgregado(p, agregado)),
    undefined,
    byUid,
    tx => tx.delete(catalogoRef(agregado.key)),
  )
}
