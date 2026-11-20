import { useState } from 'react'
import { Check, CheckCheck, CircleHelp, X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/Spinner'
import { RespostaPresenca, ensaioJaComecou } from '@/components/ensaio/RespostaPresenca'
import { useUsersMap } from '@/components/oracao/OrandoAgora'
import { confirmarPresenca, uidsAusentes } from '@/services/firebase/ensaios'
import { confirmarPresencaTreinamento } from '@/services/firebase/treinamentos'
import { canCheckin } from '@/lib/agenda'
import { cn } from '@/lib/utils'
import type { Ensaio } from '@/types'

type Alvo = Pick<Ensaio, 'id' | 'data' | 'horario' | 'presencas' | 'ausentes' | 'ausencias'>

/** Alguém da casa que responde: a própria pessoa (sem `nome`) ou um filho. */
interface Pessoa {
  uid: string
  nome?: string
}

/** Foto com o status da resposta (✓ vai, ✗ não vai, ? sem resposta); com `onClick` é tocável, sem ele só mostra. */
export function AvatarStatus({ sessao, uid, nome, onClick }: { sessao: Alvo; uid: string; nome: string; onClick?: () => void }) {
  const users = useUsersMap()
  const vai = !!sessao.presencas?.includes(uid)
  const naoVai = uidsAusentes(sessao).includes(uid)
  const Icone = vai ? Check : naoVai ? X : CircleHelp
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag {...(onClick ? { type: 'button' as const, onClick } : {})} className="flex w-16 flex-col items-center gap-1 text-center">
      <span className="relative">
        <Avatar
          photoURL={users[uid]?.photoURL}
          name={nome}
          className={cn('h-12 w-12 text-sm ring-2 ring-offset-1', vai ? 'ring-emerald-500' : naoVai ? 'ring-red-400' : 'ring-gray-300')}
        />
        <span
          className={cn(
            'absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full text-white ring-2 ring-white',
            vai ? 'bg-emerald-500' : naoVai ? 'bg-red-500' : 'bg-gray-400',
          )}
        >
          <Icone className="h-3 w-3" />
        </span>
      </span>
      <span className="w-full truncate text-xs font-medium text-gray-800">{nome}</span>
    </Tag>
  )
}

/**
 * Resposta de várias pessoas da casa (ensaio ou sessão de treinamento): a foto de cada uma com o
 * status; tocar abre "Vou" / "Não vou" daquela pessoa. "Todos vão" confirma as que não responderam.
 * O cônjuge (`conjuge`) aparece só pra ver, sem resposta.
 */
export function RespostasDaCasa({
  sessao,
  pessoas,
  checkinLimiteHoras,
  conjuge,
  tipo = 'ensaio',
}: {
  sessao: Alvo
  pessoas: Pessoa[]
  checkinLimiteHoras: number
  conjuge?: { uid: string; nome: string }
  tipo?: 'ensaio' | 'treinamento'
}) {
  const [aberta, setAberta] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const ausentes = uidsAusentes(sessao)
  const semResposta = pessoas.filter(p => !sessao.presencas?.includes(p.uid) && !ausentes.includes(p.uid))
  const comecou = ensaioJaComecou(sessao)
  const aberto = canCheckin(sessao.data, sessao.horario, checkinLimiteHoras)
  const pessoaAberta = pessoas.find(p => p.uid === aberta)
  const confirmar = tipo === 'treinamento' ? confirmarPresencaTreinamento : confirmarPresenca

  async function confirmarTodos() {
    setSaving(true)
    setError('')
    try {
      await Promise.all(semResposta.map(p => confirmar(sessao.id, p.uid)))
    } catch {
      setError('Não foi possível salvar. Tente de novo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 border-t border-gray-100 pt-3">
      <div className="flex flex-wrap gap-4">
        {pessoas.map(p => (
          <AvatarStatus key={p.uid} sessao={sessao} uid={p.uid} nome={p.nome ?? 'Você'} onClick={() => setAberta(p.uid)} />
        ))}
        {conjuge && <AvatarStatus sessao={sessao} uid={conjuge.uid} nome={conjuge.nome} />}
      </div>

      {!comecou && semResposta.length >= 2 && (
        <div className="space-y-1">
          <Button size="sm" className="w-full gap-1.5" onClick={confirmarTodos} disabled={saving || !aberto}>
            {saving ? <Spinner size="sm" className="border-white/40 border-t-white" /> : <CheckCheck className="h-4 w-4" />}
            Todos vão
          </Button>
          {!aberto && <p className="text-xs text-muted-foreground">A confirmação ainda não está aberta (ou já fechou).</p>}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}

      {pessoaAberta && (
        <Dialog open onClose={() => setAberta(null)} title={pessoaAberta.nome ?? 'Você'}>
          <RespostaPresenca
            ensaio={sessao}
            uid={pessoaAberta.uid}
            checkinLimiteHoras={checkinLimiteHoras}
            paraQuem={pessoaAberta.nome}
            tipo={tipo}
          />
        </Dialog>
      )}
    </div>
  )
}
