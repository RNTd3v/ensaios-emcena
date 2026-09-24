import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MusicasCard } from '@/components/midia/MusicasCard'
import { FigurinosCard } from '@/components/midia/FigurinosCard'
import { useMigrarMidiasLegadas } from '@/hooks/useMigrarMidiasLegadas'
import { subscribeToCenas } from '@/services/firebase/cenas'
import { useAuthStore } from '@/stores/authStore'
import type { Cena } from '@/types'

function useVoltar() {
  const navigate = useNavigate()
  const location = useLocation()
  return () => (location.key !== 'default' ? navigate(-1) : navigate('/'))
}

/** Cenas visíveis pra quem está vendo — usado aqui só pra migrar o legado quando é admin. */
function useCenasParaMigrar() {
  const currentUser = useAuthStore(s => s.user)
  const [cenas, setCenas] = useState<Cena[] | null>(null)
  useEffect(() => {
    if (currentUser?.role !== 'admin') return
    return subscribeToCenas('admin', currentUser.uid, setCenas)
  }, [currentUser])
  useMigrarMidiasLegadas(cenas)
}

function Cabecalho({ titulo }: { titulo: string }) {
  const voltar = useVoltar()
  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={voltar} title="Voltar">
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <h1 className="text-xl font-semibold text-white">{titulo}</h1>
    </div>
  )
}

/**
 * Todas as músicas da peça, agrupadas por cena (e "Sem cena"). Só leitura pra todos — exceto o
 * admin, que também cadastra/edita/exclui aqui (a equipe responsável faz isso na página dela).
 */
export function MusicasPage() {
  useCenasParaMigrar()
  const isAdmin = useAuthStore(s => s.user?.role === 'admin')
  return (
    <div className="space-y-4">
      <Cabecalho titulo="Músicas" />
      <MusicasCard semTitulo gerenciar={isAdmin ? {} : undefined} />
    </div>
  )
}

/** Todos os figurinos da peça, agrupados por cena (e "Sem cena"). Mesma regra: admin também gerencia aqui. */
export function FigurinosPage() {
  useCenasParaMigrar()
  const isAdmin = useAuthStore(s => s.user?.role === 'admin')
  return (
    <div className="space-y-4">
      <Cabecalho titulo="Figurinos" />
      <FigurinosCard semTitulo gerenciar={isAdmin ? {} : undefined} />
    </div>
  )
}
