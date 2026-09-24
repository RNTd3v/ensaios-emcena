import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { subscribeToNaoLidas } from '@/services/firebase/notificacoes'
import { useAuthStore } from '@/stores/authStore'

/** Sino do canto superior direito: leva pra /notificacoes e mostra quantas não foram lidas. */
export function SinoNotificacoes() {
  const uid = useAuthStore(s => s.user?.uid)
  const [naoLidas, setNaoLidas] = useState(0)

  useEffect(() => {
    if (!uid) return
    return subscribeToNaoLidas(uid, setNaoLidas)
  }, [uid])

  return (
    <Link
      to="/notificacoes"
      aria-label={naoLidas ? `Notificações (${naoLidas} não lidas)` : 'Notificações'}
      className="absolute right-4 top-[calc(0.5rem+env(safe-area-inset-top,0px))] rounded-full border border-white/25 bg-white/15 p-2 text-white backdrop-blur-md"
    >
      <Bell className="h-5 w-5" />
      {naoLidas > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white ring-2 ring-white/80">
          {naoLidas > 99 ? '99+' : naoLidas}
        </span>
      )}
    </Link>
  )
}
