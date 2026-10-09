import { create } from 'zustand'
import { getRedirectResult, onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from '@/services/firebase/config'
import { carregarOuCriarPerfil } from '@/services/firebase/auth'
import type { AppUser } from '@/types'

interface AuthState {
  /**
   * Perfil efetivo usado pelo app inteiro. Admin na "visão de participante" aparece aqui com
   * role 'participante' (menus, telas e consultas de participante) — no servidor continua admin.
   */
  user: AppUser | null
  /** Perfil como está no Firestore (role verdadeira). */
  perfilReal: AppUser | null
  /** Admin escolheu ver o app como participante (menu → foto). Salvo no aparelho. */
  visaoParticipante: boolean
  loading: boolean
  initialized: boolean
  redirectError: string | null
  /** true enquanto uma nova tentativa manual (botão "Tentar novamente") está em andamento. */
  retrying: boolean
}

const VISAO_KEY = 'visao.participante'

function lerVisao(): boolean {
  try {
    return localStorage.getItem(VISAO_KEY) === 'sim'
  } catch {
    return false
  }
}

/**
 * Último perfil carregado, guardado no aparelho. Na próxima abertura o app entra direto com ele e
 * confere o servidor em segundo plano — no iPhone o PWA é fechado o tempo todo, e esperar o
 * servidor a cada abertura deixava o login lento (ou dava timeout) com a conexão ruim. A segurança
 * não depende disso: as regras do Firestore valem do mesmo jeito; quem foi revogado vê a tela de
 * acesso revogado assim que a conferência chega.
 */
const PERFIL_KEY = 'perfil.cache'

function lerPerfilGuardado(uid: string): AppUser | null {
  try {
    const perfil = JSON.parse(localStorage.getItem(PERFIL_KEY) ?? 'null') as AppUser | null
    return perfil?.uid === uid ? perfil : null
  } catch {
    return null
  }
}

function guardarPerfil(perfil: AppUser | null) {
  try {
    if (perfil) localStorage.setItem(PERFIL_KEY, JSON.stringify(perfil))
    else localStorage.removeItem(PERFIL_KEY)
  } catch {
    // storage indisponível — a próxima abertura espera o servidor, como antes
  }
}

/** Aplica a visão escolhida ao perfil real. */
function efetivo(perfil: AppUser | null, visaoParticipante: boolean): AppUser | null {
  if (perfil?.role === 'admin' && visaoParticipante) return { ...perfil, role: 'participante' }
  return perfil
}

/** Grava o perfil carregado (real + efetivo). */
function definirPerfil(perfil: AppUser | null, extra: Partial<AuthState> = {}) {
  const { visaoParticipante } = useAuthStore.getState()
  if (perfil) guardarPerfil(perfil)
  useAuthStore.setState({ ...extra, perfilReal: perfil, user: efetivo(perfil, visaoParticipante) })
}

/** Admin alterna entre ver o app como admin e como participante. */
export function trocarVisao(participante: boolean) {
  try {
    localStorage.setItem(VISAO_KEY, participante ? 'sim' : 'nao')
  } catch {
    // storage indisponível — vale só até fechar o app
  }
  const { perfilReal } = useAuthStore.getState()
  useAuthStore.setState({ visaoParticipante: participante, user: efetivo(perfilReal, participante) })
}

/** Reflete na hora uma troca de foto feita pela própria pessoa (o perfil não é escutado em tempo real). */
export function atualizarFotoLocal(photoURL: string | null, fotoPath: string | undefined) {
  const { perfilReal } = useAuthStore.getState()
  if (perfilReal) definirPerfil({ ...perfilReal, photoURL, fotoPath })
}

export const useAuthStore = create<AuthState>(() => ({
  user: null,
  perfilReal: null,
  visaoParticipante: lerVisao(),
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
      return await withTimeout(fn(), 8000, label)
    } catch (err) {
      lastErr = err
      console.warn(`[auth] ${label} falhou (tentativa ${attempt}/${attempts}):`, err)
      if (attempt < attempts) await delay(attempt * 1500)
    }
  }
  throw lastErr
}

async function loadProfile(firebaseUser: User) {
  const perfil = await withRetry(
    () =>
      carregarOuCriarPerfil(
        firebaseUser.uid,
        firebaseUser.email ?? '',
        firebaseUser.displayName ?? firebaseUser.email ?? '',
        firebaseUser.photoURL,
      ),
    'carregarOuCriarPerfil',
  )
  console.log('[auth] perfil carregado:', perfil)
  return perfil
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
      const guardado = lerPerfilGuardado(firebaseUser.uid)
      if (guardado) {
        // Entra na hora com o perfil guardado e confere o servidor sem segurar a tela.
        definirPerfil(guardado, { loading: false, initialized: true, redirectError: null })
        loadProfile(firebaseUser)
          .then(perfil => {
            if (auth.currentUser?.uid === firebaseUser.uid) definirPerfil(perfil)
          })
          .catch(err => console.warn('[auth] Conferência do perfil falhou; seguindo com o guardado:', err))
        return
      }
      try {
        const userDoc = await loadProfile(firebaseUser)
        definirPerfil(userDoc, { loading: false, initialized: true, redirectError: null })
      } catch (err) {
        console.error('[auth] Falha ao carregar/criar o perfil do usuário após login:', err)
        definirPerfil(null, {
          loading: false,
          initialized: true,
          redirectError: 'Login feito, mas houve um erro ao carregar seu perfil. Verifique sua conexão e tente de novo.',
        })
      }
    } else {
      guardarPerfil(null)
      definirPerfil(null, { loading: false, initialized: true })
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
    definirPerfil(userDoc, { loading: false, initialized: true, retrying: false, redirectError: null })
  } catch (err) {
    console.error('[auth] retryLoadProfile falhou:', err)
    useAuthStore.setState({
      retrying: false,
      initialized: true,
      redirectError: 'Ainda não foi possível carregar seu perfil. Verifique sua conexão e tente de novo.',
    })
  }
}
