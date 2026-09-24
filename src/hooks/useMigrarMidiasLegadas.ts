import { useEffect, useRef } from 'react'
import { migrarMidiasDaCena, temMidiasLegadas } from '@/services/firebase/midias'
import { useAuthStore } from '@/stores/authStore'
import type { Cena } from '@/types'

/**
 * Admin abrindo a tela: move pra coleções próprias as músicas/figurinos que ainda estão no formato
 * antigo (arrays dentro da cena). Cada cena é tentada uma vez por montagem.
 */
export function useMigrarMidiasLegadas(cenas: Cena[] | null | undefined) {
  const isAdmin = useAuthStore(s => s.user?.role === 'admin')
  const tentadas = useRef(new Set<string>())
  useEffect(() => {
    if (!isAdmin || !cenas) return
    for (const cena of cenas) {
      if (!temMidiasLegadas(cena) || tentadas.current.has(cena.id)) continue
      tentadas.current.add(cena.id)
      migrarMidiasDaCena(cena).catch(() => tentadas.current.delete(cena.id))
    }
  }, [isAdmin, cenas])
}
