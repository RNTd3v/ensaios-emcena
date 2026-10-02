import { deleteField, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './config'
import { deleteCenaFile, uploadArquivo } from './storage'
import type { AppSettings, RoteiroArquivo, RoteiroTipo } from '@/types'

const SETTINGS_REF = doc(db, 'settings', 'config')

export const DEFAULT_SETTINGS: AppSettings = {
  eventName: 'Musical de Natal',
  posterImageUrl: '/bg.jpg',
  posterImageDesktopUrl: '/bg.jpg',
  internalBgUrl: '/bg-interno.jpg',
  eventDate: '2026-12-20',
  apresentacaoHorarios: '10:00, 19:00',
  callToActionText: 'Quero participar',
  welcomeMessage: 'Sua participação na Vila é um presente. Que o Senhor use você pra levar esperança e transformar vidas através dessa história.',
  checkinLimiteHoras: 2,
  loginDestaqueTitulo: 'Reunião Geral',
  loginDestaqueData: '2026-10-03',
  loginDestaqueHora: '16:00',
  loginDestaqueHoraFim: '19:00',
  loginDestaqueLocal: 'IBP',
  loginLancamentoData: '2026-10-03',
  loginContagemApresentacao: false,
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

/** Sobe (ou troca) um dos PDFs do roteiro — só admin grava em `settings` (firestore.rules). */
export async function uploadRoteiro(tipo: RoteiroTipo, file: File, anterior?: RoteiroArquivo): Promise<void> {
  const up = await uploadArquivo('roteiro', file)
  const arquivo: RoteiroArquivo = { path: up.path, nome: file.name, atualizadoEm: new Date().toISOString() }
  await setDoc(SETTINGS_REF, { roteiros: { [tipo]: arquivo }, updatedAt: serverTimestamp() }, { merge: true })
  if (anterior) await deleteCenaFile(anterior.path)
}

export async function removerRoteiro(tipo: RoteiroTipo, atual: RoteiroArquivo): Promise<void> {
  await setDoc(SETTINGS_REF, { roteiros: { [tipo]: deleteField() }, updatedAt: serverTimestamp() }, { merge: true })
  await deleteCenaFile(atual.path)
}
