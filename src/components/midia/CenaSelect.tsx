import { useState } from 'react'
import { Select } from '@/components/ui/select'
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

/** Seletor de cena dos cadastros de músicas/figurinos; cenas inativas só aparecem se pedir. */
export function CenaSelect({ id, value, onChange, cenas, vazio, foraDaLista }: Props) {
  const ativas = cenas.filter(c => c.ativo)
  const inativas = cenas.filter(c => !c.ativo)
  const [mostrarInativas, setMostrarInativas] = useState(() => inativas.some(c => c.id === value))
  // A escolhida continua na lista mesmo com a opção desmarcada.
  const inativasVisiveis = mostrarInativas ? inativas : inativas.filter(c => c.id === value)

  return (
    <div className="space-y-1.5">
      <Select id={id} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">{vazio}</option>
        {foraDaLista && <option value={foraDaLista.value}>{foraDaLista.label}</option>}
        {ativas.map(c => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
        {inativasVisiveis.length > 0 && (
          <optgroup label="Cenas inativas">
            {inativasVisiveis.map(c => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </optgroup>
        )}
      </Select>
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
    </div>
  )
}
