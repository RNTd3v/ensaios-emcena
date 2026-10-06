import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Search, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'
import { PessoaLinha } from '@/components/ui/PessoaLinha'
import { pessoaOpcao } from '@/components/ui/PessoaSelect'
import { useUsersMap } from '@/components/oracao/OrandoAgora'
import { inscricaoValida, useInscricoesStatus } from '@/hooks/useInscricoesStatus'
import { subscribeToAparelhosPush, subscribeToNotificacoes, subscribeToPushStatus } from '@/services/firebase/notificacoes'
import { formatDateTime } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { AparelhoPush, AppUser, Notificacao, PushStatus } from '@/types'

type Nivel = 'ok' | 'atencao' | 'erro' | 'desconhecido'

const COR: Record<Nivel, string> = {
  ok: 'bg-emerald-50 text-emerald-700',
  atencao: 'bg-amber-50 text-amber-800',
  erro: 'bg-red-50 text-red-700',
  desconhecido: 'bg-gray-100 text-gray-600',
}

/** Por que a pessoa recebe (ou não) o push no celular — a partir dos aparelhos e do `pushStatus`. */
function diagnosticoPessoa(aparelhos: number, status: PushStatus | undefined): { nivel: Nivel; texto: string } {
  if (aparelhos > 0) return { nivel: 'ok', texto: `Push ativo · ${aparelhos} ${aparelhos === 1 ? 'aparelho' : 'aparelhos'}` }
  if (!status) return { nivel: 'desconhecido', texto: 'Sem registro — não abriu o app desde a atualização' }
  if (status.estado === 'negado') return { nivel: 'erro', texto: 'Bloqueou as notificações no aparelho' }
  if (status.ios && !status.instalado) return { nivel: 'atencao', texto: 'iPhone sem o app instalado na tela inicial' }
  if (status.estado === 'sem-suporte') return { nivel: 'atencao', texto: 'Navegador sem suporte a notificações' }
  return { nivel: 'atencao', texto: 'Não ativou as notificações' }
}

/** O que aconteceu com uma notificação específica. */
function entrega(n: Notificacao): { nivel: Nivel; texto: string } {
  const p = n.push
  if (!p) return { nivel: 'desconhecido', texto: 'Sem registro (antes do rastreio)' }
  if (p.recebidoEm) return { nivel: 'ok', texto: `Chegou no aparelho · ${formatDateTime(p.recebidoEm)}` }
  if (p.aparelhos === 0) return { nivel: 'atencao', texto: 'Só no app — nenhum aparelho com push ativo' }
  if (p.enviados === undefined) return { nivel: 'desconhecido', texto: 'Enviando…' }
  if (p.enviados > 0) return { nivel: 'atencao', texto: 'Enviada ao aparelho, sem confirmação de chegada' }
  return { nivel: 'erro', texto: `Falhou: ${(p.falhas ?? []).join(', ') || 'erro desconhecido'}` }
}

/** "iPhone", "Android", "Mac"... a partir do user agent. */
function nomeAparelho(userAgent = ''): string {
  if (/iphone/i.test(userAgent)) return 'iPhone'
  if (/ipad/i.test(userAgent)) return 'iPad'
  if (/android/i.test(userAgent)) return 'Android'
  if (/macintosh/i.test(userAgent)) return 'Mac'
  if (/windows/i.test(userAgent)) return 'Windows'
  return 'Outro aparelho'
}

/**
 * Entrega de notificações (só admin): pra cada pessoa, se o push está ativo e, se não, o motivo
 * provável; tocando na pessoa, as últimas notificações dela e o que aconteceu com cada uma.
 */
