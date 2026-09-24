import { useEffect, useState } from 'react'
import { subscribeToEquipes } from '@/services/firebase/equipes'
import { useAuthStore } from '@/stores/authStore'

/**
 * Se a pessoa pode ver a área de Equipes: admin, ou quem é membro de pelo menos uma equipe
 * (líder e assistentes também estão em `membros`). `null` = ainda carregando.
 */
export function useEquipesVisivel(): boolean | null {
  const user = useAuthStore(s => s.user)
  const [visivel, setVisivel] = useState<boolean | null>(user?.role === 'admin' ? true : null)

  useEffect(() => {
    if (!user) return
    if (user.role === 'admin') return setVisivel(true)
    return subscribeToEquipes(lista => setVisivel(lista.some(e => e.membros.includes(user.uid) || e.liderUid === user.uid)))
  }, [user])

  return visivel
}
