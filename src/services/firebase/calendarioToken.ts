import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { db } from './config'

/**
 * Link secreto de assinatura do calendário (`calendarioTokens/{token}`, um por pessoa). Quem tem o
 * link vê os ensaios da pessoa no Google Agenda / Calendário da Apple; apagar o token revoga o
 * acesso. A Cloud Function `calendarioIcs` é quem monta o calendário a partir do token.
 */

function novoToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

export async function getCalendarioToken(uid: string): Promise<string | null> {
  const snap = await getDocs(query(collection(db, 'calendarioTokens'), where('uid', '==', uid)))
  return snap.docs[0]?.id ?? null
}

/** Cria o link (ou troca por um novo, invalidando o anterior). */
export async function gerarCalendarioToken(uid: string): Promise<string> {
  const antigos = await getDocs(query(collection(db, 'calendarioTokens'), where('uid', '==', uid)))
  const token = novoToken()
  await setDoc(doc(db, 'calendarioTokens', token), { uid, createdAt: serverTimestamp() })
  await Promise.all(antigos.docs.map(d => deleteDoc(d.ref)))
  return token
}

export async function revogarCalendarioToken(uid: string): Promise<void> {
  const antigos = await getDocs(query(collection(db, 'calendarioTokens'), where('uid', '==', uid)))
  await Promise.all(antigos.docs.map(d => deleteDoc(d.ref)))
}
