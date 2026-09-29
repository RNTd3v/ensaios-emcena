import { useEffect, useState } from 'react'
import { Wifi, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'

/** `navigator.onLine` em tempo real. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const ligar = () => setOnline(true)
    const desligar = () => setOnline(false)
    window.addEventListener('online', ligar)
    window.addEventListener('offline', desligar)
    return () => {
      window.removeEventListener('online', ligar)
      window.removeEventListener('offline', desligar)
    }
  }, [])
  return online
}

/**
 * Faixa de "sem conexão". O Firestore guarda o que a pessoa fizer offline e envia quando a rede
 * volta — sem esse aviso, ela vê "deu certo" e não sabe que ainda não foi. Ao reconectar, mostra
 * "Conectado de novo" por uns segundos.
 */
export function SemConexaoBanner({ mensagem = 'Sem conexão — o que você fizer será enviado quando a internet voltar.' }: { mensagem?: string }) {
  const online = useOnline()
  const [voltou, setVoltou] = useState(false)
  const [estavaOffline, setEstavaOffline] = useState(!online)

  useEffect(() => {
    if (!online) return setEstavaOffline(true)
    if (!estavaOffline) return
    setEstavaOffline(false)
    setVoltou(true)
    const t = setTimeout(() => setVoltou(false), 3000)
    return () => clearTimeout(t)
  }, [online, estavaOffline])

  if (online && !voltou) return null
  return (
    <div
      role="status"
      className={cn(
        'mx-4 mb-2 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-white shadow-lg backdrop-blur-md',
        online ? 'bg-emerald-600/90' : 'bg-black/70',
      )}
    >
      {online ? <Wifi className="h-4 w-4 shrink-0" /> : <WifiOff className="h-4 w-4 shrink-0" />}
      {online ? 'Conectado de novo — alterações enviadas.' : mensagem}
    </div>
  )
}
