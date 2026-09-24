import { useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/Spinner'
import { subscribeToPedidosOracao } from '@/services/firebase/oracao'
import type { PedidoOracao } from '@/types'

/** Pedidos de oração (só leitura) — aberto pelo ícone do card "Orando agora". */
export function PedidosOracaoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [pedidos, setPedidos] = useState<PedidoOracao[] | null>(null)

  useEffect(() => {
    if (!open) return
    return subscribeToPedidosOracao(setPedidos)
  }, [open])

  const ativos = (pedidos ?? []).filter(p => !p.respondido)
  const respondidos = (pedidos ?? []).filter(p => p.respondido)

  return (
    <Dialog open={open} onClose={onClose} title="Pedidos de oração">
      {!pedidos ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : pedidos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum pedido de oração no momento.</p>
      ) : (
        <div className="space-y-4">
          <PedidosLista pedidos={ativos} />
          {respondidos.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Respondidos
              </p>
              <PedidosLista pedidos={respondidos} />
            </div>
          )}
        </div>
      )}
    </Dialog>
  )
}

export function PedidosLista({ pedidos, onSelect }: { pedidos: PedidoOracao[]; onSelect?: (p: PedidoOracao) => void }) {
  if (!pedidos.length) return null
  return (
    <div className="space-y-2">
      {pedidos.map(p => {
        const conteudo = (
          <>
            {p.titulo && <p className="text-sm font-semibold text-gray-900">{p.titulo}</p>}
            <p className="whitespace-pre-wrap text-sm text-gray-700">{p.texto}</p>
          </>
        )
        return onSelect ? (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p)}
            className="block w-full rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-left hover:bg-gray-100"
          >
            {conteudo}
          </button>
        ) : (
          <div key={p.id} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
            {conteudo}
          </div>
        )
      })}
    </div>
  )
}
