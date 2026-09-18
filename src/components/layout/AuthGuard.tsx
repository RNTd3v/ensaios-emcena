import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { logout } from '@/services/firebase/auth'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/button'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, initialized } = useAuthStore()

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#28386c' }}>
        <Spinner size="lg" className="border-white/25 border-t-white" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (!user.active) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#28386c' }}>
        <div className="max-w-sm text-center space-y-3 text-white">
          <p className="text-4xl">🚫</p>
          <h1 className="text-lg font-semibold">Acesso revogado</h1>
          <p className="text-sm text-white/70">
            Seu acesso a este app foi desativado pela produção. Se acha que isso é um engano, entre em contato com a
            organização.
          </p>
          <Button variant="outline" onClick={() => logout()} className="border-white/40 text-white">
            Sair
          </Button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