export function AdminEntregas() {
  const users = useUsersMap()
  const inscricoes = useInscricoesStatus()
  const [status, setStatus] = useState<Record<string, PushStatus> | null>(null)
  const [aparelhos, setAparelhos] = useState<AparelhoPush[]>([])
  const [soProblemas, setSoProblemas] = useState(true)
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState<AppUser | null>(null)

  useEffect(() => subscribeToPushStatus(setStatus), [])
  useEffect(() => subscribeToAparelhosPush(setAparelhos), [])

  const aparelhosPorUid = useMemo(() => {
    const m: Record<string, AparelhoPush[]> = {}
    for (const a of aparelhos) (m[a.uid] ??= []).push(a)
    return m
  }, [aparelhos])

  const pessoas = useMemo(() => {
    // Dependentes não têm aparelho: o push deles vai pros responsáveis. Só quem fez inscrição (e
    // não foi recusada).
    const lista = Object.values(users)
      .filter(u => u.active && !u.dependente && inscricaoValida(inscricoes?.[u.uid]))
      .map(u => ({ user: u, diag: diagnosticoPessoa(aparelhosPorUid[u.uid]?.length ?? 0, status?.[u.uid]) }))
    return lista.sort((a, b) => Number(a.diag.nivel === 'ok') - Number(b.diag.nivel === 'ok') || a.user.displayName.localeCompare(b.user.displayName, 'pt-BR'))
  }, [users, inscricoes, aparelhosPorUid, status])

  const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const visiveis = pessoas.filter(
    p =>
      (!soProblemas || p.diag.nivel !== 'ok') &&
      (!busca.trim() || normalizar(`${p.user.displayName} ${p.user.nomeCompleto ?? ''} ${p.user.apelido ?? ''}`).includes(normalizar(busca.trim()))),
  )
  const comPush = pessoas.filter(p => p.diag.nivel === 'ok').length

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/admin">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-semibold text-white">Entrega de notificações</h1>
      </div>

      {!status || !inscricoes || !Object.keys(users).length ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : (
        <>
          <Card className="space-y-3 p-4">
            <p className="text-sm text-gray-700">
              <span className="font-semibold text-gray-900">{comPush}</span> de {pessoas.length} pessoas com push ativo no celular. As
              demais só veem as notificações dentro do app (no sino).
            </p>
            <div className="flex gap-1.5">
              {[
                { valor: true, label: 'Sem push' },
                { valor: false, label: 'Todos' },
              ].map(f => (
                <button
                  key={f.label}
                  type="button"
                  onClick={() => setSoProblemas(f.valor)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium',
                    soProblemas === f.valor ? 'border-primary bg-primary text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou apelido" className="pl-9" />
            </div>
          </Card>

          <Card className="p-2">
            {visiveis.map(({ user: u, diag }) => (
              <PessoaLinha
                key={u.uid}
                pessoa={pessoaOpcao(u.uid, u)}
                detalhe={<span className={cn('rounded px-1', COR[diag.nivel])}>{diag.texto}</span>}
                onClick={() => setAberto(u)}
                className="rounded-xl px-2 py-1.5 hover:bg-gray-50"
              />
            ))}
            {visiveis.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Ninguém nesse filtro.</p>}
          </Card>
        </>
      )}

      {aberto && (
        <PessoaEntregasDialog user={aberto} aparelhos={aparelhosPorUid[aberto.uid] ?? []} status={status?.[aberto.uid]} onClose={() => setAberto(null)} />
      )}
    </div>
  )
}

function PessoaEntregasDialog({
  user,
  aparelhos,
  status,
  onClose,
}: {
  user: AppUser
  aparelhos: AparelhoPush[]
  status?: PushStatus
  onClose: () => void
}) {
  const [notificacoes, setNotificacoes] = useState<Notificacao[] | null>(null)
  useEffect(() => subscribeToNotificacoes(user.uid, setNotificacoes, 30), [user.uid])
  const diag = diagnosticoPessoa(aparelhos.length, status)

  return (
    <Dialog open onClose={onClose} title={user.nomeCompleto || user.displayName}>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <p className={cn('rounded-lg px-3 py-2 text-sm font-medium', COR[diag.nivel])}>{diag.texto}</p>
          {aparelhos.map(a => (
            <p key={a.token} className="flex items-center gap-1.5 text-xs text-gray-600">
              <Smartphone className="h-3.5 w-3.5 shrink-0" />
              {nomeAparelho(a.userAgent)} · ativado em {formatDateTime(a.createdAt)}
            </p>
          ))}
          {status && (
            <p className="text-[11px] text-muted-foreground">
              Último acesso registrado: {nomeAparelho(status.userAgent)}
              {status.instalado ? ' (app instalado)' : ' (navegador)'} · {formatDateTime(status.atualizadoEm)}
            </p>
          )}
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Últimas notificações</p>
          {!notificacoes ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : notificacoes.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma notificação.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {notificacoes.map(n => {
                const e = entrega(n)
                return (
                  <div key={n.id} className="py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-medium text-gray-900">{n.titulo}</p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{formatDateTime(n.createdAt)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                      <span className={cn('rounded px-1.5 py-0.5', COR[e.nivel])}>{e.texto}</span>
                      <span className={cn('rounded px-1.5 py-0.5', n.lida ? COR.ok : COR.desconhecido)}>
                        {n.lida ? `Lida no app${n.lidaEm ? ` · ${formatDateTime(n.lidaEm)}` : ''}` : 'Não lida'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Se não aparece aqui, a notificação não foi gerada pra essa pessoa (ela não estava no público do envio) — ou ela apagou.
          </p>
        </div>
      </div>
    </Dialog>
  )
}
