import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Pencil, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/Spinner'
import { CenaSelect } from '@/components/midia/CenaSelect'
import { subscribeToTodasCenas } from '@/services/firebase/cenas'
import { subscribeToCatalogoPersonagens } from '@/services/firebase/personagens'
import {
  createLinkCompra,
  deleteLinkCompra,
  subscribeToLinksCompraDaCena,
  subscribeToLinksCompraDaEquipe,
  subscribeToLinksCompraDoPersonagem,
  subscribeToLinksCompraPublicos,
  updateLinkCompra,
} from '@/services/firebase/linksCompra'
import { agregarPersonagens } from '@/lib/personagens'
import { LOJAS_SUGERIDAS, lojaDaUrl } from '@/lib/lojas'
import { formatBRL } from '@/lib/formatters'
import {
  CATEGORIAS_COMPRA,
  FAIXAS_COMPRA,
  GENEROS_COMPRA,
  categoriaCompraIcon,
  categoriaCompraLabel,
  type FaixaCompra,
  type GeneroCompra,
} from '@/lib/categoriasCompra'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'
import type { AppUser, Cena, Equipe, LinkCompra, PersonagemCatalogo } from '@/types'

interface PersonagemOpcao {
  key: string
  nome: string
  label: string
}

/** Domínio do link (sem "www."), mostrado quando não tem descrição. */
function dominio(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

type Props =
  | {
      /** Página da equipe: todos os links dela, com cadastro e edição. */
      equipe: Equipe
      users: Record<string, AppUser>
      cenaId?: never
      personagemKey?: never
    }
  | {
      /** Página da cena: só ver os links marcados pra ela (some sem nenhum). */
      cenaId: string
      equipe?: never
      users?: never
      personagemKey?: never
    }
  | {
      /** Página do personagem: só ver os links marcados pra ele (some sem nenhum). */
      personagemKey: string
      equipe?: never
      users?: never
      cenaId?: never
    }
  | {
      /** Página "Sugestões de compra": tudo menos o que é só da equipe. */
      equipe?: never
      users?: never
      cenaId?: never
      personagemKey?: never
    }

const ABERTO_KEY = 'linksCompra.cardAberto'

/** Na equipe, o filtro de categoria só aparece passando disso. */
const LIMITE_FILTRO_EQUIPE = 8
const SEM_CATEGORIA = '__sem'

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

const chip = (ativo: boolean) =>
  cn(
    'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
    ativo ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 bg-white text-gray-600',
  )

/** Ordem dos grupos: só da equipe, para todos, cenas, personagens. */
const ORDEM_GRUPO = { equipe: 0, geral: 1, cena: 2, personagem: 3 } as const

/**
 * Links de sugestão de compra das equipes — de uma cena, de um personagem ou gerais. Na equipe
 * aparecem todos (membros e admin cadastram; líder, assistentes, admin e quem cadastrou editam e
 * excluem); na cena e no personagem, os marcados pra eles; na página de compras, tudo menos o que é
 * só da equipe.
 */
export function LinksCompraCard({ equipe, users, cenaId, personagemKey }: Props) {
  const currentUser = useAuthStore(s => s.user)
  const uid = currentUser?.uid
  const isAdmin = currentUser?.role === 'admin'
  const [links, setLinks] = useState<LinkCompra[] | null>(null)
  const [cenas, setCenas] = useState<Cena[]>([])
  const [catalogo, setCatalogo] = useState<PersonagemCatalogo[]>([])
  const [form, setForm] = useState<LinkCompra | 'novo' | null>(null)
  const [busca, setBusca] = useState('')
  /** '' = todas; SEM_CATEGORIA = só as sem categoria. */
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroCena, setFiltroCena] = useState('')
  const [filtroPersonagem, setFiltroPersonagem] = useState('')
  const [filtroGenero, setFiltroGenero] = useState<GeneroCompra | ''>('')
  const [filtroFaixa, setFiltroFaixa] = useState<FaixaCompra | ''>('')

  const equipeId = equipe?.id
  const pagina = !equipeId && !cenaId && !personagemKey
  useEffect(() => {
    if (equipeId) return subscribeToLinksCompraDaEquipe(equipeId, setLinks)
    if (cenaId) return subscribeToLinksCompraDaCena(cenaId, setLinks)
    if (personagemKey) return subscribeToLinksCompraDoPersonagem(personagemKey, setLinks)
    return subscribeToLinksCompraPublicos(setLinks)
  }, [equipeId, cenaId, personagemKey])

  const podeCadastrar = !!equipe && !!uid && (isAdmin || equipe.membros.includes(uid))
  const gerenciaEquipe = !!equipe && !!uid && (isAdmin || equipe.liderUid === uid || equipe.assistentes.includes(uid))
  function podeEditar(l: LinkCompra) {
    return gerenciaEquipe || (!!equipe && l.criadoPorUid === uid)
  }

  // Cenas e personagens só pra escolher no cadastro.
  const precisaOpcoes = podeCadastrar || gerenciaEquipe
  useEffect(() => {
    if (!precisaOpcoes) return
    return subscribeToTodasCenas(setCenas)
  }, [precisaOpcoes])
  useEffect(() => {
    if (!precisaOpcoes) return
    return subscribeToCatalogoPersonagens(setCatalogo)
  }, [precisaOpcoes])

  /** Admin também escolhe cenas inativas (escondidas até pedir, no CenaSelect). */
  const cenasEscolha = useMemo(() => (isAdmin ? cenas : cenas.filter(c => c.ativo)), [cenas, isAdmin])

  /** Papéis de coro repetem o nome — nesses, a pessoa entra no rótulo. */
  const personagens = useMemo<PersonagemOpcao[]>(() => {
    const lista = agregarPersonagens(cenasEscolha, catalogo)
    const contagem = new Map<string, number>()
    for (const p of lista) contagem.set(p.nome.toLowerCase(), (contagem.get(p.nome.toLowerCase()) ?? 0) + 1)
    return lista.map(p => {
      const repetido = (contagem.get(p.nome.toLowerCase()) ?? 0) > 1
      const pessoa = p.participanteUid ? users?.[p.participanteUid]?.displayName : undefined
      return { key: p.key, nome: p.nome, label: repetido && pessoa ? `${p.nome} (${pessoa})` : p.nome }
    })
  }, [cenasEscolha, catalogo, users])

  /** Na página de compras: filtros por cena, personagem, categoria e busca. Na equipe, só categoria (com muitos links). */
  const comFiltros = pagina
  const comFiltroCategoria = pagina || (!!equipe && (links?.length ?? 0) > LIMITE_FILTRO_EQUIPE)

  const opcoesFiltro = useMemo(() => {
    const cenasM = new Map<string, string>()
    const personagensM = new Map<string, string>()
    for (const l of links ?? []) {
      if (l.alvo === 'cena' && l.cenaId) cenasM.set(l.cenaId, l.cenaNome ?? 'Cena')
      if (l.alvo === 'personagem' && l.personagemKey) personagensM.set(l.personagemKey, l.personagemNome ?? 'Personagem')
    }
    const ordenar = (m: Map<string, string>) =>
      [...m.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR', { numeric: true }))
    return { cenas: ordenar(cenasM), personagens: ordenar(personagensM) }
  }, [links])

  /** Tudo menos a categoria — a contagem de cada categoria sai daqui. */
  const semFiltroCategoria = useMemo(() => {
    const termo = normalizar(busca.trim())
    return (links ?? []).filter(
      l =>
        (!filtroCena || (l.alvo === 'cena' && l.cenaId === filtroCena)) &&
        (!filtroPersonagem || (l.alvo === 'personagem' && l.personagemKey === filtroPersonagem)) &&
        (!filtroGenero || l.genero === filtroGenero) &&
        (!filtroFaixa || l.faixa === filtroFaixa) &&
        (!termo || normalizar([l.produto, l.descricao, l.loja, l.equipeNome, dominio(l.url)].filter(Boolean).join(' ')).includes(termo)),
    )
  }, [links, busca, filtroCena, filtroPersonagem, filtroGenero, filtroFaixa])

  const contagemCategorias = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of semFiltroCategoria) {
      const c = l.categoria || SEM_CATEGORIA
      m.set(c, (m.get(c) ?? 0) + 1)
    }
    return m
  }, [semFiltroCategoria])

  const filtrados = useMemo(
    () => (filtroCategoria ? semFiltroCategoria.filter(l => (l.categoria || SEM_CATEGORIA) === filtroCategoria) : semFiltroCategoria),
    [semFiltroCategoria, filtroCategoria],
  )
  // Na cena o card é recolhível (como as referências); fica salvo no aparelho, começa aberto.
  const recolhivel = !!cenaId
  const [aberto, setAberto] = useState(() => {
    try {
      return localStorage.getItem(ABERTO_KEY) !== 'nao'
    } catch {
      return true
    }
  })
  function alternarAberto() {
    setAberto(v => {
      try {
        localStorage.setItem(ABERTO_KEY, v ? 'nao' : 'sim')
      } catch {
        // storage indisponível — segue só em memória
      }
      return !v
    })
  }
  const fechado = recolhivel && !aberto

  const filtrando = !!(busca.trim() || filtroCategoria || filtroCena || filtroPersonagem || filtroGenero || filtroFaixa)
  function limparFiltros() {
    setBusca('')
    setFiltroCategoria('')
    setFiltroCena('')
    setFiltroPersonagem('')
    setFiltroGenero('')
    setFiltroFaixa('')
  }

  const grupos = useMemo(() => {
    const m = new Map<string, { chave: string; titulo: string; ordem: number; itens: LinkCompra[] }>()
    for (const l of filtrados) {
      const tipo = l.alvo === 'geral' || !l.alvo ? (l.somenteEquipe ? 'equipe' : 'geral') : l.alvo
      const chave = tipo === 'cena' ? `c:${l.cenaId ?? ''}` : tipo === 'personagem' ? `p:${l.personagemKey ?? ''}` : tipo
      const titulo =
        tipo === 'cena'
          ? `Cena · ${l.cenaNome ?? 'Cena'}`
          : tipo === 'personagem'
            ? `Personagem · ${l.personagemNome ?? 'Personagem'}`
            : tipo === 'equipe'
              ? 'Só da equipe'
              : 'Para todos'
      if (!m.has(chave)) m.set(chave, { chave, titulo, ordem: ORDEM_GRUPO[tipo], itens: [] })
      m.get(chave)!.itens.push(l)
    }
    return [...m.values()].sort((a, b) => a.ordem - b.ordem || a.titulo.localeCompare(b.titulo, 'pt-BR', { numeric: true }))
  }, [filtrados])

  // Na cena e no personagem, sem link nenhum não mostra o card.
  if ((cenaId || personagemKey) && !links?.length) return null

  /** Fora da equipe, mostra de qual equipe é o link; na cena/personagem não agrupa. */
  const mostrarEquipe = !equipe
  const agrupar = !!equipe || pagina

  function linha(l: LinkCompra) {
    const titulo = l.produto || l.descricao || dominio(l.url)
    const CategoriaIcon = categoriaCompraIcon(l.categoria)
    const publico = [GENEROS_COMPRA.find(g => g.value === l.genero), FAIXAS_COMPRA.find(f => f.value === l.faixa)].filter(p => !!p)
    const subtitulo = [
      l.loja || dominio(l.url),
      l.preco !== undefined ? formatBRL(l.preco) : undefined,
      mostrarEquipe ? l.equipeNome : undefined,
    ]
      .filter(Boolean)
      .join(' · ')
    return (
      <div key={l.id} className="flex items-center gap-1">
        <a
          href={l.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-gray-50 px-2.5 py-2 text-sm hover:bg-gray-100"
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
            title={categoriaCompraLabel(l.categoria) ?? 'Sem categoria'}
          >
            <CategoriaIcon className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="min-w-0 truncate">{titulo}</span>
              {publico.map(p => (
                <span key={p.value} title={p.label} aria-label={p.label} className="shrink-0 text-muted-foreground">
                  <p.icon className="h-3.5 w-3.5" />
                </span>
              ))}
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">{subtitulo}</span>
            {l.produto && l.descricao && <span className="block truncate text-[11px] text-muted-foreground">{l.descricao}</span>}
          </span>
        </a>
        {podeEditar(l) && (
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setForm(l)} title="Editar link">
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>
    )
  }

  return (
    <>
      <Card>
        <CardContent className="space-y-2.5">
          {!pagina && (
            <div className="flex items-center justify-between gap-2">
              {recolhivel ? (
                <button type="button" onClick={alternarAberto} className="flex min-w-0 flex-1 items-center gap-1.5 text-left" aria-expanded={aberto}>
                  <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', !aberto && '-rotate-90')} />
                  <span className="text-base font-semibold">Sugestões de compra</span>
                  {!!links?.length && (
                    <span className="ml-auto truncate pl-2 text-xs text-muted-foreground">
                      {links.length} {links.length === 1 ? 'link' : 'links'}
                    </span>
                  )}
                </button>
              ) : (
                <p className="flex items-center gap-1.5 text-base font-semibold">
                  <ShoppingCart className="h-4 w-4 text-primary" />
                  Sugestões de compra
                  {!!links?.length && <span className="text-xs font-normal text-muted-foreground">({links.length})</span>}
                </p>
              )}
              {podeCadastrar && (
                <Button variant="ghost" size="icon" onClick={() => setForm('novo')} title="Adicionar link">
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          {!!links?.length && comFiltros && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar produto ou loja" className="pl-9" />
              </div>
              {(opcoesFiltro.cenas.length > 0 || opcoesFiltro.personagens.length > 0) && (
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    aria-label="Filtrar por cena"
                    value={filtroCena}
                    onChange={e => {
                      setFiltroCena(e.target.value)
                      if (e.target.value) setFiltroPersonagem('')
                    }}
                    disabled={!opcoesFiltro.cenas.length}
                  >
                    <option value="">Todas as cenas</option>
                    {opcoesFiltro.cenas.map(c => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                  <Select
                    aria-label="Filtrar por personagem"
                    value={filtroPersonagem}
                    onChange={e => {
                      setFiltroPersonagem(e.target.value)
                      if (e.target.value) setFiltroCena('')
                    }}
                    disabled={!opcoesFiltro.personagens.length}
                  >
                    <option value="">Todos os personagens</option>
                    {opcoesFiltro.personagens.map(p => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
          )}

          {!!links?.length && comFiltros && (
            <div className="flex flex-wrap items-center gap-1.5">
              {GENEROS_COMPRA.map(g => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setFiltroGenero(filtroGenero === g.value ? '' : g.value)}
                  className={chip(filtroGenero === g.value)}
                  aria-pressed={filtroGenero === g.value}
                >
                  <g.icon className="h-3.5 w-3.5" />
                  {g.label}
                </button>
              ))}
              <span className="mx-0.5 h-4 w-px bg-gray-200" />
              {FAIXAS_COMPRA.map(f => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFiltroFaixa(filtroFaixa === f.value ? '' : f.value)}
                  className={chip(filtroFaixa === f.value)}
                  aria-pressed={filtroFaixa === f.value}
                >
                  <f.icon className="h-3.5 w-3.5" />
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {!!links?.length && comFiltroCategoria && (
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setFiltroCategoria('')} className={chip(!filtroCategoria)} aria-pressed={!filtroCategoria}>
                Todas ({semFiltroCategoria.length})
              </button>
              {[...CATEGORIAS_COMPRA, { value: SEM_CATEGORIA, label: 'Sem categoria', icon: categoriaCompraIcon(undefined) }]
                .filter(c => contagemCategorias.get(c.value) || filtroCategoria === c.value)
                .map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setFiltroCategoria(filtroCategoria === c.value ? '' : c.value)}
                    className={chip(filtroCategoria === c.value)}
                    aria-pressed={filtroCategoria === c.value}
                  >
                    <c.icon className="h-3.5 w-3.5" />
                    {c.label} ({contagemCategorias.get(c.value) ?? 0})
                  </button>
                ))}
            </div>
          )}

          {fechado ? null : !links ? (
            <Spinner size="sm" />
          ) : !links.length ? (
            <p className="py-1 text-xs text-muted-foreground">Sem links ainda.</p>
          ) : !filtrados.length ? (
            <div className="flex items-center justify-between gap-2 py-1">
              <p className="text-xs text-muted-foreground">Nenhum link com esses filtros.</p>
              {filtrando && (
                <Button variant="ghost" size="sm" onClick={limparFiltros}>
                  Limpar filtros
                </Button>
              )}
            </div>
          ) : agrupar ? (
            <div className="space-y-3">
              {grupos.map(g => (
                <div key={g.chave} className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.titulo}</p>
                  {g.itens.map(linha)}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1">{filtrados.map(linha)}</div>
          )}
        </CardContent>
      </Card>

      {form && equipe && uid && (
        <LinkFormDialog
          equipe={equipe}
          cenas={cenasEscolha}
          personagens={personagens}
          link={form === 'novo' ? undefined : form}
          byUid={uid}
          onClose={() => setForm(null)}
        />
      )}
    </>
  )
}

interface FormProps {
  equipe: Equipe
  cenas: Cena[]
  personagens: PersonagemOpcao[]
  /** Editando um link já existente. */
  link?: LinkCompra
  byUid: string
  onClose: () => void
}

function LinkFormDialog({ equipe, cenas, personagens, link, byUid, onClose }: FormProps) {
  const [alvo, setAlvo] = useState<LinkCompra['alvo']>(link?.alvo ?? 'geral')
  const [somenteEquipe, setSomenteEquipe] = useState(!!link?.somenteEquipe)
  const [cenaId, setCenaId] = useState(link?.cenaId ?? '')
  const [personagemKey, setPersonagemKey] = useState(link?.personagemKey ?? '')
  const [url, setUrl] = useState(link?.url ?? '')
  const [produto, setProduto] = useState(link?.produto ?? '')
  const [categoria, setCategoria] = useState(link?.categoria ?? '')
  const [genero, setGenero] = useState<GeneroCompra | ''>(link?.genero ?? '')
  const [faixa, setFaixa] = useState<FaixaCompra | ''>(link?.faixa ?? '')
  const [loja, setLoja] = useState(link?.loja ?? '')
  /** Loja preenchida pelo link — continua acompanhando o link até a pessoa mexer nela. */
  const [lojaAuto, setLojaAuto] = useState(!link?.loja)
  const [preco, setPreco] = useState(link?.preco !== undefined ? String(link.preco) : '')
  const [descricao, setDescricao] = useState(link?.descricao ?? '')

  function handleUrl(v: string) {
    setUrl(v)
    if (lojaAuto) setLoja(lojaDaUrl(v) ?? '')
  }
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')

  const cenaForaDaLista = !!link?.cenaId && !cenas.some(c => c.id === link.cenaId)
  const personagemForaDaLista = !!link?.personagemKey && !personagens.some(p => p.key === link.personagemKey)
  const faltaAlvo = alvo === 'cena' ? !cenaId : alvo === 'personagem' ? !personagemKey : false
  const podeSalvar = !faltaAlvo && !!url.trim() && !saving

  async function handleSalvar() {
    const precoNum = preco.trim() ? Number(preco.replace(',', '.')) : undefined
    if (precoNum !== undefined && (!Number.isFinite(precoNum) || precoNum < 0)) {
      setError('Preço inválido.')
      return
    }
    setSaving(true)
    setError('')
    const comuns = { url, produto, categoria, genero: genero || undefined, faixa: faixa || undefined, loja, preco: precoNum, descricao }
    const dados =
      alvo === 'geral'
        ? { ...comuns, alvo, somenteEquipe }
        : alvo === 'cena'
        ? {
            ...comuns,
            alvo,
            cenaId,
            cenaNome: cenas.find(c => c.id === cenaId)?.nome ?? (cenaId === link?.cenaId ? link?.cenaNome : undefined),
          }
        : {
            ...comuns,
            alvo,
            personagemKey,
            personagemNome:
              personagens.find(p => p.key === personagemKey)?.nome ?? (personagemKey === link?.personagemKey ? link?.personagemNome : undefined),
          }
    try {
      if (link) await updateLinkCompra(link.id, dados)
      else await createLinkCompra(equipe, dados, byUid)
      onClose()
    } catch {
      setError('Não foi possível salvar. Tente de novo.')
      setSaving(false)
    }
  }

  async function handleExcluir() {
    if (!link) return
    setSaving(true)
    try {
      await deleteLinkCompra(link.id)
      onClose()
    } catch {
      setError('Não foi possível excluir. Tente de novo.')
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={onClose} title={link ? 'Editar link' : 'Sugestão de compra'}>
      <div className="space-y-4">
        <div>
          <Label>É de</Label>
          <div className="mt-1 grid grid-cols-3 gap-1 rounded-lg bg-gray-100 p-1">
            {(['cena', 'personagem', 'geral'] as const).map(a => (
              <button
                key={a}
                type="button"
                onClick={() => setAlvo(a)}
                className={cn('rounded-md py-1.5 text-sm', alvo === a ? 'bg-white font-semibold shadow-sm' : 'text-muted-foreground')}
                aria-pressed={alvo === a}
              >
                {a === 'cena' ? 'Cena' : a === 'personagem' ? 'Personagem' : 'Nenhum'}
              </button>
            ))}
          </div>
        </div>

        {alvo === 'geral' ? (
          <div className="space-y-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={somenteEquipe}
                onChange={e => setSomenteEquipe(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              Só da equipe
            </label>
            <p className="text-xs text-muted-foreground">
              {somenteEquipe ? 'Aparece só na página da equipe.' : 'Aparece pra todos, na página Sugestões de compra.'}
            </p>
          </div>
        ) : alvo === 'cena' ? (
          <div>
            <Label htmlFor="link-compra-cena">Cena</Label>
            <CenaSelect
              id="link-compra-cena"
              value={cenaId}
              onChange={setCenaId}
              cenas={cenas}
              vazio="Escolha a cena"
              foraDaLista={cenaForaDaLista ? { value: link!.cenaId!, label: link!.cenaNome ?? 'Cena' } : undefined}
            />
            <p className="mt-1 text-xs text-muted-foreground">Aparece também na página da cena e em Sugestões de compra.</p>
          </div>
        ) : (
          <div>
            <Label htmlFor="link-compra-personagem">Personagem</Label>
            <Select id="link-compra-personagem" value={personagemKey} onChange={e => setPersonagemKey(e.target.value)}>
              <option value="">Escolha o personagem</option>
              {personagemForaDaLista && <option value={link!.personagemKey}>{link!.personagemNome ?? 'Personagem'}</option>}
              {personagens.map(p => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">Aparece também na página do personagem e em Sugestões de compra.</p>
          </div>
        )}

        <div>
          <Label htmlFor="link-compra-url">Link</Label>
          <Input
            id="link-compra-url"
            type="url"
            inputMode="url"
            autoCapitalize="none"
            value={url}
            onChange={e => handleUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>

        <div>
          <Label htmlFor="link-compra-produto">Produto</Label>
          <Input id="link-compra-produto" value={produto} onChange={e => setProduto(e.target.value)} placeholder="Ex.: tecido de linho cru" />
        </div>

        <div className="space-y-1.5">
          <Label>Categoria (opcional)</Label>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIAS_COMPRA.map(c => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategoria(categoria === c.value ? '' : c.value)}
                className={chip(categoria === c.value)}
                aria-pressed={categoria === c.value}
              >
                <c.icon className="h-3.5 w-3.5" />
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Pra quem (opcional)</Label>
          <div className="flex flex-wrap items-center gap-1.5">
            {GENEROS_COMPRA.map(g => (
              <button
                key={g.value}
                type="button"
                onClick={() => setGenero(genero === g.value ? '' : g.value)}
                className={chip(genero === g.value)}
                aria-pressed={genero === g.value}
              >
                <g.icon className="h-3.5 w-3.5" />
                {g.label}
              </button>
            ))}
            <span className="mx-0.5 h-4 w-px bg-gray-200" />
            {FAIXAS_COMPRA.map(f => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFaixa(faixa === f.value ? '' : f.value)}
                className={chip(faixa === f.value)}
                aria-pressed={faixa === f.value}
              >
                <f.icon className="h-3.5 w-3.5" />
                {f.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Sem marcar, serve pra qualquer um.</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="link-compra-loja">Loja</Label>
            <Input
              id="link-compra-loja"
              list="link-compra-lojas"
              value={loja}
              onChange={e => {
                setLoja(e.target.value)
                setLojaAuto(!e.target.value)
              }}
              placeholder="Escolha ou digite"
            />
            <datalist id="link-compra-lojas">
              {LOJAS_SUGERIDAS.map(l => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </div>
          <div>
            <Label htmlFor="link-compra-preco">Preço (R$)</Label>
            <Input
              id="link-compra-preco"
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              value={preco}
              onChange={e => setPreco(e.target.value)}
              placeholder="0,00"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="link-compra-descricao">Observação (opcional)</Label>
          <Input
            id="link-compra-descricao"
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            placeholder="Ex.: tamanho M, 3 metros"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button className="w-full" onClick={handleSalvar} disabled={!podeSalvar}>
          {saving && <Spinner size="sm" className="border-white/40 border-t-white" />}
          Salvar
        </Button>

        {link &&
          (confirmDelete ? (
            <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs text-red-700">Excluir esse link?</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)} disabled={saving}>
                  Cancelar
                </Button>
                <Button variant="destructive" className="flex-1" onClick={handleExcluir} disabled={saving}>
                  Excluir
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="w-full gap-1.5 text-red-600" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" />
              Excluir
            </Button>
          ))}
      </div>
    </Dialog>
  )
}
