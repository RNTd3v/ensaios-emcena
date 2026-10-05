import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from './config'
import type { AusenciaMotivo, Treinamento, TreinamentoPublico, TreinamentoSessao } from '@/types'

/**
 * Treinamentos (só admin cadastra — ver firestore.rules): as infos ficam em `treinamentos/{id}` e
 * cada dia/horário vira um doc em `treinamentoSessoes`, com a resposta de presença igual à do
 * ensaio (`presencas`/`ausentes` + motivo privado em `treinamentoSessoes/{id}/ausencias/{uid}`).
 * A Cloud Function `treinamentoCriado` avisa quem precisa confirmar.
 */

function toIso(value: unknown): string {
  return (value as { toDate?: () => Date })?.toDate?.().toISOString() ?? new Date().toISOString()
}

export interface TreinamentoInput {
  titulo: string
  descricao: string
  roupa?: string
  levar?: string
  local?: string
  publico: TreinamentoPublico
  pessoas: string[]
}

export interface SessaoInput {
  data: string
  horario: string
}

function dadosTreinamento(input: TreinamentoInput) {
  return {
    titulo: input.titulo.trim(),
    descricao: input.descricao.trim(),
    roupa: input.roupa?.trim() ?? '',
    levar: input.levar?.trim() ?? '',
    local: input.local?.trim() ?? '',
    publico: input.publico,
    pessoas: input.publico === 'pessoas' ? input.pessoas : [],
  }
}

export function subscribeToTreinamentos(callback: (lista: Treinamento[]) => void) {
  return onSnapshot(
    collection(db, 'treinamentos'),
    snap => callback(snap.docs.map(d => ({ ...d.data(), id: d.id, createdAt: toIso(d.data().createdAt) }) as Treinamento)),
    () => callback([]),
  )
}

function sessaoFromSnap(id: string, data: Record<string, unknown>): TreinamentoSessao {
  return { ...data, id, presencas: (data.presencas as string[]) ?? [], ausentes: (data.ausentes as string[]) ?? [] } as TreinamentoSessao
}

function ordenarSessoes(lista: TreinamentoSessao[]): TreinamentoSessao[] {
  return lista.sort((a, b) => a.data.localeCompare(b.data) || a.horario.localeCompare(b.horario))
}

/** Sessões de hoje em diante (de todos os treinamentos), em ordem cronológica. */
export function subscribeToProximasSessoes(desde: string, callback: (lista: TreinamentoSessao[]) => void) {
  return onSnapshot(
    query(collection(db, 'treinamentoSessoes'), where('data', '>=', desde)),
    snap => callback(ordenarSessoes(snap.docs.map(d => sessaoFromSnap(d.id, d.data())))),
    () => callback([]),
  )
}

/** Todas as sessões (lista da página de treinamentos — inclui as que já passaram). */
export function subscribeToTodasSessoes(callback: (lista: TreinamentoSessao[]) => void) {
  return onSnapshot(
    collection(db, 'treinamentoSessoes'),
    snap => callback(ordenarSessoes(snap.docs.map(d => sessaoFromSnap(d.id, d.data())))),
    () => callback([]),
  )
}

export async function createTreinamento(input: TreinamentoInput, sessoes: SessaoInput[], byUid: string): Promise<string> {
  // Num batch só: quando a Cloud Function do aviso rodar, as sessões já existem.
  const batch = writeBatch(db)
  const ref = doc(collection(db, 'treinamentos'))
  batch.set(ref, { ...dadosTreinamento(input), createdByUid: byUid, createdAt: serverTimestamp() })
  for (const s of sessoes) {
    batch.set(doc(collection(db, 'treinamentoSessoes')), { treinamentoId: ref.id, data: s.data, horario: s.horario, presencas: [], ausentes: [] })
  }
  await batch.commit()
  return ref.id
}

/** Apaga uma sessão com os motivos de ausência dela. */
async function apagarSessoes(ids: string[]): Promise<void> {
  const batch = writeBatch(db)
  for (const id of ids) {
    const ausencias = await getDocs(collection(db, 'treinamentoSessoes', id, 'ausencias'))
    ausencias.forEach(a => batch.delete(a.ref))
    batch.delete(doc(db, 'treinamentoSessoes', id))
  }
  await batch.commit()
}

