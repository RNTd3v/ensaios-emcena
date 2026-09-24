import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './config'
import type { AppSettings } from '@/types'

const SETTINGS_REF = doc(db, 'settings', 'config')

export const DEFAULT_SETTINGS: AppSettings = {
  eventName: 'Musical de Natal',
  posterImageUrl: '/bg.jpg',
  posterImageDesktopUrl: '/bg.jpg',
  internalBgUrl: '/bg-interno.jpg',
  eventDate: '2026-12-20',
  apresentacaoHorarios: '10:00, 19:00',
  roteiroUrl: '',
  callToActionText: 'Quero participar',
  welcomeMessage: 'Sua participação na Vila é um presente. Que o Senhor use você pra levar esperança e transformar vidas através dessa história.',
  checkinLimiteHoras: 2,
}

export async function getSettings(): Promise<AppSettings> {
  const snap = await getDoc(SETTINGS_REF)
  if (!snap.exists()) return DEFAULT_SETTINGS
  return { ...DEFAULT_SETTINGS, ...snap.data() } as AppSettings
}

/** Muda só alguns campos das configurações (sem reescrever o resto) — só admin (firestore.rules). */
export async function saveSettingsParcial(parcial: Partial<Omit<AppSettings, 'updatedAt'>>): Promise<void> {
  await setDoc(SETTINGS_REF, { ...parcial, updatedAt: serverTimestamp() }, { merge: true })
}

export async function saveSettings(settings: Omit<AppSettings, 'updatedAt'>): Promise<void> {
  await setDoc(SETTINGS_REF, { ...settings, updatedAt: serverTimestamp() }, { merge: true })
}
