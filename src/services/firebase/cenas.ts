import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from './config'
import type { Cena, DiaSemana, FigurinoImagem, Musica, Personagem, UserRole } from '@/types'

export interface CenaInput {
  nome: string
  participantes: string[]
  liderUid?: string
  personagens: Personagem[]
  dias: DiaSemana[]
  /** Só um de horario/horarios deve vir preenchido — ver Cena em @/types. */
  horario?: string
  horarios?: Partial<Record<DiaSemana, string>>
  observacao?: string
}

function toIso(value: unknown): string | undefined {
  return (value as { toDate?: () => Date })?.toDate?.().toISOString()
}

function fromSnap(id: string, data: Record<string, unknown>): Cena {
  return {
    id,
    ...data,
    personagens: (data.personagens as Personagem[]) ?? [],
    assistentes: (data.assistentes as string[]) ?? [],
    figurinos: (data.figurinos as FigurinoImagem[]) ?? [],
    musicas: (data.musicas as Musica[]) ?? [],
    ativo: data.ativo !== false,
    createdAt: toIso(data.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(data.updatedAt),
    deactivatedAt: toIso(data.deactivatedAt),
  } as Cena
}

/** Retorna o id da cena criada — usado pra navegar direto pra tela de detalhe dela. */
export async function createCena(input: CenaInput, createdByUid: string): Promise<string> {
  const data: Record<string, unknown> = {
    nome: input.nome,
    participantes: input.participantes,
    personagens: input.personagens,
    dias: input.dias,
    ativo: true,
    createdByUid,
    createdAt: serverTimestamp(),
  }
  if (input.horario) data.horario = input.horario
  if (input.horarios) data.horarios = input.horarios
  if (input.observacao) data.observacao = input.observacao
  if (input.liderUid) data.liderUid = input.liderUid
  const ref = await addDoc(collection(db, 'cenas'), data)
  return ref.id
}

export async function updateCena(id: string, input: CenaInput, updatedByUid: string): Promise<void> {
  await updateDoc(doc(db, 'cenas', id), {
    nome: input.nome,
    participantes: input.participantes,
    personagens: input.personagens,
    liderUid: input.liderUid || deleteField(),
    dias: input.dias,
    horario: input.horario || deleteField(),
    horarios: input.horarios || deleteField(),
    observacao: input.observacao || deleteField(),
    updatedByUid,
    updatedAt: serverTimestamp(),
  })
}

/**
 * Updates pontuais usados na tela de detalhe da cena — cada um mexe só no(s) campo(s) dele,
 * sem passar pelo resto do documento (diferente de `updateCena`, que reescreve tudo).
 */
export async function updateCenaNome(id: string, nome: string, updatedByUid: string): Promise<void> {
  await updateDoc(doc(db, 'cenas', id), { nome, updatedByUid, updatedAt: serverTimestamp() })
}

export async function updateCenaLider(id: string, liderUid: string | undefined, updatedByUid: string): Promise<void> {
  await updateDoc(doc(db, 'cenas', id), {
    liderUid: liderUid || deleteField(),
    updatedByUid,
    updatedAt: serverTimestamp(),
  })
}

/** Assistentes da cena (sempre participantes dela) — admin ou líder. */
export async function updateCenaAssistentes(id: string, assistentes: string[], updatedByUid: string): Promise<void> {
  await updateDoc(doc(db, 'cenas', id), { assistentes, updatedByUid, updatedAt: serverTimestamp() })
}

export async function updateCenaRoteiro(
  id: string,
  roteiro: { referencia?: string; url?: string },
  updatedByUid: string,
): Promise<void> {
  await updateDoc(doc(db, 'cenas', id), {
    roteiroReferencia: roteiro.referencia || deleteField(),
    roteiroUrl: roteiro.url || deleteField(),
    updatedByUid,
    updatedAt: serverTimestamp(),
  })
}

export async function updateCenaPersonagens(id: string, personagens: Personagem[], updatedByUid: string): Promise<void> {
  await updateDoc(doc(db, 'cenas', id), { personagens, updatedByUid, updatedAt: serverTimestamp() })
}

export async function updateCenaParticipantes(id: string, participantes: string[], updatedByUid: string): Promise<void> {
  await updateDoc(doc(db, 'cenas', id), { participantes, updatedByUid, updatedAt: serverTimestamp() })
}

/** Admin ou o líder da cena podem mexer nas fotos de figurino (garantido também pelas storage.rules/firestore.rules). */
export async function updateCenaFigurinos(id: string, figurinos: FigurinoImagem[], updatedByUid: string): Promise<void> {
  await updateDoc(doc(db, 'cenas', id), { figurinos, updatedByUid, updatedAt: serverTimestamp() })
}

/** Só admin mexe nas músicas (garantido também pelas storage.rules/firestore.rules). */
export async function updateCenaMusicas(id: string, musicas: Musica[], updatedByUid: string): Promise<void> {
  await updateDoc(doc(db, 'cenas', id), { musicas, updatedByUid, updatedAt: serverTimestamp() })
}

export async function updateCenaAgenda(
  id: string,
  agenda: { dias: DiaSemana[]; horario?: string; horarios?: Partial<Record<DiaSemana, string>>; inicioEnsaios?: string },
  updatedByUid: string,
): Promise<void> {
  await updateDoc(doc(db, 'cenas', id), {
    dias: agenda.dias,
    horario: agenda.horario || deleteField(),
    horarios: agenda.horarios || deleteField(),
    inicioEnsaios: agenda.inicioEnsaios || deleteField(),
    updatedByUid,
    updatedAt: serverTimestamp(),
  })
}

/** "Excluir" uma cena: soft delete. Admin ou o líder da própria cena podem desativar. */
export async function deactivateCena(id: string, deactivatedByUid: string): Promise<void> {
  await updateDoc(doc(db, 'cenas', id), {
    ativo: false,
    deactivatedByUid,
    deactivatedAt: serverTimestamp(),
  })
}

/** Só admin reativa (garantido também pelas firestore.rules). */
export async function reactivateCena(id: string, reactivatedByUid: string): Promise<void> {
  await updateDoc(doc(db, 'cenas', id), {
    ativo: true,
    deactivatedByUid: deleteField(),
    deactivatedAt: deleteField(),
    updatedByUid: reactivatedByUid,
    updatedAt: serverTimestamp(),
  })
}

/** Exclusão de verdade, sem volta — só admin (garantido pelas firestore.rules). */
export async function deleteCenaPermanently(id: string): Promise<void> {
  await deleteDoc(doc(db, 'cenas', id))
}

/**
 * Admin vê todas as cenas (ativas e inativas); líder só as que ele lidera; participante só as que
 * ele participa. Cada caso exige um filtro diferente na query pra bater com a regra do Firestore
 * correspondente (`liderUid ==` ou `participantes array-contains`) — ver firestore.rules.
 * Filtrar por ativo/inativo é responsabilidade de quem consome a lista.
 */
export function subscribeToCenas(role: UserRole, uid: string, callback: (cenas: Cena[]) => void) {
  if (role === 'admin') {
    return onSnapshot(query(collection(db, 'cenas'), orderBy('createdAt', 'desc')), snap =>
      callback(snap.docs.map(d => fromSnap(d.id, d.data()))),
    )
  }
  // Líder vê as que lidera + as que participa (inclusive como assistente); participante só as
  // que participa. Duas queries juntas porque o Firestore não faz OR entre esses dois filtros
  // de um jeito que a regra consiga provar.
  const queries = [query(collection(db, 'cenas'), where('participantes', 'array-contains', uid))]
  if (role === 'lider') queries.push(query(collection(db, 'cenas'), where('liderUid', '==', uid)))
  const porQuery: (Map<string, Cena> | null)[] = queries.map(() => null)
  const emitir = () => {
    if (porQuery.some(m => m === null)) return // espera todas responderem uma vez
    const todas = new Map<string, Cena>()
    for (const m of porQuery) for (const [id, c] of m!) todas.set(id, c)
    callback([...todas.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
  }
  const unsubs = queries.map((q, i) =>
    onSnapshot(q, snap => {
      porQuery[i] = new Map(snap.docs.map(d => [d.id, fromSnap(d.id, d.data())]))
      emitir()
    }),
  )
  return () => unsubs.forEach(u => u())
}

/**
 * Cenas das quais `uid` é participante, independente do perfil — um líder ou admin também pode
 * estar no elenco de outras cenas (usado na Home pro card de próximo ensaio).
 */
export function subscribeToCenasDoParticipante(uid: string, callback: (cenas: Cena[]) => void) {
  const q = query(collection(db, 'cenas'), where('participantes', 'array-contains', uid))
  return onSnapshot(q, snap => callback(snap.docs.map(d => fromSnap(d.id, d.data()))))
}

/**
 * Cenas em que algum dependente (filho) de `responsavelUid` participa — pela lista
 * `responsaveisDependentes` que a Cloud Function mantém na cena (é o que a regra deixa ler).
 */
export function subscribeToCenasDosMeusDependentes(responsavelUid: string, callback: (cenas: Cena[]) => void) {
  const q = query(collection(db, 'cenas'), where('responsaveisDependentes', 'array-contains', responsavelUid))
  return onSnapshot(
    q,
    snap => callback(snap.docs.map(d => fromSnap(d.id, d.data()))),
    () => callback([]),
  )
}

/**
 * Uma cena específica, em tempo real — usado na tela de detalhe. `null` = não existe, foi
 * excluída, ou quem está vendo não tem permissão (regra do Firestore nega e o snapshot vira erro).
 */
export function subscribeToCena(id: string, callback: (cena: Cena | null) => void) {
  return onSnapshot(
    doc(db, 'cenas', id),
    snap => callback(snap.exists() ? fromSnap(snap.id, snap.data()) : null),
    () => callback(null),
  )
}