/**
 * Salva a edição. As sessões são casadas pela data: dia que continua mantém as respostas (só o
 * horário é atualizado); dia removido é apagado com as respostas; dia novo começa sem resposta.
 */
export async function updateTreinamento(
  id: string,
  input: TreinamentoInput,
  sessoes: SessaoInput[],
  existentes: TreinamentoSessao[],
): Promise<void> {
  const batch = writeBatch(db)
  batch.update(doc(db, 'treinamentos', id), dadosTreinamento(input))
  for (const s of sessoes) {
    const atual = existentes.find(e => e.data === s.data)
    if (!atual) batch.set(doc(collection(db, 'treinamentoSessoes')), { treinamentoId: id, data: s.data, horario: s.horario, presencas: [], ausentes: [] })
    else if (atual.horario !== s.horario) batch.update(doc(db, 'treinamentoSessoes', atual.id), { horario: s.horario })
  }
  await batch.commit()
  const removidas = existentes.filter(e => !sessoes.some(s => s.data === e.data)).map(e => e.id)
  if (removidas.length) await apagarSessoes(removidas)
}

export async function deleteTreinamento(id: string, sessoes: TreinamentoSessao[]): Promise<void> {
  await apagarSessoes(sessoes.map(s => s.id))
  const batch = writeBatch(db)
  batch.delete(doc(db, 'treinamentos', id))
  await batch.commit()
}

// ---------- Presença (mesmas regras do ensaio — ver RespostaPresenca) ----------

function ausenciaRef(sessaoId: string, uid: string) {
  return doc(db, 'treinamentoSessoes', sessaoId, 'ausencias', uid)
}

export async function confirmarPresencaTreinamento(sessaoId: string, uid: string): Promise<void> {
  const batch = writeBatch(db)
  batch.update(doc(db, 'treinamentoSessoes', sessaoId), { presencas: arrayUnion(uid), ausentes: arrayRemove(uid) })
  batch.delete(ausenciaRef(sessaoId, uid))
  await batch.commit()
}

export async function registrarAusenciaTreinamento(sessaoId: string, uid: string, motivo: string): Promise<void> {
  const batch = writeBatch(db)
  batch.update(doc(db, 'treinamentoSessoes', sessaoId), { presencas: arrayRemove(uid), ausentes: arrayUnion(uid) })
  batch.set(ausenciaRef(sessaoId, uid), { uid, motivo: motivo.trim(), registradaEm: new Date().toISOString() })
  await batch.commit()
}

export async function desfazerAusenciaTreinamento(sessaoId: string, uid: string): Promise<void> {
  const batch = writeBatch(db)
  batch.update(doc(db, 'treinamentoSessoes', sessaoId), { ausentes: arrayRemove(uid) })
  batch.delete(ausenciaRef(sessaoId, uid))
  await batch.commit()
}

export function subscribeToMinhaAusenciaTreinamento(sessaoId: string, uid: string, callback: (a: AusenciaMotivo | null) => void) {
  return onSnapshot(
    ausenciaRef(sessaoId, uid),
    snap => callback(snap.exists() ? (snap.data() as AusenciaMotivo) : null),
    () => callback(null),
  )
}

/** Motivos de todos que não vão (só admin lê todos). */
export function subscribeToAusenciasSessao(sessaoId: string, callback: (porUid: Record<string, AusenciaMotivo>) => void) {
  return onSnapshot(
    collection(db, 'treinamentoSessoes', sessaoId, 'ausencias'),
    snap => callback(Object.fromEntries(snap.docs.map(d => [d.id, d.data() as AusenciaMotivo]))),
    () => callback({}),
  )
}

/** Se o treinamento vale pra `uid` (`ehElenco` = tem personagem em alguma cena ativa). */
export function treinamentoValePara(t: Pick<Treinamento, 'publico' | 'pessoas'>, uid: string, ehElenco: boolean | undefined): boolean {
  if (t.publico === 'elenco') return !!ehElenco
  if (t.publico === 'pessoas') return !!t.pessoas?.includes(uid)
  return true
}

/** uids com personagem em alguma cena ativa — quem recebe treinamento "só elenco". */
export function uidsDoElenco(cenas: { ativo: boolean; personagens: { participanteUid?: string }[] }[]): Set<string> {
  return new Set(cenas.filter(c => c.ativo).flatMap(c => c.personagens.map(p => p.participanteUid).filter((u): u is string => !!u)))
}
