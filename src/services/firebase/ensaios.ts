import { addDoc, arrayRemove, arrayUnion, collection, deleteField, doc, onSnapshot, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore'
import { db } from './config'
import type { AusenciaMotivo, Cena, Ensaio, Inscricao } from '@/types'

function toIso(value: unknown): string | undefined {
  return (value as { toDate?: () => Date })?.toDate?.().toISOString()
}

function fromSnap(id: string, data: Record<string, unknown>): Ensaio {
  return {
    id,
    ...data,
    presencas: (data.presencas as string[]) ?? [],
    confirmedAt: toIso(data.confirmedAt) ?? new Date().toISOString(),
    canceledAt: toIso(data.canceledAt),
    createdAt: toIso(data.createdAt) ?? new Date().toISOString(),
    finalizadoAt: toIso(data.finalizadoAt),
  } as Ensaio
}

export async function createEnsaio(
  cenaId: string,
  data: string,
  horario: string,
  confirmedByUid: string,
  obrigatorios?: string[],
  flags?: { geral?: boolean; comFigurino?: boolean },
): Promise<string> {
  const ref = await addDoc(collection(db, 'ensaios'), {
    cenaId,
    data,
    horario,
    presencas: [],
    ...(obrigatorios?.length ? { obrigatorios } : {}),
    ...(flags?.geral ? { geral: true } : {}),
    ...(flags?.comFigurino ? { comFigurino: true } : {}),
    confirmedByUid,
    confirmedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  })
  return ref.id
}

/** Define quais personagens têm presença obrigatória nesse ensaio específico. */
export async function updateEnsaioObrigatorios(id: string, personagemIds: string[]): Promise<void> {
  await updateDoc(doc(db, 'ensaios', id), personagemIds.length ? { obrigatorios: personagemIds } : { obrigatorios: deleteField() })
}

/** Corrige o horário de um ensaio já confirmado. */
export async function updateEnsaioHorario(id: string, horario: string): Promise<void> {
  await updateDoc(doc(db, 'ensaios', id), { horario })
}

/**
 * Edição das infos do ensaio pelo modal da página do ensaio (admin/líder), num update só.
 * `presencas` só vem quando o ensaio já aconteceu (modo consulta) — ao vivo a presença é pela lista.
 */
export async function updateEnsaioInfo(
  id: string,
  info: { horario: string; local: string; geral: boolean; comFigurino: boolean; obrigatorios: string[]; presencas?: string[] },
): Promise<void> {
  await updateDoc(doc(db, 'ensaios', id), {
    horario: info.horario,
    local: info.local.trim() || deleteField(),
    geral: info.geral || deleteField(),
    comFigurino: info.comFigurino || deleteField(),
    obrigatorios: info.obrigatorios.length ? info.obrigatorios : deleteField(),
    ...(info.presencas ? { presencas: info.presencas } : {}),
  })
}

/** Define (ou limpa, se vazio) o local do ensaio. */
export async function updateEnsaioLocal(id: string, local: string): Promise<void> {
  await updateDoc(doc(db, 'ensaios', id), { local: local.trim() || deleteField() })
}

/** Marca/desmarca as flags "ensaio geral" e "ensaio com figurino" desse ensaio. */
export async function updateEnsaioFlags(id: string, flags: { geral: boolean; comFigurino: boolean }): Promise<void> {
  await updateDoc(doc(db, 'ensaios', id), {
    geral: flags.geral || deleteField(),
    comFigurino: flags.comFigurino || deleteField(),
  })
}

/** Cancela um ensaio confirmado — mantém o registro (pra mostrar "cancelado por Fulano"), não apaga. */
export async function cancelarEnsaio(id: string, canceledByUid: string): Promise<void> {
  await updateDoc(doc(db, 'ensaios', id), { canceledByUid, canceledAt: serverTimestamp() })
}

/** Reconfirma um ensaio cancelado — limpa o cancelamento e reinicia as presenças confirmadas. */
export async function reconfirmarEnsaio(id: string, confirmedByUid: string): Promise<void> {
  await updateDoc(doc(db, 'ensaios', id), {
    canceledByUid: deleteField(),
    canceledAt: deleteField(),
    presencas: [],
    ausentes: [],
    ausencias: deleteField(),
    confirmedByUid,
    confirmedAt: serverTimestamp(),
  })
}

function ausenciaRef(ensaioId: string, uid: string) {
  return doc(db, 'ensaios', ensaioId, 'ausencias', uid)
}

/**
 * Confirma a presença de `uid` nesse ensaio — e desfaz uma ausência avisada antes (tira de
 * `ausentes`, apaga o motivo privado e a chave legada em `ausencias`).
 */
export async function confirmarPresenca(id: string, uid: string): Promise<void> {
  const batch = writeBatch(db)
  batch.update(doc(db, 'ensaios', id), {
    presencas: arrayUnion(uid),
    ausentes: arrayRemove(uid),
    [`ausencias.${uid}`]: deleteField(),
  })
  batch.delete(ausenciaRef(id, uid))
  await batch.commit()
}

/**
 * `uid` avisa que não vai nesse ensaio: entra em `ausentes` (público, sem motivo) e o motivo vai
 * pra subcoleção privada. Sai de `presencas` se tinha confirmado.
 */
export async function registrarAusencia(id: string, uid: string, motivo: string): Promise<void> {
  const batch = writeBatch(db)
  batch.update(doc(db, 'ensaios', id), {
    presencas: arrayRemove(uid),
    ausentes: arrayUnion(uid),
    [`ausencias.${uid}`]: deleteField(),
  })
  batch.set(ausenciaRef(id, uid), { uid, motivo: motivo.trim(), registradaEm: new Date().toISOString() })
  await batch.commit()
}

/** Motivo usado quando a ausência vem da indisponibilidade informada na inscrição. */
export const MOTIVO_INDISPONIBILIDADE = 'Indisponível nessa data (informado na inscrição).'

/**
 * Registra como "não vai" (motivo `MOTIVO_INDISPONIBILIDADE`) quem marcou a data do ensaio como
 * indisponível na inscrição. Quem chama já filtra quem respondeu (ver `uidsIndisponiveis`).
 * Admin/líder usam ao confirmar um ensaio; a própria pessoa, pra ela mesma, ao abrir a Home.
 */
export async function aplicarIndisponibilidades(ensaioId: string, uids: string[]): Promise<void> {
  if (!uids.length) return
  const batch = writeBatch(db)
  batch.update(doc(db, 'ensaios', ensaioId), { ausentes: arrayUnion(...uids) })
  const registradaEm = new Date().toISOString()
  for (const uid of uids) {
    batch.set(ausenciaRef(ensaioId, uid), { uid, motivo: MOTIVO_INDISPONIBILIDADE, registradaEm, origem: 'inscricao' })
  }
  await batch.commit()
}

/**
 * Do elenco da cena, quem marcou `data` como indisponível na inscrição e ainda não respondeu ao
 * ensaio (nem "vou" nem "não vou"). `ensaio` ausente = ensaio recém-criado, ninguém respondeu.
 */
export function uidsIndisponiveis(
  cena: Pick<Cena, 'personagens'>,
  data: string,
  inscricoesByUid: Record<string, Pick<Inscricao, 'indisponibilidade'> | undefined>,
  ensaio?: Pick<Ensaio, 'presencas' | 'ausentes' | 'ausencias'>,
): string[] {
  const respondeu = new Set([...(ensaio?.presencas ?? []), ...(ensaio ? uidsAusentes(ensaio) : [])])
  const elenco = new Set(cena.personagens.map(p => p.participanteUid).filter((u): u is string => !!u))
  return [...elenco].filter(uid => !respondeu.has(uid) && !!inscricoesByUid[uid]?.indisponibilidade?.includes(data))
}

/** O motivo da própria ausência (`null` = não tem). */
export function subscribeToMinhaAusencia(ensaioId: string, uid: string, callback: (a: AusenciaMotivo | null) => void) {
  return onSnapshot(
    ausenciaRef(ensaioId, uid),
    snap => callback(snap.exists() ? (snap.data() as AusenciaMotivo) : null),
    () => callback(null),
  )
}

/** Todos os motivos de ausência do ensaio, por uid — só admin/líder da cena têm leitura. */
export function subscribeToAusencias(ensaioId: string, callback: (porUid: Record<string, AusenciaMotivo>) => void) {
  return onSnapshot(
    collection(db, 'ensaios', ensaioId, 'ausencias'),
    snap => callback(Object.fromEntries(snap.docs.map(d => [d.id, d.data() as AusenciaMotivo]))),
    () => callback({}),
  )
}

/**
 * Move os motivos legados (mapa `ausencias` no próprio ensaio, legível por todo participante) pra
 * subcoleção privada, e apaga o mapa. Chamado por admin/líder ao abrir a página do ensaio.
 */
export async function migrarAusenciasLegadas(ensaio: Ensaio): Promise<void> {
  const legado = ensaio.ausencias ?? {}
  const uids = Object.keys(legado)
  if (!uids.length) return
  const batch = writeBatch(db)
  for (const uid of uids) {
    batch.set(ausenciaRef(ensaio.id, uid), { uid, motivo: legado[uid].motivo, registradaEm: legado[uid].registradaEm })
  }
  batch.update(doc(db, 'ensaios', ensaio.id), { ausentes: arrayUnion(...uids), ausencias: deleteField() })
  await batch.commit()
}

/** Quem avisou que não vai — inclui o legado ainda não migrado. */
export function uidsAusentes(ensaio: Pick<Ensaio, 'ausentes' | 'ausencias'>): string[] {
  return [...new Set([...(ensaio.ausentes ?? []), ...Object.keys(ensaio.ausencias ?? {})])]
}

/** Desmarca a presença de `uid` nesse ensaio — usado por quem gerencia a agenda na tela ao vivo. */
export async function removerPresenca(id: string, uid: string): Promise<void> {
  await updateDoc(doc(db, 'ensaios', id), { presencas: arrayRemove(uid) })
}

/** Salva o rascunho de anotações durante a sessão ao vivo, sem marcar o ensaio como finalizado. */
export async function updateEnsaioAnotacoes(id: string, anotacoes: string): Promise<void> {
  await updateDoc(doc(db, 'ensaios', id), { anotacoes: anotacoes.trim() || deleteField() })
}

/**
 * Grava (ou atualiza) o registro do ensaio: duração, anotações — feito ao encerrar a sessão ao
 * vivo, ou manualmente por quem gerencia a agenda direto no ensaio (inclusive um já passado sem
 * ter sido "iniciado" pela tela ao vivo). Reaplicar isso num registro existente atualiza
 * `finalizadoByUid`/`finalizadoAt` pra quem editou por último.
 */
export async function salvarRegistroEnsaio(
  id: string,
  data: { anotacoes?: string; duracaoSegundos: number },
  finalizadoByUid: string,
): Promise<void> {
  await updateDoc(doc(db, 'ensaios', id), {
    anotacoes: data.anotacoes?.trim() || deleteField(),
    duracaoSegundos: data.duracaoSegundos,
    finalizadoByUid,
    finalizadoAt: serverTimestamp(),
  })
}

/** Todos os ensaios (confirmados e cancelados) de uma cena, em tempo real — sem paginação. */
export function subscribeToEnsaiosDaCena(cenaId: string, callback: (ensaios: Ensaio[]) => void) {
  const q = query(collection(db, 'ensaios'), where('cenaId', '==', cenaId))
  return onSnapshot(q, snap => callback(snap.docs.map(d => fromSnap(d.id, d.data()))))
}

/** Todos os ensaios (de todas as cenas), em tempo real — sem paginação. */
export function subscribeToAllEnsaios(callback: (ensaios: Ensaio[]) => void) {
  return onSnapshot(collection(db, 'ensaios'), snap => callback(snap.docs.map(d => fromSnap(d.id, d.data()))))
}
