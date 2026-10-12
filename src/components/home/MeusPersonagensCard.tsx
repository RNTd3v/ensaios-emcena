import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, VenetianMask } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useEnsaiosDasMinhasCenas } from '@/hooks/useEnsaiosDasMinhasCenas'
import { uidsAusentes } from '@/services/firebase/ensaios'
import { formatRelativeDia, toDateKey } from '@/lib/agenda'
import { formatHoraCompacta } from '@/lib/cenaHorario'
import { cn } from '@/lib/utils'
import type { Cena, Ensaio, Personagem } from '@/types'

/** Cor do ícone pela resposta da pessoa ao próximo ensaio do personagem. */
function corDaResposta(uid: string, ensaio?: Ensaio): { cor: string; titulo: string } {
  if (ensaio?.presencas?.includes(uid)) return { cor: 'bg-emerald-100 text-emerald-600', titulo: 'Você confirmou presença' }
  if (ensaio && uidsAusentes(ensaio).includes(uid)) return { cor: 'bg-red-100 text-red-600', titulo: 'Você avisou que não vai' }
  return { cor: 'bg-gray-100 text-gray-400', titulo: ensaio ? 'Ainda sem resposta' : 'Sem ensaio marcado' }
}

/**
 * Card discreto na Home com os personagens da pessoa (nas cenas ativas) e o próximo ensaio de cada
 * um — o próximo não cancelado nem finalizado da cena em que o personagem é chamado (sem
 * obrigatórios marcados, todos são). O ícone mostra a resposta da pessoa a esse ensaio: verde =
 * "vou", vermelho = "não vou", cinza = sem resposta ou sem ensaio. Sem personagem, não aparece.
 */
export function MeusPersonagensCard({ uid }: { uid: string }) {
  const { minhasCenas, ensaiosPorCena } = useEnsaiosDasMinhasCenas(uid)
  const todayKey = toDateKey(new Date())

  const itens = useMemo(() => {
    const lista: { personagem: Personagem; cena: Cena; proximo?: Ensaio }[] = []
    for (const cena of minhasCenas) {
      const futuros = (ensaiosPorCena[cena.id] ?? [])
        .filter(e => !e.canceledByUid && !e.finalizadoAt && e.data >= todayKey)
        .sort((a, b) => a.data.localeCompare(b.data) || a.horario.localeCompare(b.horario))
      for (const personagem of cena.personagens.filter(p => p.participanteUid === uid)) {
        const proximo = futuros.find(e => !e.obrigatorios?.length || e.obrigatorios.includes(personagem.id))
        lista.push({ personagem, cena, proximo })
      }
    }
    // Quem tem ensaio mais perto primeiro; sem ensaio marcado, no fim.
    return lista.sort((a, b) => {
      if (!a.proximo || !b.proximo) return Number(!a.proximo) - Number(!b.proximo)
      return a.proximo.data.localeCompare(b.proximo.data) || a.proximo.horario.localeCompare(b.proximo.horario)
    })
  }, [minhasCenas, ensaiosPorCena, todayKey, uid])

  if (!itens.length) return null

  return (
    <Card>
      <CardContent className="space-y-1">
        <p className="flex items-center gap-1.5 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <VenetianMask className="h-3.5 w-3.5" />
          {itens.length > 1 ? 'Seus personagens' : 'Seu personagem'}
        </p>
        {itens.map(({ personagem, cena, proximo }) => {
          const resposta = corDaResposta(uid, proximo)
          return (
            <Link
              key={`${cena.id}-${personagem.id}`}
              to={`/cenas/${cena.id}/personagens/${personagem.id}`}
              className="flex items-center gap-2.5 py-1"
            >
              <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', resposta.cor)} title={resposta.titulo}>
                <VenetianMask className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{personagem.nome}</p>
                <p className="truncate text-xs text-muted-foreground">{cena.nome}</p>
              </div>
              <span className={cn('shrink-0 text-right text-xs', proximo?.data === todayKey ? 'font-semibold text-primary' : 'text-gray-600')}>
                {proximo ? `${formatRelativeDia(proximo.data, todayKey)} · ${formatHoraCompacta(proximo.horario)}` : 'Sem ensaio marcado'}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
            </Link>
          )
        })}
      </CardContent>
    </Card>
  )
}
