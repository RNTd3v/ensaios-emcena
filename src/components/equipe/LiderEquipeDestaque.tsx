import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { PessoaLinha } from '@/components/ui/PessoaLinha'
import { pessoaOpcao } from '@/components/ui/PessoaSelect'
import { ContatoPessoaDialog } from '@/components/cena/ContatoPessoaDialog'
import { subscribeToAllInscricoes } from '@/services/firebase/inscricoes'
import { useAuthStore } from '@/stores/authStore'
import type { AppUser, Equipe, Inscricao } from '@/types'

/**
 * Líder de uma equipe em destaque no topo de uma página (ex.: sonoplastia em Músicas, figurino em
 * Figurinos). Tocar abre o contato com o WhatsApp. Sem equipe ou sem líder, não mostra nada.
 */
export function LiderEquipeDestaque({ equipe, users, titulo }: { equipe?: Equipe; users: Record<string, AppUser>; titulo: string }) {
  const role = useAuthStore(s => s.user?.role)
  const podeVerContato = role === 'admin' || role === 'lider'
  const [inscricoes, setInscricoes] = useState<Inscricao[]>([])
  const [aberto, setAberto] = useState(false)
  useEffect(() => (podeVerContato ? subscribeToAllInscricoes(setInscricoes) : undefined), [podeVerContato])

  const uid = equipe?.liderUid
  if (!equipe || !uid) return null
  return (
    <>
      <Card className="p-3">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</p>
        <PessoaLinha pessoa={pessoaOpcao(uid, users[uid])} funcao="lider" onClick={() => setAberto(true)} className="py-0" />
      </Card>
      {aberto && (
        <ContatoPessoaDialog
          uid={uid}
          funcao="lider"
          users={users}
          inscricao={inscricoes.find(i => i.uid === uid)}
          telefone={equipe.liderTelefone}
          onClose={() => setAberto(false)}
        />
      )}
    </>
  )
}
