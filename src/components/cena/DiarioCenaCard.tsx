import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Lock, NotebookPen, Plus, StickyNote, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import {
  atualizarAnotacaoCena,
  criarAnotacaoCena,
  excluirAnotacaoCena,
  subscribeToAnotacoesCena,
} from '@/services/firebase/anotacoesCena'
import { formatRelativeDia, toDateKey } from '@/lib/agenda'
import { formatDuracao, formatHoraCompacta } from '@/lib/cenaHorario'
import { cn } from '@/lib/utils'
import type { AnotacaoCena, AnotacaoVisibilidade, Cena, Ensaio } from '@/types'

interface Props {
  cena: Cena
  /** Ensaios finalizados (registro do ensaio: anotações, duração, presença). */
  registros: Ensaio[]
  todayKey: string
  currentUid?: string
  isAdmin: boolean
  /** Líder, assistentes e admin: escrevem anotações e leem as da liderança. */
  lideranca: boolean
  nameFor: (uid: string) => string
  onAbrirEnsaio: (ensaioId: string) => void
}

type Item = { tipo: 'ensaio'; chave: string; ensaio: Ensaio } | { tipo: 'anotacao'; chave: string; anotacao: AnotacaoCena }

/** "2026-10-13T19:30" no fuso local — pra ordenar anotações junto com os ensaios (data + horário). */
function chaveLocal(iso: string): string {
  const d = new Date(iso)
  return `${toDateKey(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * Diário da cena: os registros dos ensaios finalizados e as anotações avulsas da liderança (fora de
 * ensaio), juntos e do mais recente pro mais antigo. Cada anotação diz quem vê — só a liderança ou
 * o elenco todo.
 */
export function DiarioCenaCard({ cena, registros, todayKey, currentUid, isAdmin, lideranca, nameFor, onAbrirEnsaio }: Props) {
  const [aberto, setAberto] = useState(false)
  const [anotacoes, setAnotacoes] = useState<AnotacaoCena[]>([])
  /** `null` = nova anotação; anotação = abrir/editar; `undefined` = modal fechado. */
  const [emEdicao, setEmEdicao] = useState<AnotacaoCena | null | undefined>(undefined)

  useEffect(() => subscribeToAnotacoesCena(cena.id, lideranca, setAnotacoes), [cena.id, lideranca])

  const itens = useMemo<Item[]>(
    () =>
      [
        ...registros.map(e => ({ tipo: 'ensaio' as const, chave: `${e.data}T${e.horario}`, ensaio: e })),
        ...anotacoes.map(a => ({ tipo: 'anotacao' as const, chave: chaveLocal(a.createdAt), anotacao: a })),
      ].sort((a, b) => b.chave.localeCompare(a.chave)),
    [registros, anotacoes],
  )

  if (!itens.length && !lideranca) return null

  const elencoCount = cena.personagens.filter(p => p.participanteUid).length
  const podeEditar = (a: AnotacaoCena) => isAdmin || cena.liderUid === currentUid || (lideranca && a.autorUid === currentUid)

  return (
    <>
      <Card>
        <CardContent>
          <div className={cn('flex items-center gap-2', aberto && 'pb-2.5 border-b border-gray-100')}>
            <button
              type="button"
              onClick={() => setAberto(v => !v)}
              className="flex flex-1 items-center gap-1.5 text-left text-base font-semibold"
            >
              <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', !aberto && '-rotate-90')} />
              Diário da cena
            </button>
            <span className="text-xs text-muted-foreground">{itens.length}</span>
            {lideranca && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary"
                onClick={() => setEmEdicao(null)}
                title="Nova anotação"
                aria-label="Nova anotação"
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>

          {aberto && (
            <div className="space-y-1 pt-2">
              {!itens.length && (
                <p className="py-2 text-xs text-muted-foreground">
                  Nada por aqui ainda. Os ensaios finalizados entram sozinhos; use o + pra anotar algo fora do ensaio.
                </p>
              )}
              {itens.map(item =>
                item.tipo === 'ensaio' ? (
                  <button
                    key={`e-${item.ensaio.id}`}
                    type="button"
                    onClick={() => onAbrirEnsaio(item.ensaio.id)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1.5 text-left text-sm hover:bg-gray-50"
                  >
                    <NotebookPen className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        Ensaio · {formatRelativeDia(item.ensaio.data, todayKey)} · {formatHoraCompacta(item.ensaio.horario)}
                      </p>
                      {item.ensaio.anotacoes && <p className="truncate text-xs text-gray-500">{item.ensaio.anotacoes}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                      {item.ensaio.duracaoSegundos !== undefined && <span>{formatDuracao(item.ensaio.duracaoSegundos)}</span>}
                      <span>
                        {item.ensaio.presencas?.length ?? 0}/{elencoCount}
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                  </button>
                ) : (
                  <button
                    key={`a-${item.anotacao.id}`}
                    type="button"
                    onClick={() => setEmEdicao(item.anotacao)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1.5 text-left text-sm hover:bg-gray-50"
                  >
                    <StickyNote className="h-4 w-4 shrink-0 text-amber-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.anotacao.titulo || item.anotacao.texto.split('\n')[0]}</p>
                      <p className="truncate text-xs text-gray-500">
                        {formatRelativeDia(toDateKey(new Date(item.anotacao.createdAt)), todayKey)} · {nameFor(item.anotacao.autorUid)}
                      </p>
                    </div>
                    {lideranca &&
                      (item.anotacao.visibilidade === 'lideranca' ? (
                        <Lock className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-label="Só liderança" />
                      ) : (
                        <Users className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-label="Elenco vê" />
                      ))}
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                  </button>
                ),
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {emEdicao !== undefined && (
        <AnotacaoDialog
          key={emEdicao?.id ?? 'nova'}
          cenaId={cena.id}
          anotacao={emEdicao}
          editavel={emEdicao === null || podeEditar(emEdicao)}
          lideranca={lideranca}
          currentUid={currentUid}
          nameFor={nameFor}
          onClose={() => setEmEdicao(undefined)}
        />
      )}
    </>
  )
}

const VISIBILIDADES: { valor: AnotacaoVisibilidade; rotulo: string; Icone: typeof Lock }[] = [
  { valor: 'lideranca', rotulo: 'Só liderança', Icone: Lock },
  { valor: 'elenco', rotulo: 'Elenco todo', Icone: Users },
]

/** Nova anotação, ou uma existente — editável por quem escreveu, pelo líder ou por admin. */
function AnotacaoDialog({
  cenaId,
  anotacao,
  editavel,
  lideranca,
  currentUid,
  nameFor,
  onClose,
}: {
  cenaId: string
  anotacao: AnotacaoCena | null
  editavel: boolean
  lideranca: boolean
  currentUid?: string
  nameFor: (uid: string) => string
  onClose: () => void
}) {
  const [titulo, setTitulo] = useState(anotacao?.titulo ?? '')
  const [texto, setTexto] = useState(anotacao?.texto ?? '')
  const [visibilidade, setVisibilidade] = useState<AnotacaoVisibilidade>(anotacao?.visibilidade ?? 'lideranca')
  const [salvando, setSalvando] = useState(false)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)
  const [erro, setErro] = useState('')

  async function run(fn: () => Promise<void>) {
    setSalvando(true)
    setErro('')
    try {
      await fn()
      onClose()
    } catch (err) {
      console.error('[diário da cena]', err)
      setErro('Não deu pra salvar. Tente de novo.')
    } finally {
      setSalvando(false)
    }
  }

  function salvar() {
    if (!currentUid) return
    const input = { titulo, texto, visibilidade }
    run(() => (anotacao ? atualizarAnotacaoCena(cenaId, anotacao.id, input) : criarAnotacaoCena(cenaId, input, currentUid)))
  }

  const rodape = anotacao && (
    <p className="text-[11px] text-muted-foreground">
      Por {nameFor(anotacao.autorUid)} em {new Date(anotacao.createdAt).toLocaleDateString('pt-BR')}
      {anotacao.updatedAt && ` · editada em ${new Date(anotacao.updatedAt).toLocaleDateString('pt-BR')}`}
    </p>
  )

  if (!editavel && anotacao) {
    return (
      <Dialog open onClose={onClose} title={anotacao.titulo || 'Anotação'}>
        <div className="space-y-3">
          <p className="whitespace-pre-wrap text-sm text-gray-700">{anotacao.texto}</p>
          {lideranca && (
            <p className="text-xs text-muted-foreground">
              {anotacao.visibilidade === 'lideranca' ? 'Só a liderança vê.' : 'O elenco todo vê.'}
            </p>
          )}
          {rodape}
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog open onClose={onClose} title={anotacao ? 'Editar anotação' : 'Nova anotação'}>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="anotacao-titulo">Título (opcional)</Label>
          <Input id="anotacao-titulo" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Ideia de marcação pro final" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="anotacao-texto">Anotação</Label>
          <Textarea id="anotacao-texto" value={texto} onChange={e => setTexto(e.target.value)} rows={6} autoFocus={!anotacao} />
        </div>
        <div className="space-y-1.5">
          <Label>Quem vê</Label>
          <div className="flex gap-2">
            {VISIBILIDADES.map(({ valor, rotulo, Icone }) => (
              <button
                key={valor}
                type="button"
                onClick={() => setVisibilidade(valor)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium',
                  visibilidade === valor ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 text-gray-600',
                )}
              >
                <Icone className="h-4 w-4" />
                {rotulo}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {visibilidade === 'lideranca' ? 'Líder, assistentes e admins.' : 'Todo mundo da cena (e responsáveis das crianças).'}
          </p>
        </div>
        {rodape}
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <div className="flex gap-2">
          {anotacao &&
            (confirmarExclusao ? (
              <Button variant="destructive" className="flex-1" onClick={() => run(() => excluirAnotacaoCena(cenaId, anotacao.id))} disabled={salvando}>
                Confirmar exclusão
              </Button>
            ) : (
              <Button variant="outline" className="text-red-600" onClick={() => setConfirmarExclusao(true)} disabled={salvando}>
                Excluir
              </Button>
            ))}
          <Button className="flex-1 gap-1.5" onClick={salvar} disabled={salvando || !texto.trim()}>
            {salvando && <Spinner size="sm" className="border-white/40 border-t-white" />}
            Salvar
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
