import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, HandHeart } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Card, CardContent } from '@/components/ui/card'
import { PedidosOracaoDialog } from '@/components/oracao/PedidosOracaoDialog'
import { getUsers } from '@/services/firebase/auth'
import { subscribeToHorariosOracao } from '@/services/firebase/oracao'
import { DIAS_SEMANA_NOMES, estaOrando, proximoHorario } from '@/lib/oracao'
import type { AppUser, HorarioOracao } from '@/types'

/** Relógio que atualiza a cada 30s — suficiente pra horários com granularidade de minutos. */
export function useAgora(intervaloMs = 30_000): Date {
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), intervaloMs)
    return () => clearInterval(t)
  }, [intervaloMs])
  return agora
}

export function useUsersMap(): Record<string, AppUser> {
  const [users, setUsers] = useState<Record<string, AppUser>>({})
  useEffect(() => {
    getUsers().then(list => setUsers(Object.fromEntries(list.map(u => [u.uid, u]))), () => {})
  }, [])
  return users
}

/**
 * Card "Orando agora" — em tempo real: os horários vêm por onSnapshot e o relógio anda sozinho,
 * então quem entra/sai do horário aparece/some sem recarregar. O ícone abre os pedidos de oração.
 * `linkParaPagina` = mostra o atalho pra página de oração (na Home).
 */
export function OrandoAgoraCard({ linkParaPagina = false }: { linkParaPagina?: boolean }) {
  const [horarios, setHorarios] = useState<HorarioOracao[] | null>(null)
  const [pedidosOpen, setPedidosOpen] = useState(false)
  const users = useUsersMap()
  const agora = useAgora()

  useEffect(() => subscribeToHorariosOracao(setHorarios), [])

  const orando = useMemo(() => (horarios ?? []).filter(h => estaOrando(h, agora)), [horarios, agora])
  const proximo = useMemo(() => (orando.length ? undefined : proximoHorario(horarios ?? [], agora)), [horarios, agora, orando.length])

  if (!horarios) return null

  const nome = (uid: string) => users[uid]?.displayName?.split(' ')[0] ?? 'Alguém'

  /** "hoje", "amanhã" ou o dia da semana do próximo horário. */
  function quandoProximo(emMinutos: number): string {
    const inicio = new Date(agora.getTime() + emMinutos * 60_000)
    const dias = Math.round((new Date(inicio).setHours(0, 0, 0, 0) - new Date(agora).setHours(0, 0, 0, 0)) / 86_400_000)
    return dias === 0 ? 'hoje' : dias === 1 ? 'amanhã' : DIAS_SEMANA_NOMES[inicio.getDay()].toLowerCase()
  }

  return (
    <>
      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                {orando.length > 0 && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
                <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${orando.length ? 'bg-emerald-500' : 'bg-gray-300'}`} />
              </span>
              <p className="text-sm font-semibold text-gray-900">Orando agora</p>
            </div>
            <button
              type="button"
              onClick={() => setPedidosOpen(true)}
              title="Pedidos de oração"
              aria-label="Pedidos de oração"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/15"
            >
              <HandHeart className="h-4 w-4" />
            </button>
          </div>

          {orando.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {orando.map(h => (
                <div key={h.uid} className="flex w-14 flex-col items-center gap-1 text-center">
                  <Avatar
                    photoURL={users[h.uid]?.photoURL}
                    name={users[h.uid]?.displayName}
                    className="h-11 w-11 text-sm ring-2 ring-emerald-400 ring-offset-2"
                  />
                  <span className="w-full truncate text-xs text-gray-700">{nome(h.uid)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-amber-700">Horário vago</p>
              <p className="text-xs text-muted-foreground">
                Ninguém escolheu este horário ainda.
                {proximo && ` Próximo: ${nome(proximo.horario.uid)}, ${quandoProximo(proximo.emMinutos)} às ${proximo.horario.inicio}.`}
              </p>
            </div>
          )}

          {linkParaPagina && (
            <Link
              to="/oracao"
              className="flex items-center justify-center gap-1 rounded-full bg-primary/10 py-2 text-sm font-medium text-primary hover:bg-primary/15"
            >
              Escolher meu horário no relógio de oração
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </CardContent>
      </Card>

      <PedidosOracaoDialog open={pedidosOpen} onClose={() => setPedidosOpen(false)} />
    </>
  )
}
