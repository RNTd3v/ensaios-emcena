import { GoogleAuthProvider, OAuthProvider, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth'
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteField, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { auth, db, storage } from './config'
import { deleteCenaFile } from './storage'
import type { AppUser, UserRole } from '@/types'

/** O login roda no mesmo domínio do app (authDomain = domínio do Hosting, com /__/auth/ servido por ele). */
function authNoMesmoDominio(): boolean {
  return auth.config.authDomain === window.location.host
}

function appInstalado(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

/**
 * Popup em vez de redirect: com o login num domínio diferente do app (firebaseapp.com x web.app),
 * o redirect depende de armazenamento entre sites, que Safari/Chrome bloqueiam — ele "esquecia" o
 * login na volta. Se o navegador bloquear o popup, cai para redirect como último recurso.
 *
 * Com o login no mesmo domínio do app, o redirect volta a ser confiável — e no app instalado ele é
 * melhor que o popup (no iPhone o popup abre numa janela à parte que às vezes não volta pro app).
 */
export async function loginWithGoogle() {
  if (appInstalado() && authNoMesmoDominio()) return signInWithRedirect(auth, new GoogleAuthProvider())
  try {
    return await signInWithPopup(auth, new GoogleAuthProvider())
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      return signInWithRedirect(auth, new GoogleAuthProvider())
    }
    throw err
  }
}

export async function loginWithMicrosoft() {
  const provider = new OAuthProvider('microsoft.com')
  try {
    return await signInWithPopup(auth, provider)
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      return signInWithRedirect(auth, provider)
    }
    throw err
  }
}

export async function logout() {
  return signOut(auth)
}

/** Cria o documento do usuário na primeira vez que ele faz login. Sempre como 'participante' e ativo. */
export async function ensureUserDoc(uid: string, email: string, displayName: string, photoURL: string | null) {
  const ref = doc(db, 'users', uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, {
      uid,
      email,
      displayName,
      photoURL,
      role: 'participante' satisfies UserRole,
      active: true,
      createdAt: serverTimestamp(),
    })
  }
}

/** Troca a foto de perfil por uma escolhida no app (já reduzida) e apaga a anterior do Storage. */
export async function salvarFotoPerfil(uid: string, foto: Blob, pathAnterior?: string): Promise<{ url: string; path: string }> {
  const path = `usuarios/${uid}/${crypto.randomUUID()}.jpg`
  const fileRef = ref(storage, path)
  await uploadBytes(fileRef, foto, { contentType: 'image/jpeg' })
  const url = await getDownloadURL(fileRef)
  await updateDoc(doc(db, 'users', uid), { photoURL: url, fotoPath: path })
  if (pathAnterior) await deleteCenaFile(pathAnterior)
  return { url, path }
}

/** Volta pra foto da conta Google (ou nenhuma) e apaga a escolhida do Storage. */
export async function usarFotoDaConta(uid: string, photoURL: string | null, pathAnterior?: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { photoURL, fotoPath: deleteField() })
  if (pathAnterior) await deleteCenaFile(pathAnterior)
}

function fromUserSnap(data: Record<string, unknown>): AppUser {
  const createdAt = data.createdAt as { toDate?: () => Date } | undefined
  const revokedAt = data.revokedAt as { toDate?: () => Date } | undefined
  return {
    ...data,
    createdAt: createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    revokedAt: revokedAt?.toDate?.().toISOString(),
  } as AppUser
}

export async function getUserDoc(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  return fromUserSnap(snap.data())
}

export async function getUsers(): Promise<AppUser[]> {
  const snap = await getDocs(collection(db, 'users'))
  return snap.docs.map(d => fromUserSnap(d.data()))
}

/** Atualiza o perfil (role) de um usuário. */
export async function updateUserRole(uid: string, role: UserRole): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { role })
}

/** Revoga ou reativa o acesso de um participante ao app — sempre grava quem fez a alteração. */
export async function setUserActive(uid: string, active: boolean, byUid: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    active,
    revokedByUid: active ? deleteField() : byUid,
    revokedAt: active ? deleteField() : serverTimestamp(),
  })
}
