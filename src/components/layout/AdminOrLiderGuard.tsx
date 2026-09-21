import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

export function AdminOrLiderGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()

  if (user?.role !== 'admin' && user?.role !== 'lider') return <Navigate to="/" replace />

  return <>{children}</>
}
