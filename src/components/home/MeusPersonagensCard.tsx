import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, VenetianMask } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { useEnsaiosDasMinhasCenas } from '@/hooks/useEnsaiosDasMinhasCenas'
import { uidsAusentes } from '@/services/firebase/ensaios'
import { formatRelativeDia, toDateKey } from '@/lib/agenda'
import { formatHoraCompacta } from '@/lib/cenaHorario'
import { cn } from '@/lib/utils'
import type { Cena, Ensaio, Personagem } from '@/types'

type ItemPersonagem = { personagem: Personagem; cena: Cena; proximo?: Ensaio }

/** Cor do ícone pela resposta da pessoa ao próximo ensaio do personagem. `quem`: nome do dependente (sem = "Você"). */
function corDaResposta(uid: string, ensaio?: Ensaio, quem?: string): { cor: string; titulo: string } {
  if (ensaio?.presencas?.includes(uid)) return { cor: 'bg-emerald-100 text-emerald-600', titulo: `${quem ?? 'Você'} confirmou presença` }
  if (ensaio && uidsAusentes(ensaio).includes(uid)) return { cor: 'bg-red-100 text-red-600', titulo: `${quem ?? 'Você'} avisou que não vai` }
  return { cor: 'bg-gray-100 text-gray-400', titulo: ensaio ? 'Ainda sem resposta' : 'Sem ensaio marcado' }
}

/**
 * Os personagens da pessoa (nas cenas ativas) com o próximo ensaio de cada um — o próximo não
 * cancelado nem finalizado da cena em que o personagem é chamado (sem obrigatórios marcados, todos
 * são). Modo dependente: `uid` é um filho de `dependenteDe`.
 */
function usePersonagensComProximo(uid: string, dependenteDe?: string): ItemPersonagem[] {
  const { minhasCenas, ensaiosPorCena } = useEnsaiosDasMinhasCenas(uid, dependenteDe)
  const todayKey = toDateKey(new Date())

  return useMemo(() => {
    const lista: ItemPersonagem[] = []
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
}

/**
 * Card discreto na Home com os personagens da pessoa e o próximo ensaio de cada um (ver
 * `usePersonagensComProximo`). O ícone mostra a resposta da pessoa a esse ensaio: verde = "vou",
 * vermelho = "não vou", cinza = sem resposta ou sem ensaio. Sem personagem, não aparece.
 */
export function MeusPersonagensCard({ uid }: { uid: string }) {
  const itens = usePersonagensComProximo(uid)

  if (!itens.length) return null

  return (
    <Card>
      <CardContent className="space-y-1">
        <p className="flex items-center gap-1.5 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <VenetianMask className="h-3.5 w-3.5" />
          {itens.length > 1 ? 'Seus personagens' : 'Seu personagem'}
        </p>
        <ListaPersonagens uid={uid} itens={itens} />
      </CardContent>
    </Card>
  )
}

/**
 * Botão na Home com o dependente (foto e nome) e quantos personagens ele tem; tocar abre os
 * personagens dele com o próximo ensaio de cada um. Sem personagem, não aparece.
 */
export function PersonagensDoDependenteBotao({
  uid,
  dependenteDe,
  nome,
  fotoUrl,
}: {
  uid: string
  dependenteDe: string
  nome: string
  fotoUrl?: string
}) {
  const itens = usePersonagensComProximo(uid, dependenteDe)
  const [aberto, setAberto] = useState(false)
  const todayKey = toDateKey(new Date())

  if (!itens.length) return null

  const proximo = itens[0].proximo

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="block w-full text-left">
        <Card>
          <CardContent className="flex items-center gap-3">
            <Avatar photoURL={fotoUrl} name={nome} className="h-10 w-10 text-sm" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-gray-900">
                <VenetianMask className="h-3.5 w-3.5 shrink-0 text-primary" />
                {itens.length > 1 ? `Personagens de ${nome}` : `Personagem de ${nome}`}
              </p>
              <p className={cn('truncate text-xs', proximo?.data === todayKey ? 'font-semibold text-primary' : 'text-muted-foreground')}>
                {proximo
                  ? `Próximo ensaio: ${formatRelativeDia(proximo.data, todayKey)} · ${formatHoraCompacta(proximo.horario)}`
                  : 'Sem ensaio marcado'}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
          </CardContent>
        </Card>
      </button>

      <Dialog open={aberto} onClose={() => setAberto(false)} title={itens.length > 1 ? `Personagens de ${nome}` : `Personagem de ${nome}`}>
        <ListaPersonagens uid={uid} itens={itens} quem={nome} />
      </Dialog>
    </>
  )
}

function ListaPersonagens({ uid, itens, quem }: { uid: string; itens: ItemPersonagem[]; quem?: string }) {
  const todayKey = toDateKey(new Date())
  return (
    <div className="space-y-1">
      {itens.map(({ personagem, cena, proximo }) => {
        const resposta = corDaResposta(uid, proximo, quem)
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
    </div>
  )
}
