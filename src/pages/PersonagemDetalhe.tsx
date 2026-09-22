import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/Spinner'
import { subscribeToAllInscricoes } from '@/services/firebase/inscricoes'
import { getUsers } from '@/services/firebase/auth'
import { subscribeToCena } from '@/services/firebase/cenas'
import type { AppUser, Cena, Inscricao } from '@/types'

/**
 * Tela de detalhe do personagem — hoje só mostra nome e quem interpreta. Ainda vai ganhar infos
 * próprias do personagem (foto, descrição etc.).
 */
export function PersonagemDetalhe() {
  const { cenaId, personagemId } = useParams<{ cenaId: string; personagemId: string }>()
  const [cena, setCena] = useState<Cena | null | undefined>(undefined)
  const [inscricoes, setInscricoes] = useState<Inscricao[] | null>(null)
  const [users, setUsers] = useState<Record<string, AppUser>>({})

  useEffect(() => {
    if (!cenaId) return
    return subscribeToCena(cenaId, setCena)
  }, [cenaId])

  useEffect(() => subscribeToAllInscricoes(setInscricoes), [])

  useEffect(() => {
    getUsers().then(list => setUsers(Object.fromEntries(list.map(u => [u.uid, u]))))
  }, [])

  const inscricoesByUid = Object.fromEntries((inscricoes ?? []).map(i => [i.uid, i]))

  function nameFor(uid: string) {
    return inscricoesByUid[uid]?.apelido || inscricoesByUid[uid]?.nomeCompleto || users[uid]?.displayName || 'Sem nome'
  }

  const personagem = cena?.personagens.find(p => p.id === personagemId)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to={cenaId ? `/cenas/${cenaId}` : '/cenas'}>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-semibold text-white flex-1 truncate">{personagem?.nome ?? 'Personagem'}</h1>
      </div>

      {cena === undefined && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}

      {(cena === null || (cena && !personagem)) && (
        <Card>
          <CardContent className="text-center text-sm text-muted-foreground py-6">Esse personagem não existe (ou foi removido).</CardContent>
        </Card>
      )}

      {personagem && (
        <Card>
          <CardContent className="py-4 space-y-4">
            <div className="flex items-center gap-3">
              <Avatar
                photoURL={personagem.participanteUid ? users[personagem.participanteUid]?.photoURL : undefined}
                name={personagem.nome}
                className="h-14 w-14 text-base"
              />
              <div className="min-w-0">
                <p className="text-base font-semibold truncate">{personagem.nome}</p>
                <p className="text-sm text-muted-foreground truncate">
                  {personagem.participanteUid ? nameFor(personagem.participanteUid) : 'Sem participante vinculado'}
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground pt-2 border-t border-gray-100">
              Em breve: mais informações desse personagem por aqui.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
