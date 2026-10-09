import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, CalendarClock, ChevronDown, CircleDashed, Crown, HandHelping, ListChecks, Plus, Sparkles, Users } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { pessoaOpcao } from '@/components/ui/PessoaSelect'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/Spinner'
import { EquipeFormDialog } from '@/components/equipe/EquipeFormDialog'
import { useUsersMap } from '@/components/oracao/OrandoAgora'
import { createEquipes, subscribeToEquipes } from '@/services/firebase/equipes'
import { subscribeToTarefas } from '@/services/firebase/tarefas'
import { estaAberta } from '@/lib/tarefas'
import { toDateKey } from '@/lib/agenda'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { EQUIPES_PADRAO, equipeIcon } from '@/lib/equipeIcons'
import type { AppUser, Equipe, Tarefa } from '@/types'

type MinhaFuncao = 'lider' | 'assistente' | 'membro'

export function funcaoNaEquipe(equipe: Equipe, uid: string | undefined): MinhaFuncao | undefined {
  if (!uid) return undefined
  if (equipe.liderUid === uid) return 'lider'
  if (equipe.assistentes.includes(uid)) return 'assistente'
  if (equipe.membros.includes(uid)) return 'membro'
  return undefined
}

/** Lista das equipes de staff — as da pessoa primeiro. Admin cria equipes (e as padrão de uma vez). */
export function Equipes() {
  const currentUser = useAuthStore(s => s.user)
  const navigate = useNavigate()
  const users = useUsersMap()
  const [equipes, setEquipes] = useState<Equipe[] | null>(null)
  const [criando, setCriando] = useState(false)
  const [criandoPadrao, setCriandoPadrao] = useState(false)

  useEffect(() => subscribeToEquipes(setEquipes), [])

  const isAdmin = currentUser?.role === 'admin'
  const minhas = useMemo(() => (equipes ?? []).filter(e => funcaoNaEquipe(e, currentUser?.uid)), [equipes, currentUser?.uid])
  const outras = useMemo(() => (equipes ?? []).filter(e => !funcaoNaEquipe(e, currentUser?.uid)), [equipes, currentUser?.uid])

  const nomesExistentes = new Set((equipes ?? []).map(e => e.nome.trim().toLowerCase()))
  const padraoFaltando = EQUIPES_PADRAO.filter(e => !nomesExistentes.has(e.nome.toLowerCase()))

  async function handleCriarPadrao() {
    setCriandoPadrao(true)
    try {
      await createEquipes(padraoFaltando)
    } finally {
      setCriandoPadrao(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link to="/">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-xl font-semibold text-white">Equipes</h1>
        </div>
        {isAdmin && (
          <Button size="icon" title="Nova equipe" onClick={() => setCriando(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      {isAdmin && equipes && padraoFaltando.length > 0 && (
        <Button
          variant="outline"
          className="w-full gap-1.5 border-white/40 bg-white/10 text-white hover:bg-white/20"
          onClick={handleCriarPadrao}
          disabled={criandoPadrao}
        >
          {criandoPadrao ? <Spinner size="sm" /> : <Sparkles className="h-4 w-4" />}
          Criar equipes padrão ({padraoFaltando.map(e => e.nome).join(', ')})
        </Button>
      )}

      {!equipes ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : equipes.length === 0 ? (
        <p className="py-6 text-center text-sm text-white/80">Nenhuma equipe criada ainda.</p>
      ) : (
        <>
          {minhas.length > 0 && <Lista titulo="Minhas equipes" equipes={minhas} users={users} uid={currentUser?.uid} abertas />}
          {outras.length > 0 && (
            <Lista titulo={minhas.length ? 'Outras equipes' : 'Todas as equipes'} equipes={outras} users={users} uid={currentUser?.uid} abertas={false} />
          )}
        </>
      )}

      {isAdmin && criando && (
        <EquipeFormDialog onClose={() => setCriando(false)} onCreated={id => navigate(`/equipes/${id}`)} isAdmin />
      )}
    </div>
  )
}

function Lista({ titulo, equipes, users, uid, abertas }: { titulo: string; equipes: Equipe[]; users: Record<string, AppUser>; uid?: string; abertas: boolean }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/80">{titulo}</p>
      {equipes.map(e => (
        <EquipeCard key={e.id} equipe={e} users={users} uid={uid} abertaInicial={abertas} />
      ))}
    </div>
  )
}

function formatPrazo(prazo: string) {
  return new Date(`${prazo}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

/**
 * Uma equipe: fechada mostra ícone, nome e líder; aberta mostra quantas pessoas, o total de
 * tarefas e as que estão em andamento com o prazo. As tarefas só são lidas com o card aberto
 * (em "Minhas equipes" já abre, a não ser que a equipe não tenha nenhuma tarefa).
 */
function EquipeCard({ equipe, users, uid, abertaInicial }: { equipe: Equipe; users: Record<string, AppUser>; uid?: string; abertaInicial: boolean }) {
  // 'auto' (minhas equipes): lê as tarefas com o card ainda fechado e só abre se tiver alguma.
  const [estado, setEstado] = useState<boolean | 'auto'>(abertaInicial ? 'auto' : false)
  const aberta = estado === true
  const [tarefas, setTarefas] = useState<Tarefa[] | null>(null)

  useEffect(() => {
    if (!estado) return
    return subscribeToTarefas(equipe.id, ts => {
      setTarefas(ts)
      setEstado(v => (v === 'auto' ? ts.length > 0 : v))
    })
  }, [estado, equipe.id])

  const Icon = equipeIcon(equipe.icone)
  const funcao = funcaoNaEquipe(equipe, uid)
  const lider = equipe.liderUid ? pessoaOpcao(equipe.liderUid, users[equipe.liderUid]) : undefined
  const assistentes = equipe.assistentes.filter(a => a !== equipe.liderUid).map(a => pessoaOpcao(a, users[a]))
  const todayKey = toDateKey(new Date())

  const emAndamento = (tarefas ?? [])
    .filter(t => t.status === 'fazendo')
    .sort((a, b) => (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999'))
  const abertasCount = (tarefas ?? []).filter(t => estaAberta(t.status)).length
  const feitasCount = (tarefas ?? []).filter(t => t.status === 'feito').length

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center">
      <Link to={`/equipes/${equipe.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-base font-semibold">
            <span className="truncate">{equipe.nome}</span>
            {funcao === 'lider' && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label="Você é líder" />}
            {funcao === 'assistente' && <HandHelping className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Você é assistente" />}
          </p>
          {lider ? (
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Avatar photoURL={lider.photoURL} name={lider.nome} className="h-5 w-5 text-[9px]" />
              <span className="truncate">
                <span className="text-amber-600">Líder</span> · {lider.nome}
                {lider.apelido && <span className="text-muted-foreground/80"> ({lider.apelido})</span>}
              </span>
            </div>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">Sem líder</p>
          )}
          {assistentes.length > 0 && (
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="flex shrink-0 -space-x-1.5">
                {assistentes.slice(0, 3).map(a => (
                  <Avatar key={a.uid} photoURL={a.photoURL} name={a.nome} className="h-5 w-5 text-[9px] ring-1 ring-white" />
                ))}
              </span>
              <span className="truncate">
                <span className="text-primary">{assistentes.length === 1 ? 'Assistente' : 'Assistentes'}</span> ·{' '}
                {assistentes.map(a => a.apelido || a.nome.split(' ')[0]).join(', ')}
              </span>
            </div>
          )}
        </div>
      </Link>
      {/* Só o chevron abre/fecha o resumo; o resto do card leva pra equipe. */}
      <button
        type="button"
        onClick={() => setEstado(!aberta)}
        aria-expanded={aberta}
        aria-label={aberta ? 'Fechar resumo' : 'Abrir resumo'}
        className="flex shrink-0 items-center self-stretch pl-2 pr-2.5"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100">
          <ChevronDown className={cn('h-5 w-5 text-gray-400 transition-transform', aberta && 'rotate-180')} />
        </span>
      </button>
      </div>

      {aberta && (
        <Link to={`/equipes/${equipe.id}`} className="block space-y-3 border-t border-gray-100 px-4 pb-4 pt-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-gray-50 px-3 py-2">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                Pessoas
              </p>
              <p className="text-lg font-semibold text-gray-900">{equipe.membros.length}</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-3 py-2">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ListChecks className="h-3.5 w-3.5" />
                Tarefas
              </p>
              {tarefas ? (
                <p className="text-lg font-semibold text-gray-900">
                  {tarefas.length}
                  {tarefas.length > 0 && (
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      {abertasCount} {abertasCount === 1 ? 'aberta' : 'abertas'} · {feitasCount} {feitasCount === 1 ? 'feita' : 'feitas'}
                    </span>
                  )}
                </p>
              ) : (
                <Spinner size="sm" className="mt-1.5" />
              )}
            </div>
          </div>

          {tarefas && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-blue-700">
                <CircleDashed className="h-3.5 w-3.5" />
                Em andamento
              </p>
              {emAndamento.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma tarefa em andamento.</p>
              ) : (
                <div className="space-y-1.5">
                  {emAndamento.map(t => {
                    const atrasada = !!t.prazo && t.prazo < todayKey
                    const responsavel = t.responsavelUid ? pessoaOpcao(t.responsavelUid, users[t.responsavelUid]) : undefined
                    return (
                      <div key={t.id} className="flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-100/60 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900">{t.titulo}</p>
                          <p className={cn('flex items-center gap-1 text-xs text-muted-foreground', atrasada && 'font-medium text-red-600')}>
                            <CalendarClock className="h-3 w-3" />
                            {t.prazo ? `Prazo ${formatPrazo(t.prazo)}${atrasada ? ' · atrasada' : ''}` : 'Sem prazo'}
                          </p>
                        </div>
                        {responsavel && (
                          <Avatar
                            photoURL={responsavel.photoURL}
                            name={responsavel.nome}
                            className="h-7 w-7 text-[10px]"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </Link>
      )}
    </Card>
  )
}
