import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { db } from './config'

/**
 * Vínculo de cônjuge: só pra um ver no app os ensaios do outro (organização). Quem pede cria como
 * 'pendente'; o outro aceita. Depois de aceito a Cloud Function `conjugeVinculo` libera a leitura
 * dos ensaios nas cenas (firestore.rules). Não dá poder de editar nem responder presença.
 */
export interface VinculoConjuge {
  id: string
  uids: [string, string]
  solicitanteUid: string
  status: 'pendente' | 'aceito'
}

function idDoPar(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a]
}

/** Vínculos (pendentes e aceitos) de que `uid` faz parte. */
export function subscribeToMeusVinculos(uid: string, callback: (lista: VinculoConjuge[]) => void) {
  const q = query(collection(db, 'conjuges'), where('uids', 'array-contains', uid))
  return onSnapshot(
    q,
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }) as VinculoConjuge)),
    () => callback([]),
  )
}

export async function pedirVinculo(meuUid: string, outroUid: string): Promise<void> {
  const uids = idDoPar(meuUid, outroUid)
  await setDoc(doc(db, 'conjuges', `${uids[0]}_${uids[1]}`), {
    uids,
    solicitanteUid: meuUid,
    status: 'pendente',
    createdAt: serverTimestamp(),
  })
}

export async function aceitarVinculo(id: string): Promise<void> {
  await updateDoc(doc(db, 'conjuges', id), { status: 'aceito' })
}

/** Recusa um pedido, cancela o seu ou desfaz um vínculo aceito. */
export async function removerVinculo(id: string): Promise<void> {
  await deleteDoc(doc(db, 'conjuges', id))
}
