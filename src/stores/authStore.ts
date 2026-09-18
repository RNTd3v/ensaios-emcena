import { create } from 'zustand'
import { getRedirectResult, onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/services/firebase/config'
import { ensureUserDoc, getUserDoc } from '@/services/firebase/auth'
import type { AppUser } from '@/types'

interface AuthState {
  user: AppUser | null
  loading: boolean
  initialized: boolean
  redirectError: string | null
}

export const useAuthStore = create<AuthState>(() => ({
  user: null,
  loading: true,
  initialized: false,
  redirectError: null,
}))

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout (${ms}ms) em: ${label}`)), ms)),
  ])
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
        console.log('[auth] ensureUserDoc...')
        await withTimeout(
          ensureUserDoc(
            firebaseUser.uid,
            firebaseUser.email ?? '',
            firebaseUser.displayName ?? firebaseUser.email ?? '',
            firebaseUser.photoURL,
          ),
          15000,
          'ensureUserDoc',
        )
        console.log('[auth] getUserDoc...')
        const userDoc = await withTimeout(getUserDoc(firebaseUser.uid), 15000, 'getUserDoc')
        console.log('[auth] perfil carregado:', userDoc)
        useAuthStore.setState({ user: userDoc, loading: false, initialized: true })
      } catch (err) {
        console.error('[auth] Falha ao carregar/criar o perfil do usuário após login:', err)
        useAuthStore.setState({
          user: null,
          loading: false,
          initialized: true,
          redirectError: 'Login feito, mas houve um erro ao carregar seu perfil. Veja o console e tente de novo.',
        })
      }
    } else {
      useAuthStore.setState({ user: null, loading: false, initialized: true })
    }
  })
}
