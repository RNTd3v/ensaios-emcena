import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, MapPin } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/Spinner'
import { useEnsaiosDasMinhasCenas } from '@/hooks/useEnsaiosDasMinhasCenas'
import { toDateKey } from '@/lib/agenda'
import { formatHoraCompacta } from '@/lib/cenaHorario'
import { uidsDoEnsaio, type PessoaDaCasaNome } from '@/lib/ensaioPublico'
import { cn } from '@/lib/utils'
import type { Cena, Ensaio } from '@/types'

type Item = { ensaio: Ensaio; cena: Cena }

const porDataHora = (a: Item, b: Item) =>
  a.ensaio.data.localeCompare(b.ensaio.data) || a.ensaio.horario.localeCompare(b.ensaio.horario)

/** "Ana", "Ana e Beto", "Ana, Beto e Caio". */
function juntarNomes(nomes: string[]): string {
  return nomes.length > 1 ? `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}` : (nomes[0] ?? '')
}

interface Props {
  uid: string
  dependentes: PessoaDaCasaNome[]
  /** Datas da semana (segunda a domingo). */
  semana: Date[]
  onClose: () => void
}

/**
 * Os ensaios confirmados (não cancelados) da semana em que a pessoa logada ou um dependente dela
 * foi chamado (ver `uidsDoEnsaio`) — cada ensaio uma vez só, com quem da casa está nele.
 */
export function MeusEnsaiosSemanaDialog({ uid, dependentes, semana, onClose }: Props) {
  const [porPessoa, setPorPessoa] = useState<Record<string, Item[] | null>>({})
  const reportar = useCallback((quem: string, itens: Item[] | null) => setPorPessoa(prev => ({ ...prev, [quem]: itens })), [])

  const inicio = toDateKey(semana[0])
  const fim = toDateKey(semana[semana.length - 1])
  const todayKey = toDateKey(new Date())
  const pessoas = useMemo(() => [{ uid, nome: 'Você' }, ...dependentes], [uid, dependentes])
  const carregando = pessoas.some(p => !porPessoa[p.uid])

  const itens = useMemo(() => {
    const porId = new Map<string, Item & { nomes: string[] }>()
    for (const p of pessoas) {
      for (const item of porPessoa[p.uid] ?? []) {
        const atual = porId.get(item.ensaio.id) ?? { ...item, nomes: [] }
        atual.nomes.push(p.nome)
        porId.set(item.ensaio.id, atual)
      }
    }
    return [...porId.values()].sort(porDataHora)
  }, [pessoas, porPessoa])

  const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')

  return (
    <Dialog open onClose={onClose} title="Meus ensaios da semana">
      {pessoas.map(p => (
        <Coletor key={p.uid} uid={p.uid} dependenteDe={p.uid === uid ? undefined : uid} inicio={inicio} fim={fim} onChange={reportar} />
      ))}
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {fmt(semana[0])} – {fmt(semana[semana.length - 1])} · só os confirmados
          {dependentes.length > 0 ? ', seus e dos seus dependentes' : ''}.
        </p>
        {carregando ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : !itens.length ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Nenhum ensaio confirmado nessa semana.</p>
        ) : (
          <div className="-mx-1 divide-y divide-gray-100">
            {itens.map(({ ensaio, cena, nomes }) => (
              <Link
                key={ensaio.id}
                to={`/cenas/${cena.id}/ensaios/${ensaio.id}`}
                onClick={onClose}
                className={cn('flex items-center gap-3 px-1 py-2.5', ensaio.data < todayKey && 'opacity-60')}
              >
                <div className="w-14 shrink-0 text-center">
                  <p className="text-[11px] font-medium uppercase text-muted-foreground">
                    {new Date(`${ensaio.data}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
                  </p>
                  <p className="text-sm font-semibold text-primary">{formatHoraCompacta(ensaio.horario)}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{cena.nome}</p>
                  <p className="truncate text-xs text-gray-500">
                    {new Date(`${ensaio.data}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    {' · '}
                    {juntarNomes(nomes)}
                  </p>
                  {ensaio.local && (
                    <p className="flex items-center gap-1 text-xs text-gray-500">
                      <MapPin className="h-3 w-3 shrink-0 text-primary" />
                      <span className="truncate">{ensaio.local}</span>
                    </p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  )
}

/** Ensaios confirmados da semana em que `uid` foi chamado; `null` enquanto as cenas (e os ensaios delas) carregam. */
function Coletor({
  uid,
  dependenteDe,
  inicio,
  fim,
  onChange,
}: {
  uid: string
  dependenteDe?: string
  inicio: string
  fim: string
  onChange: (uid: string, itens: Item[] | null) => void
}) {
  const { cenas, minhasCenas, ensaiosPorCena } = useEnsaiosDasMinhasCenas(uid, dependenteDe)

  const itens = useMemo<Item[] | null>(() => {
    if (!cenas || minhasCenas.some(c => !ensaiosPorCena[c.id])) return null
    const lista: Item[] = []
    for (const cena of minhasCenas) {
      for (const e of ensaiosPorCena[cena.id] ?? []) {
        if (e.canceledByUid || e.data < inicio || e.data > fim) continue
        if (!uidsDoEnsaio(cena.personagens, e).has(uid)) continue
        lista.push({ ensaio: e, cena })
      }
    }
    return lista
  }, [cenas, minhasCenas, ensaiosPorCena, inicio, fim, uid])

  useEffect(() => onChange(uid, itens), [onChange, uid, itens])

  return null
}
