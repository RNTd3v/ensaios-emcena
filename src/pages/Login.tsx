import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PublicHero } from '@/components/layout/PublicHero'
import { loginWithGoogle, loginWithMicrosoft } from '@/services/firebase/auth'
import { useAuthStore, retryLoadProfile } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden="true" fill="currentColor">
      <path d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c10 0 19.1-7.3 19.1-20 0-1.3-.1-2.7-.5-3.5z" />
    </svg>
  )
}

// Login com Microsoft já implementado, mas escondido até o app OAuth estar configurado no Azure/Firebase.
const MICROSOFT_LOGIN_ENABLED = false

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 23 23" className="h-4 w-4" aria-hidden="true">
      <rect x="1" y="1" width="10" height="10" fill="#f25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7fba00" />
      <rect x="1" y="12" width="10" height="10" fill="#00a4ef" />
      <rect x="12" y="12" width="10" height="10" fill="#ffb900" />
    </svg>
  )
}

export function Login() {
  const { user, initialized, redirectError, retrying } = useAuthStore()
  const { settings, loaded, refresh } = useSettingsStore()
  const [loading, setLoading] = useState<'google' | 'microsoft' | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loaded) refresh()
  }, [loaded, refresh])

  if (initialized && user) return <Navigate to="/" replace />

  async function handleGoogleLogin() {
    setError('')
    setLoading('google')
    try {
      await loginWithGoogle()
    } catch {
      setError('Não foi possível entrar com o Google. Tente novamente.')
    } finally {
      setLoading(null)
    }
  }

  async function handleMicrosoftLogin() {
    setError('')
    setLoading('microsoft')
    try {
      await loginWithMicrosoft()
    } catch {
      setError('Não foi possível entrar com a Microsoft. Tente novamente.')
    } finally {
      setLoading(null)
    }
  }

  const fallback = (
    <div className="hero-card-green h-full w-full flex flex-col items-center justify-center text-white text-center px-5" style={{ borderRadius: 0 }}>
      <p className="text-4xl">🎭</p>
      <h1 className="font-script text-3xl leading-none mt-1">{settings.eventName || 'Musical de Natal'}</h1>
      <p className="text-sm text-white/75 mt-1">Inscrições de elenco e equipe</p>
    </div>
  )

  return (
    <PublicHero
      heroImageUrl={settings.posterImageUrl}
      heroImageDesktopUrl={settings.posterImageDesktopUrl}
      heroAlt={settings.eventName}
      fallback={fallback}
      cardClassName="mx-4 space-y-4"
    >
      <div className="space-y-4 text-center">
        {(error || redirectError) && (
          <div className="space-y-2">
            <p className="text-sm text-white bg-black/40 rounded-lg px-3 py-2">{error || redirectError}</p>
            {redirectError && (
              <Button
                variant="outline"
                onClick={() => retryLoadProfile()}
                disabled={retrying}
                className="gap-2 rounded-full border-white/30 bg-white/10 text-white hover:bg-white/20"
              >
                {retrying && <Loader2 className="h-4 w-4 animate-spin" />}
                Tentar novamente
              </Button>
            )}
          </div>
        )}

        <Button
          size="lg"
          onClick={handleGoogleLogin}
          disabled={loading !== null}
          className="gap-2 rounded-full border border-white/30 bg-white/15 px-8 text-white backdrop-blur-md hover:bg-white/25"
        >
          {loading === 'google' ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
          Entrar com Google
        </Button>

        {MICROSOFT_LOGIN_ENABLED && (
          <Button
            size="lg"
            onClick={handleMicrosoftLogin}
            disabled={loading !== null}
            className="gap-2 rounded-full border border-white/30 bg-white/15 px-8 text-white backdrop-blur-md hover:bg-white/25"
          >
            {loading === 'microsoft' ? <Loader2 className="h-4 w-4 animate-spin" /> : <MicrosoftIcon />}
            Entrar com Microsoft
          </Button>
        )}
      </div>
    </PublicHero>
  )
}
