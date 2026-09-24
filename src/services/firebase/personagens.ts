import { collection, doc, onSnapshot, serverTimestamp, setDoc, writeBatch, type WriteBatch } from 'firebase/firestore'
import { db } from './config'
import { personagemKey, type PersonagemAgregado } from '@/lib/personagens'
import type { Cena, Personagem, PersonagemCatalogo } from '@/types'

/**
 * Catálogo de personagens (só admin) + as operações da tela de Personagens, que mexem no
 * personagem em todas as cenas onde ele aparece de uma vez (writeBatch, tudo ou nada).
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

function upsertCatalogo(batch: WriteBatch, nome: string, participanteUid: string | undefined) {
  batch.set(catalogoRef(personagemKey(nome, participanteUid)), { nome: nome.trim(), participanteUid: participanteUid ?? null }, { merge: true })
}

function updateCenaNoBatch(batch: WriteBatch, cena: Cena, personagens: Personagem[], participanteUid: string | undefined, byUid: string) {
  const participantes =
    participanteUid && !cena.participantes.includes(participanteUid) ? [...cena.participantes, participanteUid] : cena.participantes
  batch.update(doc(db, 'cenas', cena.id), { personagens, participantes, updatedByUid: byUid, updatedAt: serverTimestamp() })
}

/**
 * Garante que esses personagens continuem na base (catálogo) — chamado antes de tirá-los de uma
 * cena ou excluir a cena, pra que saiam só da cena e não da tela de Personagens.
 */
export async function preservarPersonagensNoCatalogo(personagens: Personagem[]): Promise<void> {
  if (!personagens.length) return
  const batch = writeBatch(db)
  for (const p of personagens) upsertCatalogo(batch, p.nome, p.participanteUid)
  await batch.commit()
}

/** Renomeia e/ou troca a pessoa vinculada, em todas as cenas onde o personagem aparece. */
export async function updatePersonagem(
  agregado: PersonagemAgregado,
  input: { nome: string; participanteUid?: string },
  byUid: string,
): Promise<void> {
  const nome = input.nome.trim()
  const batch = writeBatch(db)
  for (const cena of new Set(agregado.ocorrencias.map(o => o.cena))) {
    const personagens = cena.personagens.map(p =>
      isDoAgregado(p, agregado) ? { ...p, nome, participanteUid: input.participanteUid } : p,
    )
    updateCenaNoBatch(batch, cena, personagens, input.participanteUid, byUid)
  }
  if (personagemKey(nome, input.participanteUid) !== agregado.key) batch.delete(catalogoRef(agregado.key))
  upsertCatalogo(batch, nome, input.participanteUid)
  await batch.commit()
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
  const batch = writeBatch(db)
  updateCenaNoBatch(batch, cena, [...cena.personagens, novo], agregado.participanteUid, byUid)
  upsertCatalogo(batch, agregado.nome, agregado.participanteUid)
  await batch.commit()
}

/**
 * Tira o personagem de uma cena. A pessoa vinculada continua como participante da cena (pode
 * estar lá por outro motivo) — removê-la é pela tela da cena. O catálogo garante que o
 * personagem continue na lista mesmo sem cena nenhuma.
 */
export async function removePersonagemDaCena(agregado: PersonagemAgregado, cena: Cena, byUid: string): Promise<void> {
  const batch = writeBatch(db)
  batch.update(doc(db, 'cenas', cena.id), {
    personagens: cena.personagens.filter(p => !isDoAgregado(p, agregado)),
    updatedByUid: byUid,
    updatedAt: serverTimestamp(),
  })
  upsertCatalogo(batch, agregado.nome, agregado.participanteUid)
  await batch.commit()
}

/** Exclui o personagem de todas as cenas e do catálogo. */
export async function deletePersonagem(agregado: PersonagemAgregado, byUid: string): Promise<void> {
  const batch = writeBatch(db)
  for (const cena of new Set(agregado.ocorrencias.map(o => o.cena))) {
    batch.update(doc(db, 'cenas', cena.id), {
      personagens: cena.personagens.filter(p => !isDoAgregado(p, agregado)),
      updatedByUid: byUid,
      updatedAt: serverTimestamp(),
    })
  }
  batch.delete(catalogoRef(agregado.key))
  await batch.commit()
}
