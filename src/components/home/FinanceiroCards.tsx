import { Link } from 'react-router-dom'
import { ChevronRight, Receipt, Target } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useFinanceiro } from '@/hooks/useFinanceiro'
import { FRENTES } from '@/lib/financeiro'
import { formatBRL } from '@/lib/formatters'
import { cn } from '@/lib/utils'

/**
 * Resumo de metas e gastos na Home — os mesmos dados da tela /metas-gastos (meta, arrecadado por
 * frente, gastos e saldo), que é pra onde o card leva.
 */
export function FinanceiroCards() {
  const { resumo: r, carregado } = useFinanceiro()
  if (!carregado) return null

  const pct = r.meta > 0 ? Math.min(100, Math.round((r.arrecadado / r.meta) * 100)) : null
  const frentesComValor = FRENTES.filter(f => r.porFrente[f.value] > 0)

  return (
    <Link to="/metas-gastos" className="block">
      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Target className="h-4 w-4" />
              </span>
              Metas e gastos
            </p>
            <ChevronRight className="h-4 w-4 text-gray-300" />
          </div>

          <div>
            <p className="text-2xl font-bold text-gray-900">{formatBRL(r.arrecadado)}</p>
            <p className="text-xs text-muted-foreground">
              arrecadado{r.meta > 0 ? ` de ${formatBRL(r.meta)} · ${pct}%` : ''}
            </p>
            {pct !== null && (
              <div className="mt-2 h-2 w-full overflow-hidden rounded bg-gray-100" title={`${pct}% da meta`}>
                <div className="h-full rounded bg-primary" style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>

          {frentesComValor.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {frentesComValor.map(f => `${f.label} ${formatBRL(r.porFrente[f.value])}`).join(' · ')}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-3">
            <div>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Receipt className="h-3 w-3" />
                Gasto
              </p>
              <p className="text-sm font-semibold text-gray-900">{formatBRL(r.gastoPago)}</p>
              {r.gastoPrevisto > 0 && <p className="text-[11px] text-muted-foreground">+ {formatBRL(r.gastoPrevisto)} previsto</p>}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saldo</p>
              <p className={cn('text-sm font-semibold', r.saldo < 0 ? 'text-red-600' : 'text-emerald-700')}>{formatBRL(r.saldo)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
