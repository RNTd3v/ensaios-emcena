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
import type { Notificacao } from '@/types'

/**
 * Notificações da pessoa (criadas pelas Cloud Functions — ver functions/src/index.ts) e o
 * cadastro do aparelho pro push (FCM).
 */

function toIso(value: unknown): string {
  return (value as { toDate?: () => Date })?.toDate?.().toISOString() ?? new Date().toISOString()
}

export function subscribeToNotificacoes(uid: string, callback: (lista: Notificacao[]) => void) {
  const q = query(collection(db, 'notificacoes'), where('uid', '==', uid), orderBy('createdAt', 'desc'), limit(60))
  return onSnapshot(
    q,
    snap => callback(snap.docs.map(d => ({ ...d.data(), id: d.id, createdAt: toIso(d.data().createdAt) }) as Notificacao)),
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
  escopo: 'todos' | 'cena' | 'equipe'
  escopoId?: string
  escopoNome?: string
}

/** Cria o aviso — a Cloud Function `avisoCriado` gera as notificações e o push. */
export async function enviarAviso(input: AvisoInput, byUid: string): Promise<void> {
  await addDoc(collection(db, 'avisos'), {
    titulo: input.titulo.trim(),
    corpo: input.corpo.trim(),
    escopo: input.escopo,
    ...(input.escopoId ? { escopoId: input.escopoId, escopoNome: input.escopoNome ?? '' } : {}),
    enviadoPorUid: byUid,
    createdAt: serverTimestamp(),
  })
}
