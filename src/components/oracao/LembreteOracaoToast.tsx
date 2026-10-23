import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { PedidosOracaoDialog } from '@/components/oracao/PedidosOracaoDialog'
import { subscribeToPedidosOracao } from '@/services/firebase/oracao'
import { useOracaoVisivel } from '@/hooks/useOracaoVisivel'
import type { PedidoOracao } from '@/types'

const MAX_NOMES = 3
const DURACAO_MS = 8000

function chaveDoDia(uid: string): string {
  return `lembreteOracao:${uid}`
}

function hoje(): string {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

/** Por quem orar: o título do pedido ou, sem título, o texto. */
function rotulo(p: PedidoOracao): string {
  return p.titulo ?? p.texto.replace(/\s+/g, ' ')
}

/**
 * Ao abrir o app, lembra (uma vez por dia por aparelho) de orar pelo ministério, pelo musical e
 * pelos pedidos ainda não respondidos.
 */
export function LembreteOracaoToast({ uid }: { uid: string }) {
  const visivel = useOracaoVisivel()
  const [pedidos, setPedidos] = useState<PedidoOracao[] | null>(null)
  const [aberto, setAberto] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    if (!visivel) return
    try {
      if (localStorage.getItem(chaveDoDia(uid)) === hoje()) return
    } catch {
      return
    }
    // Só a primeira leitura interessa: o lembrete não muda enquanto está na tela.
    let feito = false
    const unsub = subscribeToPedidosOracao(lista => {
      if (feito) return
      feito = true
      unsub()
      const ativos = lista.filter(p => !p.respondido)
      try {
        localStorage.setItem(chaveDoDia(uid), hoje())
      } catch {
        // Sem storage: mostra mesmo assim (pode repetir na próxima abertura).
      }
      setPedidos(ativos)
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

  if (!pedidos) return null

  const resto = pedidos.length - MAX_NOMES
  const nomes = pedidos.slice(0, MAX_NOMES).map(rotulo).join(', ') + (resto > 0 ? ` e mais ${resto}` : '')

  return (
    <>
      {aberto && (
        <div className="absolute inset-x-6 top-[calc(1.5rem+env(safe-area-inset-top,0px))] z-30 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-900 shadow-2xl animate-[aparecer_300ms_ease-out]">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-lg" aria-hidden>
            🙏
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Lembre de orar</p>
            <p className="text-sm text-amber-800">
              {pedidos.length
                ? `Por ${nomes}, pelo ministério e pelo musical. Amém!`
                : 'Pelo ministério e por cada participante do musical, além das pessoas que irão assistir. Amém!'}
            </p>
            {pedidos.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setAberto(false)
                  setDialogOpen(true)
                }}
                className="mt-1 text-sm font-medium text-amber-900 underline underline-offset-2"
              >
                Ver pedidos
              </button>
            )}
          </div>
          <button type="button" onClick={() => setAberto(false)} className="shrink-0 p-1 text-amber-700 hover:text-amber-900" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <PedidosOracaoDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  )
}
