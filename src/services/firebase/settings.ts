import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './config'
import type { AppSettings } from '@/types'

const SETTINGS_REF = doc(db, 'settings', 'config')

export const DEFAULT_SETTINGS: AppSettings = {
  eventName: 'Musical de Natal',
  posterImageUrl: '/bg.jpg',
  posterImageDesktopUrl: '/bg.jpg',
  internalBgUrl: '/bg-interno.jpg',
  eventDate: '',
  callToActionText: 'Quero participar',
  welcomeMessage: 'Sua participação na Vila é um presente. Que o Senhor use você pra levar esperança e transformar vidas através dessa história.',
}

export async function getSettings(): Promise<AppSettings> {
  const snap = await getDoc(SETTINGS_REF)
  if (!snap.exists()) return DEFAULT_SETTINGS
  return { ...DEFAULT_SETTINGS, ...snap.data() } as AppSettings
}

export async function saveSettings(settings: Omit<AppSettings, 'updatedAt'>): Promise<void> {
  await setDoc(SETTINGS_REF, { ...settings, updatedAt: serverTimestamp() }, { merge: true })
}
