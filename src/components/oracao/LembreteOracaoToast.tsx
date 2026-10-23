import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { subscribeToOrientacoesOracao } from '@/services/firebase/oracao'
import { useOracaoVisivel } from '@/hooks/useOracaoVisivel'
import { dataIso, orientacaoDoDia } from '@/lib/oracao'

const DURACAO_MS = 12000
const SEM_ORIENTACAO = 'Pelo ministério e por cada participante do musical, além das pessoas que irão assistir. Amém!'

function chaveDoDia(uid: string): string {
  return `lembreteOracao:${uid}`
}

/**
 * Ao abrir o app, lembra (uma vez por dia por aparelho) de orar, com a orientação do dia ou, sem ela,
 * a última cadastrada antes de hoje.
 */
export function LembreteOracaoToast({ uid }: { uid: string }) {
  const visivel = useOracaoVisivel()
  const navigate = useNavigate()
  const [texto, setTexto] = useState<string | null>(null)
  const [aberto, setAberto] = useState(false)

  useEffect(() => {
    if (!visivel) return
    const hoje = dataIso(new Date())
    try {
      if (localStorage.getItem(chaveDoDia(uid)) === hoje) return
    } catch {
      return
    }
    // Só a primeira leitura interessa: o lembrete não muda enquanto está na tela.
    let feito = false
    const unsub = subscribeToOrientacoesOracao(lista => {
      if (feito) return
      feito = true
      unsub()
      try {
        localStorage.setItem(chaveDoDia(uid), hoje)
      } catch {
        // Sem storage: mostra mesmo assim (pode repetir na próxima abertura).
      }
      setTexto(orientacaoDoDia(lista, hoje)?.texto ?? SEM_ORIENTACAO)
      setAberto(true)
    })
    return () => {
      if (!feito) unsub()
    }
  }, [uid, visivel])

  useEffect(() => {
    if (!aberto) return
    const t = setTimeout(() => setAberto(false), DURACAO_MS)
    return () => clearTimeout(t)
  }, [aberto])

  if (!texto || !aberto) return null

  return (
    <div className="absolute inset-x-6 top-[calc(1.5rem+env(safe-area-inset-top,0px))] z-30 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-900 shadow-2xl animate-[aparecer_300ms_ease-out]">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-lg" aria-hidden>
        🙏
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Lembre de orar</p>
        <p className="whitespace-pre-wrap text-sm text-amber-800">{texto}</p>
        <button
          type="button"
          onClick={() => {
            setAberto(false)
            navigate('/oracao')
          }}
          className="mt-1 text-sm font-medium text-amber-900 underline underline-offset-2"
        >
          Ver direcionamentos
        </button>
      </div>
      <button type="button" onClick={() => setAberto(false)} className="shrink-0 p-1 text-amber-700 hover:text-amber-900" aria-label="Fechar">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
