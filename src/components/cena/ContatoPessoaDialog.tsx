import { MessageCircle } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { PessoaLinha } from '@/components/ui/PessoaLinha'
import { pessoaOpcao } from '@/components/ui/PessoaSelect'
import { whatsappLink } from '@/lib/formatters'
import type { AppUser, Inscricao } from '@/types'

export type FuncaoNaCena = 'lider' | 'assistente' | 'participante'

const PAPEL: Record<FuncaoNaCena, string> = {
  lider: 'Líder da cena',
  assistente: 'Assistente da cena',
  participante: 'Participante da cena',
}

/**
 * Quem é a pessoa numa cena (líder, assistente ou participante) e como falar com ela. O contato vem
 * da inscrição — que só admin/líder leem; sem ela, avisa que não há dados.
 */
export function ContatoPessoaDialog({
  uid,
  funcao,
  users,
  inscricao,
  onClose,
}: {
  uid: string
  funcao: FuncaoNaCena
  users: Record<string, AppUser>
  inscricao?: Inscricao
  onClose: () => void
}) {
  return (
    <Dialog
      open
      onClose={onClose}
      title={<PessoaLinha pessoa={pessoaOpcao(uid, users[uid], inscricao)} funcao={funcao === 'participante' ? undefined : funcao} />}
    >
      <div className="divide-y divide-gray-100">
        <div className="py-3 first:pt-0">
          <p className="text-sm text-muted-foreground">Papel</p>
          <p className="text-base">{PAPEL[funcao]}</p>
        </div>
        {inscricao?.telefone && (
          <div className="py-3">
            <p className="text-sm text-muted-foreground">Telefone (WhatsApp)</p>
            <a
              href={whatsappLink(inscricao.telefone)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-base text-primary hover:underline"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {inscricao.telefone}
            </a>
          </div>
        )}
        {inscricao?.email && (
          <div className="py-3">
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="text-base">{inscricao.email}</p>
          </div>
        )}
        {!inscricao && <p className="py-3 text-sm text-muted-foreground">Sem dados de contato cadastrados.</p>}
      </div>
    </Dialog>
  )
}
