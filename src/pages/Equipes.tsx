import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Crown, HandHelping, Plus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/Spinner'
import { EquipeFormDialog } from '@/components/equipe/EquipeFormDialog'
import { useUsersMap } from '@/components/oracao/OrandoAgora'
import { createEquipes, subscribeToEquipes } from '@/services/firebase/equipes'
import { useAuthStore } from '@/stores/authStore'
import { EQUIPES_PADRAO, equipeIcon } from '@/lib/equipeIcons'
import type { Equipe } from '@/types'

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
          {minhas.length > 0 && <Lista titulo="Minhas equipes" equipes={minhas} users={users} uid={currentUser?.uid} />}
          {outras.length > 0 && (
            <Lista titulo={minhas.length ? 'Outras equipes' : 'Todas as equipes'} equipes={outras} users={users} uid={currentUser?.uid} />
          )}
        </>
      )}

      {isAdmin && criando && (
        <EquipeFormDialog onClose={() => setCriando(false)} onCreated={id => navigate(`/equipes/${id}`)} isAdmin />
      )}
    </div>
  )
}

function Lista({
  titulo,
  equipes,
  users,
  uid,
}: {
  titulo: string
  equipes: Equipe[]
  users: Record<string, { displayName: string }>
  uid?: string
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/80">{titulo}</p>
      <Card className="p-2">
        {equipes.map(e => {
          const Icon = equipeIcon(e.icone)
          const funcao = funcaoNaEquipe(e, uid)
          return (
            <Link key={e.id} to={`/equipes/${e.id}`} className="flex items-center gap-3 rounded-2xl px-2 py-2.5 hover:bg-gray-50">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{e.nome}</p>
                <p className="truncate text-xs text-gray-500">
                  {e.liderUid ? `Líder: ${users[e.liderUid]?.displayName ?? '...'}` : 'Sem líder'} · {e.membros.length}{' '}
                  {e.membros.length === 1 ? 'pessoa' : 'pessoas'}
                </p>
              </div>
              {funcao === 'lider' && <Crown className="h-4 w-4 shrink-0 text-amber-500" aria-label="Você é líder" />}
              {funcao === 'assistente' && <HandHelping className="h-4 w-4 shrink-0 text-primary" aria-label="Você é assistente" />}
              <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
            </Link>
          )
        })}
      </Card>
    </div>
  )
}
