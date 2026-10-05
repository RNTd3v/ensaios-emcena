import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { getMessaging, getToken, isSupported } from 'firebase/messaging'
import { app, db } from './config'
import type { AparelhoPush, Notificacao, PushStatus } from '@/types'

/**
 * Notificações da pessoa (criadas pelas Cloud Functions — ver functions/src/index.ts) e o
 * cadastro do aparelho pro push (FCM).
 */

function toIso(value: unknown): string {
  return (value as { toDate?: () => Date })?.toDate?.().toISOString() ?? new Date().toISOString()
}

function talvezIso(value: unknown): string | undefined {
  return (value as { toDate?: () => Date })?.toDate?.().toISOString()
}

function notificacaoFromSnap(id: string, data: Record<string, unknown>): Notificacao {
  const push = data.push as Record<string, unknown> | undefined
  return {
    ...data,
    id,
    createdAt: toIso(data.createdAt),
    lidaEm: talvezIso(data.lidaEm),
    push: push ? { ...push, enviadoEm: talvezIso(push.enviadoEm), recebidoEm: talvezIso(push.recebidoEm) } : undefined,
  } as Notificacao
}

/** As notificações de `uid` (a própria pessoa — ou qualquer uma, pro admin). */
export function subscribeToNotificacoes(uid: string, callback: (lista: Notificacao[]) => void, max = 60) {
  const q = query(collection(db, 'notificacoes'), where('uid', '==', uid), orderBy('createdAt', 'desc'), limit(max))
  return onSnapshot(
    q,
    snap => callback(snap.docs.map(d => notificacaoFromSnap(d.id, d.data()))),
    () => callback([]),
  )
}

/** Quantas não lidas — pro número no sino. */
export function subscribeToNaoLidas(uid: string, callback: (total: number) => void) {
  const q = query(collection(db, 'notificacoes'), where('uid', '==', uid), where('lida', '==', false))
  return onSnapshot(
    q,
    snap => callback(snap.size),
    () => callback(0),
  )
}

export async function marcarLida(id: string): Promise<void> {
  await updateDoc(doc(db, 'notificacoes', id), { lida: true, lidaEm: serverTimestamp() })
}

export async function marcarTodasLidas(ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += 400) {
    const batch = writeBatch(db)
    for (const id of ids.slice(i, i + 400)) batch.update(doc(db, 'notificacoes', id), { lida: true, lidaEm: serverTimestamp() })
    await batch.commit()
  }
}

export async function apagarNotificacao(id: string): Promise<void> {
  await deleteDoc(doc(db, 'notificacoes', id))
}

// ---------- Push (FCM) ----------

/**
 * Chave VAPID própria (Console → Configurações do projeto → Cloud Messaging → Certificados push da
 * Web). Opcional: sem ela, o SDK do Firebase usa a chave padrão dele e o push funciona igual.
 */
const VAPID_KEY = (import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined) || undefined
const SW_URL = '/firebase-messaging-sw.js'
const SW_SCOPE = '/firebase-cloud-messaging-push-scope'

export type PushEstado = 'ativo' | 'desligado' | 'negado' | 'sem-suporte'

/** Estado atual do push nesse aparelho (sem pedir permissão). */
export async function estadoPush(): Promise<PushEstado> {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !(await isSupported().catch(() => false))) return 'sem-suporte'
  if (Notification.permission === 'denied') return 'negado'
  if (Notification.permission !== 'granted') return 'desligado'
  const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE)
  return reg ? 'ativo' : 'desligado'
}

/**
 * Pede permissão, registra o service worker do push e guarda o token do aparelho em
 * `fcmTokens/{token}` (as Cloud Functions mandam pra esses tokens). Pode ser chamado de novo —
 * o token é o id do doc, então não duplica.
 */
