import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './config'
import type { Financeiro } from '@/types'

const RESUMO_REF = doc(db, 'financeiro', 'resumo')

/** `null` = ainda não existe (admin não preencheu nada). */
export function subscribeToFinanceiro(callback: (financeiro: Financeiro | null) => void) {
  return onSnapshot(
    RESUMO_REF,
    snap => {
      if (!snap.exists()) return callback(null)
      const data = snap.data()
      callback({
        ...data,
        updatedAt: (data.updatedAt as { toDate?: () => Date })?.toDate?.().toISOString(),
      } as Financeiro)
    },
    () => callback(null),
  )
}

/** Campos vazios (NaN do input numérico) viram `null`, pra limpar o valor salvo. */
export async function saveFinanceiro(input: Omit<Financeiro, 'updatedAt'>): Promise<void> {
  const limpo = Object.fromEntries(
    Object.entries(input).map(([k, v]) => [k, typeof v === 'number' && !Number.isNaN(v) ? v : null]),
  )
  await setDoc(RESUMO_REF, { ...limpo, updatedAt: serverTimestamp() }, { merge: true })
}

export function arrecadadoTotal(f: Financeiro): number {
  return (f.rifasValor ?? 0) + (f.docesValor ?? 0) + (f.ofertasValor ?? 0)
}
