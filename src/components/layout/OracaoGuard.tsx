import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { Spinner } from '@/components/ui/Spinner'
import { useOracaoVisivel } from '@/hooks/useOracaoVisivel'
import { useSettingsStore } from '@/stores/settingsStore'

/** Só deixa entrar no relógio de oração quem pode ver (admin, ou todos quando liberado). */
export function OracaoGuard({ children }: { children: React.ReactNode }) {
  const visivel = useOracaoVisivel()
  const { loaded, refresh } = useSettingsStore()

  useEffect(() => {
    if (!loaded) refresh()
  }, [loaded, refresh])

  if (!loaded) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    )
  }
  if (!visivel) return <Navigate to="/" replace />
  return <>{children}</>
}
