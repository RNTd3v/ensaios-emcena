import { useMemo, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { AppUser, Inscricao } from '@/types'

export interface PessoaOpcao {
  uid: string
  nome: string
  apelido?: string
  photoURL?: string | null
  /** Linha extra embaixo do nome (ex.: dias disponíveis). */
  detalhe?: string
}

/**
 * Monta a opção de uma pessoa a partir do que a tela tiver: a inscrição (só admin/líder leem) tem
 * prioridade; sem ela, usa a cópia pública de nome/apelido do perfil.
 */
export function pessoaOpcao(
  uid: string,
  user: Pick<AppUser, 'displayName' | 'photoURL' | 'nomeCompleto' | 'apelido'> | undefined,
  inscricao?: Pick<Inscricao, 'nomeCompleto' | 'apelido' | 'fotoUrl'>,
  detalhe?: string,
): PessoaOpcao {
  const nome = inscricao?.nomeCompleto?.trim() || user?.nomeCompleto?.trim() || user?.displayName?.trim() || 'Sem nome'
  const apelido = inscricao?.apelido?.trim() || user?.apelido?.trim()
  return {
    uid,
    nome,
    apelido: apelido && apelido.toLowerCase() !== nome.toLowerCase() ? apelido : undefined,
    photoURL: user?.photoURL ?? inscricao?.fotoUrl ?? null,
    detalhe,
  }
}

/**
 * Quem pode ser escolhido: acesso ativo e inscrição confirmada (cópia do status no perfil).
 * `manter` = quem já está escolhido e deve continuar aparecendo mesmo sem passar no filtro.
 */
export function inscritosConfirmados(users: Record<string, AppUser> | AppUser[], manter: (string | undefined)[] = []): AppUser[] {
  return (Array.isArray(users) ? users : Object.values(users)).filter(
    u => manter.includes(u.uid) || (u.active !== false && u.inscricaoStatus === 'confirmado'),
  )
}

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

interface Props {
  id?: string
  value: string
  onChange: (uid: string) => void
  pessoas: PessoaOpcao[]
  /** Opções fixas no topo da lista, sem foto (ex.: "Sem líder", "Todos"). */
  extras?: { value: string; label: string }[]
  /** Texto do botão quando nada está escolhido (value vazio e fora de `extras`). */
  placeholder?: string
  /** Título da lista. */
  titulo?: string
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

/**
 * Seletor de pessoa com foto, nome e apelido — no lugar do `<select>` nativo, que só mostra texto.
 * Abre uma lista (com busca, quando ela é grande) por cima da tela.
 */
export function PessoaSelect({
  id,
  value,
  onChange,
  pessoas,
  extras = [],
  placeholder = 'Selecione',
  titulo = 'Escolher pessoa',
  disabled,
  className,
  'aria-label': ariaLabel,
}: Props) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')

  const selecionada = pessoas.find(p => p.uid === value)
  const extraSelecionado = !selecionada ? extras.find(e => e.value === value) : undefined

  const filtradas = useMemo(() => {
    const q = normalizar(busca.trim())
    if (!q) return pessoas
    return pessoas.filter(p => normalizar(`${p.nome} ${p.apelido ?? ''}`).includes(q))
  }, [pessoas, busca])

  function escolher(v: string) {
    onChange(v)
    setAberto(false)
    setBusca('')
  }

  return (
    <>
      <button
        type="button"
        id={id}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setAberto(true)}
        className={cn(
          'flex h-11 w-full items-center gap-2.5 rounded-md border border-border bg-input px-3 pr-8 text-left text-base text-foreground relative',
          'focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
      >
        {selecionada ? (
          <>
            <Avatar photoURL={selecionada.photoURL} name={selecionada.nome} className="h-7 w-7 text-xs" />
            <span className="min-w-0 flex-1 truncate">
              {selecionada.nome}
              {selecionada.apelido && <span className="text-sm text-muted-foreground"> · {selecionada.apelido}</span>}
            </span>
          </>
        ) : (
          <span className={cn('truncate', !extraSelecionado && 'text-muted-foreground')}>{extraSelecionado?.label ?? placeholder}</span>
        )}
        <ChevronDown className="pointer-events-none absolute right-2 top-3.5 h-4 w-4 text-muted-foreground" />
      </button>

      <Dialog open={aberto} onClose={() => setAberto(false)} title={titulo}>
        <div className="space-y-3">
          {pessoas.length > 6 && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou apelido" className="pl-9" />
            </div>
          )}

          <div className="-mx-2 space-y-0.5">
            {!busca &&
              extras.map(e => (
                <button
                  key={e.value}
                  type="button"
                  onClick={() => escolher(e.value)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-2.5 text-left text-sm text-gray-700 hover:bg-muted"
                >
                  {e.label}
                  {value === e.value && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}

            {filtradas.map(p => (
              <button
                key={p.uid}
                type="button"
                onClick={() => escolher(p.uid)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted',
                  value === p.uid && 'bg-primary/10',
                )}
              >
                <Avatar photoURL={p.photoURL} name={p.nome} className="h-10 w-10 text-sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-900">{p.nome}</span>
                  {p.apelido && <span className="block truncate text-xs text-muted-foreground">{p.apelido}</span>}
                  {p.detalhe && <span className="block truncate text-[11px] text-muted-foreground">{p.detalhe}</span>}
                </span>
                {value === p.uid && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </button>
            ))}

            {filtradas.length === 0 && (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                {busca ? 'Ninguém encontrado.' : 'Não há ninguém pra escolher.'}
              </p>
            )}
          </div>
        </div>
      </Dialog>
    </>
  )
}
