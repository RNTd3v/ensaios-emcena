import { useEffect, useState } from 'react'
import { Candy, HandCoins, Receipt, Target, Ticket } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { arrecadadoTotal, subscribeToFinanceiro } from '@/services/firebase/financeiro'
import { formatBRL } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { Financeiro } from '@/types'

function Progresso({ valor, meta, className }: { valor: number; meta?: number | null; className?: string }) {
  if (!meta) return null
  const pct = Math.min(100, Math.round((valor / meta) * 100))
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-gray-100', className)}>
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
    </div>
  )
}

function CardTitulo({ icon: Icon, titulo }: { icon: React.ComponentType<{ className?: string }>; titulo: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <p className="text-sm font-semibold text-gray-900">{titulo}</p>
    </div>
  )
}

interface LinhaProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  valor?: number | null
  qtd?: number | null
  qtdMeta?: number | null
  qtdLabel?: string
}

function Linha({ icon: Icon, label, valor, qtd, qtdMeta, qtdLabel }: LinhaProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-sm">
        <Icon className="h-4 w-4 shrink-0 text-primary" />
        <span className="flex-1 text-gray-700">{label}</span>
        <span className="font-semibold text-gray-900">{formatBRL(valor ?? 0)}</span>
      </div>
      {qtd != null && (
        <p className="pl-6 text-xs text-muted-foreground">
          {qtd} {qtdLabel}
          {qtdMeta ? ` de ${qtdMeta}` : ''}
        </p>
      )}
      {qtd != null && qtdMeta ? <Progresso valor={qtd} meta={qtdMeta} className="ml-6 w-auto" /> : null}
    </div>
  )
}

/**
 * Cards de metas e de gastos na Home, lendo o resumo `financeiro/resumo` (preenchido pelo admin
 * em Configurações, até existir a página própria de metas e gastos).
 */
export function FinanceiroCards() {
  const [financeiro, setFinanceiro] = useState<Financeiro | null | undefined>(undefined)

  useEffect(() => subscribeToFinanceiro(setFinanceiro), [])

  if (financeiro === undefined) return null

  if (!financeiro) {
    return (
      <Card>
        <CardContent className="space-y-1">
          <CardTitulo icon={Target} titulo="Metas e gastos" />
          <p className="pl-11 text-xs text-muted-foreground">Em breve.</p>
        </CardContent>
      </Card>
    )
  }

  const arrecadado = arrecadadoTotal(financeiro)
  const gastos = financeiro.gastosTotal ?? 0
  const saldo = arrecadado - gastos

  return (
    <>
      <Card>
        <CardContent className="space-y-3">
          <CardTitulo icon={Target} titulo="Metas" />
          <div>
            <p className="text-2xl font-bold text-gray-900">{formatBRL(arrecadado)}</p>
            <p className="text-xs text-muted-foreground">
              arrecadado{financeiro.metaTotal ? ` de ${formatBRL(financeiro.metaTotal)}` : ''}
              {financeiro.metaTotal ? ` · ${Math.round((arrecadado / financeiro.metaTotal) * 100)}%` : ''}
            </p>
            <Progresso valor={arrecadado} meta={financeiro.metaTotal} className="mt-2" />
          </div>
          <div className="space-y-2.5 border-t border-gray-100 pt-3">
            <Linha
              icon={Ticket}
              label="Rifas"
              valor={financeiro.rifasValor}
              qtd={financeiro.rifasVendidas}
              qtdMeta={financeiro.rifasMeta}
              qtdLabel="vendidas"
            />
            <Linha
              icon={Candy}
              label="Doces"
              valor={financeiro.docesValor}
              qtd={financeiro.docesVendidos}
              qtdMeta={financeiro.docesMeta}
              qtdLabel="vendidos"
            />
            <Linha icon={HandCoins} label="Ofertas" valor={financeiro.ofertasValor} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <CardTitulo icon={Receipt} titulo="Gastos" />
          <div>
            <p className="text-2xl font-bold text-gray-900">{formatBRL(gastos)}</p>
            <p className="text-xs text-muted-foreground">
              gasto{financeiro.gastosOrcamento ? ` de ${formatBRL(financeiro.gastosOrcamento)} previstos` : ''}
            </p>
            <Progresso valor={gastos} meta={financeiro.gastosOrcamento} className="mt-2" />
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 pt-3 text-sm">
            <span className="text-gray-700">Saldo (arrecadado − gastos)</span>
            <span className={cn('font-semibold', saldo < 0 ? 'text-red-600' : 'text-emerald-700')}>{formatBRL(saldo)}</span>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
