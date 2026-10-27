import { useMemo, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Cena } from '@/types'

interface Props {
  id?: string
  value: string
  onChange: (cenaId: string) => void
  /** Pode vir com cenas inativas (só pra admin) — elas ficam escondidas até marcar a opção. */
  cenas: Cena[]
  /** Texto da opção vazia (ex.: "Nenhuma — vale pra peça toda"). */
  vazio: string
  /** Cena atual que não está em `cenas` (ex.: sem permissão de ver) — continua escolhível. */
  foraDaLista?: { value: string; label: string }
}

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const porNome = (a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true })

/**
 * Seletor de cena dos cadastros de músicas/figurinos/referências/links: lista de A a Z, com busca
 * (quando ela é grande), por cima da tela — no lugar do `<select>` nativo. Cenas inativas só
 * aparecem se pedir.
 */
export function CenaSelect({ id, value, onChange, cenas, vazio, foraDaLista }: Props) {
  const ativas = useMemo(() => cenas.filter(c => c.ativo).sort(porNome), [cenas])
  const inativas = useMemo(() => cenas.filter(c => !c.ativo).sort(porNome), [cenas])
  const [mostrarInativas, setMostrarInativas] = useState(() => inativas.some(c => c.id === value))
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  // A escolhida continua na lista mesmo com a opção desmarcada.
  const inativasVisiveis = mostrarInativas ? inativas : inativas.filter(c => c.id === value)

  const filtrar = (lista: Cena[]) => {
    const q = normalizar(busca.trim())
    return q ? lista.filter(c => normalizar(c.nome).includes(q)) : lista
  }
  const ativasFiltradas = filtrar(ativas)
  const inativasFiltradas = filtrar(inativasVisiveis)

  const selecionada = cenas.find(c => c.id === value)
  const rotulo = selecionada ? selecionada.nome : foraDaLista && foraDaLista.value === value ? foraDaLista.label : undefined

  function escolher(v: string) {
    onChange(v)
    setAberto(false)
    setBusca('')
  }

  function opcao(v: string, label: string, inativa?: boolean) {
    return (
      <button
        key={v}
        type="button"
        onClick={() => escolher(v)}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2.5 text-left text-sm hover:bg-muted',
          value === v && 'bg-primary/10',
          inativa ? 'text-muted-foreground' : 'text-gray-900',
        )}
      >
        <span className="min-w-0 truncate">{label}</span>
        {value === v && <Check className="h-4 w-4 shrink-0 text-primary" />}
      </button>
    )
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        id={id}
        onClick={() => setAberto(true)}
        className="relative flex h-11 w-full items-center rounded-md border border-border bg-input px-3 pr-8 text-left text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <span className={cn('truncate', !rotulo && 'text-muted-foreground')}>
          {rotulo ?? vazio}
          {selecionada && !selecionada.ativo && <span className="text-sm text-muted-foreground"> (inativa)</span>}
        </span>
        <ChevronDown className="pointer-events-none absolute right-2 top-3.5 h-4 w-4 text-muted-foreground" />
      </button>
      {inativas.length > 0 && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={mostrarInativas}
            onChange={e => setMostrarInativas(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary"
          />
          Mostrar cenas inativas ({inativas.length})
        </label>
      )}

      <Dialog open={aberto} onClose={() => setAberto(false)} title="Escolher cena">
        <div className="space-y-3">
          {ativas.length + inativasVisiveis.length > 6 && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cena" className="pl-9" />
            </div>
          )}

          <div className="-mx-2 space-y-0.5">
            {!busca && opcao('', vazio)}
            {!busca && foraDaLista && opcao(foraDaLista.value, foraDaLista.label)}
            {ativasFiltradas.map(c => opcao(c.id, c.nome))}
            {inativasFiltradas.length > 0 && (
              <>
                <p className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cenas inativas</p>
                {inativasFiltradas.map(c => opcao(c.id, c.nome, true))}
              </>
            )}
            {busca && !ativasFiltradas.length && !inativasFiltradas.length && (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">Nenhuma cena encontrada.</p>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  )
}
