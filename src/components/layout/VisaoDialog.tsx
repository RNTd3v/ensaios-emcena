import { Check, ShieldCheck, User } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { trocarVisao, useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

const OPCOES = [
  {
    participante: false,
    titulo: 'Admin',
    descricao: 'Vê e gerencia tudo: todas as cenas, Gerenciamento, Calendário geral, Configurações.',
    Icone: ShieldCheck,
  },
  {
    participante: true,
    titulo: 'Participante',
    descricao: 'Vê o app como o elenco vê: só as suas cenas e equipes, sem os menus e botões de admin.',
    Icone: User,
  },
] as const

/** Admin escolhe como vê o app (menu → foto). Só muda a tela — no servidor continua admin. */
export function VisaoDialog({ onClose }: { onClose: () => void }) {
  const visaoParticipante = useAuthStore(s => s.visaoParticipante)

  function escolher(participante: boolean) {
    if (participante !== visaoParticipante) {
      // Fica na mesma tela nos dois sentidos — ela se atualiza com a visão nova. Se a tela for só
      // de admin (Gerenciamento, Calendário...), o próprio AdminGuard leva pro início.
      trocarVisao(participante)
    }
    onClose()
  }

  return (
    <Dialog open onClose={onClose} title="Visão do app">
      <div className="space-y-2">
        {OPCOES.map(o => {
          const ativa = o.participante === visaoParticipante
          return (
            <button
              key={o.titulo}
              type="button"
              onClick={() => escolher(o.participante)}
              className={cn(
                'flex w-full items-start gap-3 rounded-xl border p-3 text-left',
                ativa ? 'border-primary bg-primary/10' : 'border-gray-200 hover:bg-gray-50',
              )}
            >
              <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', ativa ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600')}>
                <o.Icone className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-gray-900">{o.titulo}</span>
                <span className="block text-xs text-muted-foreground">{o.descricao}</span>
              </span>
              {ativa && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </button>
          )
        })}
        <p className="pt-1 text-[11px] text-muted-foreground">
          Muda só o que aparece neste aparelho. Suas permissões de admin continuam valendo — dá pra voltar a qualquer momento por aqui.
        </p>
      </div>
    </Dialog>
  )
}