export async function ativarPush(uid: string): Promise<PushEstado> {
  const estado = await estadoPush()
  if (estado === 'sem-suporte' || estado === 'negado') return estado

  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') return permissao === 'denied' ? 'negado' : 'desligado'

  const registration = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE })
  const token = await getToken(getMessaging(app), {
    ...(VAPID_KEY ? { vapidKey: VAPID_KEY } : {}),
    serviceWorkerRegistration: registration,
  })
  if (!token) return 'desligado'

  await setDoc(doc(db, 'fcmTokens', token), { uid, userAgent: navigator.userAgent.slice(0, 200), createdAt: serverTimestamp() })
  return 'ativo'
}

// ---------- Rastreio de entrega (tela do admin) ----------

const ESTADO_PUSH_CACHE = 'pushStatus.ultimo'

/**
 * Grava em `pushStatus/{uid}` como está o push nesse aparelho (permissão, instalado, iPhone) —
 * é o que explica, na tela do admin, por que alguém não recebe. Só escreve se mudou ou a cada 12h.
 */
export async function registrarEstadoPush(uid: string): Promise<void> {
  const dados = {
    uid,
    estado: await estadoPush(),
    ios: ehIOS(),
    instalado: rodandoComoApp(),
    userAgent: navigator.userAgent.slice(0, 200),
  }
  const chave = JSON.stringify(dados)
  try {
    const anterior = JSON.parse(localStorage.getItem(ESTADO_PUSH_CACHE) ?? 'null') as { chave: string; em: number } | null
    if (anterior?.chave === chave && Date.now() - anterior.em < 12 * 60 * 60 * 1000) return
  } catch {
    // cache ilegível — grava de novo
  }
  await setDoc(doc(db, 'pushStatus', uid), { ...dados, atualizadoEm: serverTimestamp() })
  try {
    localStorage.setItem(ESTADO_PUSH_CACHE, JSON.stringify({ chave, em: Date.now() }))
  } catch {
    // storage indisponível
  }
}

/** Admin: estado do push de todo mundo, por uid. */
export function subscribeToPushStatus(callback: (porUid: Record<string, PushStatus>) => void) {
  return onSnapshot(
    collection(db, 'pushStatus'),
    snap =>
      callback(Object.fromEntries(snap.docs.map(d => [d.id, { ...d.data(), uid: d.id, atualizadoEm: toIso(d.data().atualizadoEm) } as PushStatus]))),
    () => callback({}),
  )
}

/** Admin: todos os aparelhos com push ativo. */
export function subscribeToAparelhosPush(callback: (lista: AparelhoPush[]) => void) {
  return onSnapshot(
    collection(db, 'fcmTokens'),
    snap => callback(snap.docs.map(d => ({ ...d.data(), token: d.id, createdAt: toIso(d.data().createdAt) }) as AparelhoPush)),
    () => callback([]),
  )
}

/** Instalado como app (tela inicial) — no iPhone o push só funciona assim. */
export function rodandoComoApp(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

export function ehIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

// ---------- Avisos manuais ----------

export interface AvisoInput {
  titulo: string
  corpo: string
  escopo: 'todos' | 'cena' | 'equipe' | 'pessoas'
  escopoId?: string
  escopoNome?: string
  /** Só com escopo 'pessoas': quem recebe (a Cloud Function confere se o remetente pode avisar cada um). */
  destinatarios?: string[]
}

/** Cria o aviso — a Cloud Function `avisoCriado` gera as notificações e o push. */
export async function enviarAviso(input: AvisoInput, byUid: string): Promise<void> {
  await addDoc(collection(db, 'avisos'), {
    titulo: input.titulo.trim(),
    corpo: input.corpo.trim(),
    escopo: input.escopo,
    ...(input.escopoId ? { escopoId: input.escopoId, escopoNome: input.escopoNome ?? '' } : {}),
    ...(input.escopo === 'pessoas' ? { destinatarios: input.destinatarios ?? [], escopoNome: input.escopoNome ?? '' } : {}),
    enviadoPorUid: byUid,
    createdAt: serverTimestamp(),
  })
}
