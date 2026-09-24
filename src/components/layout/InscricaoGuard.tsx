import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Spinner } from '@/components/ui/Spinner'
import { subscribeToMinhaInscricaoExiste } from '@/services/firebase/inscricoes'
import { useAuthStore } from '@/stores/authStore'
import { useInscricaoStore } from '@/stores/inscricaoStore'

/** Única rota liberada pra quem ainda não fez a inscrição. */
export const ROTA_INSCRICAO = '/inscricao'

/**
 * Quem entra sem ter feito a inscrição só acessa o formulário de inscrição até enviá-lo — o resto
 * redireciona pra lá. Admin fica de fora (pode gerenciar o app sem ser inscrito). Se não der pra
 * verificar (erro de rede), libera em vez de travar a pessoa.
 */
export function InscricaoGuard({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(s => s.user)
  const existe = useInscricaoStore(s => s.existe)
  const location = useLocation()
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    if (!user || isAdmin) return
    useInscricaoStore.setState({ existe: null })
    return subscribeToMinhaInscricaoExiste(user.uid, e => useInscricaoStore.setState({ existe: e }))
  }, [user, isAdmin])

  if (isAdmin) return <>{children}</>

  if (existe === null) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#28386c' }}>
        <Spinner size="lg" className="border-white/25 border-t-white" />
      </div>
    )
  }

  if (existe === false && location.pathname !== ROTA_INSCRICAO) {
    return <Navigate to={ROTA_INSCRICAO} replace />
  }

  return <>{children}</>
}
