import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from './config'
import { uploadArquivo } from './storage'
import type { Reporte } from '@/types'

export type ReporteInput = Omit<Reporte, 'id' | 'status' | 'createdAt' | 'resolvidoEm' | 'printUrl' | 'printPath'>

/** Grava o relato (o print, se houver, sobe antes). A Cloud Function `reporteCriado` avisa o suporte. */
export async function enviarReporte(input: ReporteInput, print?: File): Promise<string> {
  const up = print ? await uploadArquivo(`reportes/${input.uid}`, print) : undefined
  const ref = await addDoc(collection(db, 'reportes'), {
    ...input,
    texto: input.texto.trim(),
    ...(up ? { printUrl: up.url, printPath: up.path } : {}),
    status: 'aberto',
    createdAt: serverTimestamp(),
  })
  return ref.id
}

function dataIso(v: unknown): string | undefined {
  return (v as { toDate?: () => Date } | undefined)?.toDate?.().toISOString()
}

/** Todos os relatos, mais recentes primeiro — só admin lê (firestore.rules). */
export function subscribeToReportes(callback: (lista: Reporte[]) => void) {
  return onSnapshot(
    query(collection(db, 'reportes'), orderBy('createdAt', 'desc')),
    snap =>
      callback(
        snap.docs.map(d => {
          const data = d.data()
          return { ...data, id: d.id, createdAt: dataIso(data.createdAt) ?? new Date().toISOString(), resolvidoEm: dataIso(data.resolvidoEm) } as Reporte
        }),
      ),
    () => callback([]),
  )
}

export async function marcarReporte(id: string, status: Reporte['status']): Promise<void> {
  await updateDoc(doc(db, 'reportes', id), { status, resolvidoEm: status === 'resolvido' ? serverTimestamp() : null })
}
