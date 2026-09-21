import { create } from 'zustand'
import { getRedirectResult, onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from '@/services/firebase/config'
import { ensureUserDoc, getUserDoc } from '@/services/firebase/auth'
import type { AppUser } from '@/types'

interface AuthState {
  user: AppUser | null
  loading: boolean
  initialized: boolean
  redirectError: string | null
  /** true enquanto uma nova tentativa manual (botão "Tentar novamente") está em andamento. */
  retrying: boolean
}

export const useAuthStore = create<AuthState>(() => ({
  user: null,
  loading: true,
  initialized: false,
  redirectError: null,
  retrying: false,
}))

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout (${ms}ms) em: ${label}`)), ms)),
  ])
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Quedas momentâneas de conexão (rede instável, backend lento pra responder) são comuns e passam
 * sozinhas em poucos segundos. Antes de mostrar erro pro usuário, tenta de novo automaticamente
 * algumas vezes com espera crescente entre as tentativas.
 */
async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = 3): Promise<T> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await withTimeout(fn(), 12000, label)
    } catch (err) {
      lastErr = err
      console.warn(`[auth] ${label} falhou (tentativa ${attempt}/${attempts}):`, err)
      if (attempt < attempts) await delay(attempt * 1500)
    }
  }
  throw lastErr
}

async function loadProfile(firebaseUser: User) {
  console.log('[auth] ensureUserDoc...')
  await withRetry(
    () =>
      ensureUserDoc(firebaseUser.uid, firebaseUser.email ?? '', firebaseUser.displayName ?? firebaseUser.email ?? '', firebaseUser.photoURL),
    'ensureUserDoc',
  )
  console.log('[auth] getUserDoc...')
  const userDoc = await withRetry(() => getUserDoc(firebaseUser.uid), 'getUserDoc')
  console.log('[auth] perfil carregado:', userDoc)
  return userDoc
}

export function initAuth() {
  getRedirectResult(auth)
    .then(result => console.log('[auth] getRedirectResult:', result ? `user ${result.user.uid}` : 'sem resultado'))
    .catch(err => {
      console.error('[auth] getRedirectResult falhou:', err)
      useAuthStore.setState({ redirectError: 'Não foi possível entrar com o Google. Tente novamente.' })
    })

  return onAuthStateChanged(auth, async firebaseUser => {
    console.log('[auth] onAuthStateChanged:', firebaseUser ? `uid ${firebaseUser.uid}` : 'null')
    if (firebaseUser) {
      try {
        const userDoc = await loadProfile(firebaseUser)
        useAuthStore.setState({ user: userDoc, loading: false, initialized: true, redirectError: null })
      } catch (err) {
        console.error('[auth] Falha ao carregar/criar o perfil do usuário após login:', err)
        useAuthStore.setState({
          user: null,
          loading: false,
          initialized: true,
          redirectError: 'Login feito, mas houve um erro ao carregar seu perfil. Verifique sua conexão e tente de novo.',
        })
      }
    } else {
      useAuthStore.setState({ user: null, loading: false, initialized: true })
    }
  })
}

/** Tenta carregar o perfil de novo sem exigir um novo login, usado pelo botão "Tentar novamente". */
export async function retryLoadProfile() {
  const firebaseUser = auth.currentUser
  if (!firebaseUser) {
    useAuthStore.setState({ initialized: true, redirectError: 'Sessão expirada. Entre novamente.' })
    return
  }
  useAuthStore.setState({ retrying: true, redirectError: null })
  try {
    const userDoc = await loadProfile(firebaseUser)
    useAuthStore.setState({ user: userDoc, loading: false, initialized: true, retrying: false, redirectError: null })
  } catch (err) {
    console.error('[auth] retryLoadProfile falhou:', err)
    useAuthStore.setState({
      retrying: false,
      initialized: true,
      redirectError: 'Ainda não foi possível carregar seu perfil. Verifique sua conexão e tente de novo.',
    })
  }
}
