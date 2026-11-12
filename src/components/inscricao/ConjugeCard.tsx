import { useEffect, useMemo, useState } from 'react'
import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getUsers } from '@/services/firebase/auth'
import { aceitarVinculo, pedirVinculo, removerVinculo, subscribeToMeusVinculos, type VinculoConjuge } from '@/services/firebase/conjuges'
import { PessoaSelect, inscritosConfirmados, pessoaOpcao } from '@/components/ui/PessoaSelect'
import { PessoaLinha } from '@/components/ui/PessoaLinha'
import type { AppUser } from '@/types'

/**
 * Cônjuge: a pessoa vinculada (com aceite dos dois lados) passa a ver os ensaios um do outro no
 * Calendário — só pra organização, sem avisos e sem poder editar nem responder presença.
 */
export function ConjugeCard({ uid }: { uid: string }) {
  const [vinculos, setVinculos] = useState<VinculoConjuge[] | null>(null)
  const [users, setUsers] = useState<Record<string, AppUser>>({})
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => subscribeToMeusVinculos(uid, setVinculos), [uid])
  useEffect(() => {
    getUsers().then(l => setUsers(Object.fromEntries(l.map(u => [u.uid, u]))), () => {})
  }, [])

  const candidatos = useMemo(
    () =>
      inscritosConfirmados(users)
        .filter(u => !u.dependente && u.uid !== uid)
        .map(u => pessoaOpcao(u.uid, u)),
    [users, uid],
  )

  async function executar(acao: () => Promise<void>) {
    setOcupado(true)
    setErro('')
    try {
      await acao()
    } catch {
      setErro('Não deu certo. Tente de novo.')
    } finally {
      setOcupado(false)
    }
  }

  if (!vinculos) return null
  const outro = (v: VinculoConjuge) => v.uids.find(u => u !== uid) ?? ''
  const aceito = vinculos.find(v => v.status === 'aceito')
  const enviado = vinculos.find(v => v.status === 'pendente' && v.solicitanteUid === uid)
  const recebidos = vinculos.filter(v => v.status === 'pendente' && v.solicitanteUid !== uid)

  return (
    <Card>
      <CardContent className="space-y-3">
        <div>
          <p className="flex items-center gap-1.5 text-base font-semibold">
            <Heart className="h-4 w-4 text-primary" />
            Cônjuge
          </p>
          <p className="text-xs text-muted-foreground">
            Vocês dois passam a ver os ensaios um do outro no calendário, só pra organização. Não dá pra editar nem responder presença pelo outro.
          </p>
        </div>

        {aceito && (
          <PessoaLinha pessoa={pessoaOpcao(outro(aceito), users[outro(aceito)])} detalhe="Vínculo ativo" className="rounded-lg bg-gray-50 px-2 py-1.5">
            <Button size="sm" variant="outline" disabled={ocupado} onClick={() => executar(() => removerVinculo(aceito.id))}>
              Desfazer
            </Button>
          </PessoaLinha>
        )}

        {!aceito && enviado && (
          <PessoaLinha pessoa={pessoaOpcao(outro(enviado), users[outro(enviado)])} detalhe="Aguardando aceite" className="rounded-lg bg-gray-50 px-2 py-1.5">
            <Button size="sm" variant="outline" disabled={ocupado} onClick={() => executar(() => removerVinculo(enviado.id))}>
              Cancelar
            </Button>
          </PessoaLinha>
        )}

        {!aceito &&
          recebidos.map(v => (
            <PessoaLinha key={v.id} pessoa={pessoaOpcao(outro(v), users[outro(v)])} detalhe="Quer se vincular a você" className="rounded-lg bg-gray-50 px-2 py-1.5">
              <div className="flex gap-1.5">
                <Button size="sm" disabled={ocupado} onClick={() => executar(() => aceitarVinculo(v.id))}>
                  Aceitar
                </Button>
                <Button size="sm" variant="outline" disabled={ocupado} onClick={() => executar(() => removerVinculo(v.id))}>
                  Recusar
                </Button>
              </div>
            </PessoaLinha>
          ))}

        {!aceito && !enviado && (
          <PessoaSelect
            value=""
            onChange={v => v && executar(() => pedirVinculo(uid, v))}
            pessoas={candidatos}
            placeholder="Escolher pessoa..."
            titulo="Vincular cônjuge"
            aria-label="Vincular cônjuge"
          />
        )}
        {erro && <p className="text-sm text-destructive">{erro}</p>}
      </CardContent>
    </Card>
  )
}
