import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, ChevronRight, CircleDashed } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Card, CardContent } from '@/components/ui/card'
import { pessoaOpcao } from '@/components/ui/PessoaSelect'
import { useUsersMap } from '@/components/oracao/OrandoAgora'
import { subscribeToEquipes } from '@/services/firebase/equipes'
import { subscribeToTarefas } from '@/services/firebase/tarefas'
import { toDateKey } from '@/lib/agenda'
import { cn } from '@/lib/utils'
import type { Equipe, Tarefa } from '@/types'

const MAX_VISIVEIS = 5

function formatPrazo(prazo: string) {
  return new Date(`${prazo}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

/**
 * Tarefas "Fazendo" com o prazo — as de prazo mais perto primeiro (atrasadas em vermelho). Membro
 * vê só as que estão no nome dele; líder vê todas da equipe (as dele marcadas). Sem nada, some.
 */
export function TarefasEmAndamentoCard({ uid }: { uid: string }) {
  const users = useUsersMap()
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [tarefasPorEquipe, setTarefasPorEquipe] = useState<Record<string, Tarefa[]>>({})

  useEffect(() => subscribeToEquipes(lista => setEquipes(lista.filter(e => e.membros.includes(uid) || e.liderUid === uid))), [uid])

  const idsKey = equipes.map(e => e.id).sort().join(',')
  useEffect(() => {
    if (!idsKey) return
    const unsubs = idsKey
      .split(',')
      .map(id => subscribeToTarefas(id, lista => setTarefasPorEquipe(prev => ({ ...prev, [id]: lista }))))
    return () => unsubs.forEach(u => u())
  }, [idsKey])

  const todayKey = toDateKey(new Date())
  const emAndamento = useMemo(() => {
    const nomes = new Map(equipes.map(e => [e.id, e.nome]))
    return equipes
      // Líder da equipe vê todas as em andamento; os demais, só as que estão no nome deles.
      .flatMap(e =>
        (tarefasPorEquipe[e.id] ?? []).filter(t => t.status === 'fazendo' && (e.liderUid === uid || t.responsavelUid === uid)),
      )
      .map(t => ({ ...t, equipeNome: nomes.get(t.equipeId) ?? 'Equipe' }))
      .sort(
        (a, b) =>
          (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999') ||
          Number(b.responsavelUid === uid) - Number(a.responsavelUid === uid) ||
          a.titulo.localeCompare(b.titulo, 'pt-BR'),
      )
  }, [equipes, tarefasPorEquipe, uid])

  if (!emAndamento.length) return null
  const visiveis = emAndamento.slice(0, MAX_VISIVEIS)
  const restantes = emAndamento.length - visiveis.length

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CircleDashed className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">Tarefas em andamento</p>
            <p className="text-xs text-muted-foreground">
              {equipes.some(e => e.liderUid === uid)
                ? `${emAndamento.length} ${emAndamento.length === 1 ? 'tarefa' : 'tarefas'} — suas e das equipes que você lidera`
                : `${emAndamento.length} ${emAndamento.length === 1 ? 'tarefa sua' : 'tarefas suas'}`}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          {visiveis.map(t => {
            const atrasada = !!t.prazo && t.prazo < todayKey
            const hoje = t.prazo === todayKey
            const minha = t.responsavelUid === uid
            const responsavel = t.responsavelUid ? pessoaOpcao(t.responsavelUid, users[t.responsavelUid]) : undefined
            return (
              <Link
                key={t.id}
                to={`/equipes/${t.equipeId}`}
                className={cn(
                  'flex items-center gap-2.5 rounded-xl border px-3 py-2',
                  minha ? 'border-primary/30 bg-primary/5' : 'border-gray-200',
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{t.titulo}</p>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span className="truncate">{t.equipeNome}</span>
                    <span className={cn('flex items-center gap-1', atrasada && 'font-medium text-red-600', hoje && 'font-medium text-amber-600')}>
                      <CalendarClock className="h-3 w-3" />
                      {t.prazo ? (atrasada ? `Atrasada · ${formatPrazo(t.prazo)}` : hoje ? 'Prazo hoje' : `Até ${formatPrazo(t.prazo)}`) : 'Sem prazo'}
                    </span>
                    {minha && <span className="font-medium text-primary">Sua</span>}
                  </p>
                </div>
                {responsavel && <Avatar photoURL={responsavel.photoURL} name={responsavel.nome} className="h-7 w-7 text-[10px]" />}
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
              </Link>
            )
          })}
        </div>

        {restantes > 0 && (
          <Link to="/equipes" className="block text-center text-xs font-medium text-primary hover:underline">
            e mais {restantes} {restantes === 1 ? 'tarefa' : 'tarefas'} — ver equipes
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
