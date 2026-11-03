import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronDown, ChevronRight, ExternalLink, Info, Search, Star } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'
import { EnsaioStatusChip } from '@/components/ensaio/EnsaioStatusChip'
import { nomeComApelido, pessoaOpcao } from '@/components/ui/PessoaSelect'
import { getUsers } from '@/services/firebase/auth'
import { subscribeToTodasCenas } from '@/services/firebase/cenas'
import { getAusencia, subscribeToAllEnsaios } from '@/services/firebase/ensaios'
import { subscribeToAllInscricoes } from '@/services/firebase/inscricoes'
import { toDateKey } from '@/lib/agenda'
import { ensaioStatus } from '@/lib/ensaioStatus'
import {
  SITUACAO_LABELS,
  ensaiosQueContam,
  formatTaxa,
  registrosDoPersonagem,
  resumir,
  type RegistroFrequencia,
  type ResumoFrequencia,
  type SituacaoFrequencia,
} from '@/lib/frequencia'
import { agregarPersonagens } from '@/lib/personagens'
import { cn } from '@/lib/utils'
import type { AppUser, Cena, Ensaio, Inscricao } from '@/types'

type Aba = 'cenas' | 'personagens'
type Ordem = 'nome' | 'frequencia'

const SITUACOES: SituacaoFrequencia[] = ['presente', 'avisouFalta', 'semResposta', 'dispensado', 'extra']

const COR_SITUACAO: Record<SituacaoFrequencia, { ponto: string; texto: string; fundo: string }> = {
  presente: { ponto: 'bg-emerald-500', texto: 'text-emerald-700', fundo: 'bg-emerald-50 border-emerald-200' },
  avisouFalta: { ponto: 'bg-amber-400', texto: 'text-amber-700', fundo: 'bg-amber-50 border-amber-200' },
  semResposta: { ponto: 'bg-red-500', texto: 'text-red-700', fundo: 'bg-red-50 border-red-200' },
  dispensado: { ponto: 'bg-gray-300', texto: 'text-gray-600', fundo: 'bg-gray-50 border-gray-200' },
  extra: { ponto: 'bg-sky-500', texto: 'text-sky-700', fundo: 'bg-sky-50 border-sky-200' },
}

/** Quantos ensaios aparecem como bolinhas na linha de cada personagem (os mais recentes). */
const PONTOS_NA_LINHA = 12

function dataCurta(data: string) {
  return new Date(`${data}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' })
}

function ordenarPorFrequencia<T>(itens: T[], resumo: (i: T) => ResumoFrequencia, nome: (i: T) => string, ordem: Ordem): T[] {
  return [...itens].sort((a, b) => {
    if (ordem === 'frequencia') {
      // Sem ensaio chamado vai pro fim; empate: mais "sem satisfação" primeiro.
      const ta = resumo(a).taxa ?? 2
      const tb = resumo(b).taxa ?? 2
      if (ta !== tb) return ta - tb
      if (resumo(a).semResposta !== resumo(b).semResposta) return resumo(b).semResposta - resumo(a).semResposta
    }
    return nome(a).localeCompare(nome(b), 'pt-BR', { numeric: true })
  })
}

/**
 * Frequência nos ensaios (só admin): por cena (cena → personagens) ou por personagem (juntando
 * todas as cenas dele). Contam os ensaios já passados e não cancelados; quem não era obrigatório
 * num ensaio com obrigatórios aparece como "não precisava ir" e não entra na porcentagem.
 */
export function AdminFrequencia() {
  const [aba, setAba] = useState<Aba>('cenas')
  const [ordem, setOrdem] = useState<Ordem>('nome')
  const [cenas, setCenas] = useState<Cena[] | null>(null)
  const [ensaios, setEnsaios] = useState<Ensaio[] | null>(null)
  const [users, setUsers] = useState<Record<string, AppUser>>({})
  const [inscricoes, setInscricoes] = useState<Inscricao[]>([])
  const [detalhe, setDetalhe] = useState<{ titulo: string; uid?: string; registros: RegistroFrequencia[]; mostrarCena: boolean } | null>(null)
  const [legendaAberta, setLegendaAberta] = useState(false)

  useEffect(() => subscribeToTodasCenas(setCenas), [])
  useEffect(() => subscribeToAllEnsaios(setEnsaios), [])
  useEffect(() => subscribeToAllInscricoes(setInscricoes), [])
  useEffect(() => {
    getUsers().then(list => setUsers(Object.fromEntries(list.map(u => [u.uid, u]))))
  }, [])

  const inscricoesByUid = useMemo(() => Object.fromEntries(inscricoes.map(i => [i.uid, i])), [inscricoes])
  const atorDe = (uid: string) => nomeComApelido(pessoaOpcao(uid, users[uid], inscricoesByUid[uid]))

  const todayKey = toDateKey(new Date())
  const cenasAtivas = useMemo(
    () => (cenas ?? []).filter(c => c.ativo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true })),
    [cenas],
  )
  const contam = useMemo(() => ensaiosQueContam(ensaios ?? [], todayKey), [ensaios, todayKey])

  const carregando = !cenas || !ensaios

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/admin">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="flex-1 text-xl font-semibold text-white">Frequência nos ensaios</h1>
        <Button
          variant="ghost"
          size="icon"
          title="Como é calculado"
          onClick={() => setLegendaAberta(true)}
          className="text-white hover:bg-white/10"
        >
          <Info className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/10 p-1">
        {(['cenas', 'personagens'] as Aba[]).map(a => (
          <button
            key={a}
            type="button"
            onClick={() => setAba(a)}
            className={cn('rounded-lg py-2 text-sm font-medium', aba === a ? 'bg-white text-gray-900' : 'text-white/80')}
          >
            {a === 'cenas' ? 'Por cena' : 'Por personagem'}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Legenda />
        <div className="flex gap-1 rounded-lg bg-white/10 p-0.5 text-xs">
          {(['nome', 'frequencia'] as Ordem[]).map(o => (
            <button
              key={o}
              type="button"
              onClick={() => setOrdem(o)}
              className={cn('rounded-md px-2 py-1 font-medium', ordem === o ? 'bg-white text-gray-900' : 'text-white/80')}
            >
              {o === 'nome' ? 'A–Z' : 'Menor frequência'}
            </button>
          ))}
        </div>
      </div>

      {carregando ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : aba === 'cenas' ? (
        <AbaCenas
          cenas={cenasAtivas}
          ensaios={contam}
          ordem={ordem}
          atorDe={atorDe}
          users={users}
          onAbrir={(titulo, uid, registros) => setDetalhe({ titulo, uid, registros, mostrarCena: false })}
        />
      ) : (
        <AbaPersonagens
          cenas={cenasAtivas}
          ensaios={contam}
          ordem={ordem}
          atorDe={atorDe}
          users={users}
          onAbrir={(titulo, uid, registros) => setDetalhe({ titulo, uid, registros, mostrarCena: true })}
        />
      )}

      <DetalheDialog
        detalhe={detalhe}
        onClose={() => setDetalhe(null)}
        atorDe={atorDe}
        users={users}
        todayKey={todayKey}
      />

      <Dialog open={legendaAberta} onClose={() => setLegendaAberta(false)} title="Como é calculado">
        <div className="space-y-3 text-sm text-gray-700">
          <p>
            Contam os ensaios que já passaram e não foram cancelados — os finalizados pela tela do ensaio e os que ficaram
            <span className="font-medium"> sem registro</span> (nesses, a presença é a confirmação que a pessoa deu).
          </p>
          <ul className="space-y-2">
            <li className="flex gap-2">
              <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', COR_SITUACAO.presente.ponto)} />
              <span><b>Presente</b>: estava chamada e foi marcada presente.</span>
            </li>
            <li className="flex gap-2">
              <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', COR_SITUACAO.avisouFalta.ponto)} />
              <span><b>Avisou que não ia</b>: respondeu "não vou" (o motivo aparece no detalhe).</span>
            </li>
            <li className="flex gap-2">
              <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', COR_SITUACAO.semResposta.ponto)} />
              <span><b>Não deu satisfação</b>: estava chamada, não foi e nem avisou.</span>
            </li>
            <li className="flex gap-2">
              <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', COR_SITUACAO.dispensado.ponto)} />
              <span><b>Não precisava ir</b>: o ensaio tinha personagens obrigatórios e o dela não estava entre eles.</span>
            </li>
            <li className="flex gap-2">
              <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', COR_SITUACAO.extra.ponto)} />
              <span><b>Foi sem ser chamado</b>: não era obrigatório, mas apareceu.</span>
            </li>
          </ul>
          <p>
            <b>Frequência</b> = presenças ÷ ensaios em que a pessoa era chamada. "Não precisava ir" e "foi sem ser chamado"
            não entram na conta.
          </p>
          <p className="text-xs text-muted-foreground">
            O cálculo usa quem faz o personagem hoje — se o personagem trocou de pessoa, os ensaios antigos contam pra pessoa atual.
          </p>
        </div>
      </Dialog>
    </div>
  )
}

function Legenda() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/80">
      {SITUACOES.map(s => (
        <span key={s} className="flex items-center gap-1">
          <span className={cn('h-2 w-2 rounded-full', COR_SITUACAO[s].ponto)} />
          {SITUACAO_LABELS[s]}
        </span>
      ))}
    </div>
  )
}

/** Barra empilhada dos ensaios em que a pessoa era chamada: presente / avisou / sem satisfação. */
function BarraFrequencia({ resumo, className }: { resumo: ResumoFrequencia; className?: string }) {
  const total = resumo.chamados || 1
  return (
    <div className={cn('flex h-1.5 w-full overflow-hidden rounded-full bg-gray-100', className)}>
      {(['presente', 'avisouFalta', 'semResposta'] as const).map(s =>
        resumo[s] ? <div key={s} className={COR_SITUACAO[s].ponto} style={{ width: `${(resumo[s] / total) * 100}%` }} /> : null,
      )}
    </div>
  )
}

function corTaxa(taxa: number | null) {
  if (taxa === null) return 'text-gray-400'
  if (taxa >= 0.8) return 'text-emerald-600'
  if (taxa >= 0.5) return 'text-amber-600'
  return 'text-red-600'
}

function ContagensCurtas({ resumo }: { resumo: ResumoFrequencia }) {
  return (
    <p className="flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
      <span>
        {resumo.presente}/{resumo.chamados} presenças
      </span>
      {resumo.avisouFalta > 0 && <span className={COR_SITUACAO.avisouFalta.texto}>{resumo.avisouFalta} avisou</span>}
      {resumo.semResposta > 0 && <span className={cn('font-medium', COR_SITUACAO.semResposta.texto)}>{resumo.semResposta} sem satisfação</span>}
      {resumo.dispensado > 0 && <span>{resumo.dispensado} dispensado</span>}
      {resumo.extra > 0 && <span className={COR_SITUACAO.extra.texto}>+{resumo.extra} extra</span>}
    </p>
  )
}

/** Bolinhas dos ensaios mais recentes (da esquerda = mais antigo pra direita = mais recente). */
function PontosRecentes({ registros }: { registros: RegistroFrequencia[] }) {
  const recentes = registros.slice(0, PONTOS_NA_LINHA).reverse()
  if (!recentes.length) return null
  return (
    <div className="flex gap-0.5">
      {recentes.map(r => (
        <span
          key={r.ensaio.id}
          title={`${dataCurta(r.ensaio.data)} — ${SITUACAO_LABELS[r.situacao]}`}
          className={cn('h-2 w-2 rounded-full', COR_SITUACAO[r.situacao].ponto)}
        />
      ))}
    </div>
  )
}

interface LinhaPessoaProps {
  titulo: string
  subtitulo: string
  detalhe?: string
  uid?: string
  users: Record<string, AppUser>
  registros: RegistroFrequencia[]
  onClick?: () => void
}

function LinhaPessoa({ titulo, subtitulo, detalhe, uid, users, registros, onClick }: LinhaPessoaProps) {
  const resumo = resumir(registros)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-gray-50 disabled:cursor-default disabled:hover:bg-transparent"
    >
      <Avatar photoURL={uid ? users[uid]?.photoURL : null} name={subtitulo} className="h-9 w-9 shrink-0 text-xs" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-semibold text-gray-900">{titulo}</p>
          <span className={cn('shrink-0 text-sm font-bold tabular-nums', corTaxa(resumo.taxa))}>{formatTaxa(resumo.taxa)}</span>
        </div>
        <p className="truncate text-xs text-muted-foreground">{subtitulo}</p>
        {detalhe && <p className="truncate text-[11px] text-muted-foreground">{detalhe}</p>}
        {uid && (
          <>
            <BarraFrequencia resumo={resumo} />
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
              <ContagensCurtas resumo={resumo} />
              <PontosRecentes registros={registros} />
            </div>
          </>
        )}
      </div>
      {onClick && <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />}
    </button>
  )
}

interface AbaProps {
  cenas: Cena[]
  ensaios: Ensaio[]
  ordem: Ordem
  atorDe: (uid: string) => string
  users: Record<string, AppUser>
  onAbrir: (titulo: string, uid: string, registros: RegistroFrequencia[]) => void
}

function AbaCenas({ cenas, ensaios, ordem, atorDe, users, onAbrir }: AbaProps) {
  const [abertas, setAbertas] = useState<Set<string>>(new Set())

  const porCena = useMemo(
    () =>
      cenas.map(cena => {
        const linhas = cena.personagens
          .filter(p => p.nome.trim())
          .map(p => ({ personagem: p, registros: registrosDoPersonagem(cena, p, ensaios) }))
        return {
          cena,
          linhas,
          qtdEnsaios: ensaios.filter(e => e.cenaId === cena.id).length,
          resumo: resumir(linhas.flatMap(l => l.registros)),
        }
      }),
    [cenas, ensaios],
  )

  const lista = ordenarPorFrequencia(porCena, c => c.resumo, c => c.cena.nome, ordem)

  function alternar(id: string) {
    setAbertas(prev => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  if (!lista.length) return <p className="py-6 text-center text-sm text-white/80">Nenhuma cena ativa.</p>

  return (
    <div className="space-y-2">
      {lista.map(({ cena, linhas, qtdEnsaios, resumo }) => {
        const aberta = abertas.has(cena.id)
        const comPessoa = linhas.filter(l => l.personagem.participanteUid)
        const semPessoa = linhas.filter(l => !l.personagem.participanteUid)
        return (
          <Card key={cena.id} className="p-0">
            <button type="button" onClick={() => alternar(cena.id)} className="flex w-full items-center gap-3 p-4 text-left" aria-expanded={aberta}>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-gray-900">{cena.nome}</p>
                  <span className={cn('shrink-0 text-base font-bold tabular-nums', corTaxa(resumo.taxa))}>{formatTaxa(resumo.taxa)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {qtdEnsaios} ensaio{qtdEnsaios === 1 ? '' : 's'} · {comPessoa.length} personage{comPessoa.length === 1 ? 'm' : 'ns'} com pessoa
                  {resumo.semResposta > 0 && (
                    <span className={cn('font-medium', COR_SITUACAO.semResposta.texto)}> · {resumo.semResposta} sem satisfação</span>
                  )}
                </p>
                <BarraFrequencia resumo={resumo} />
              </div>
              <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', aberta && 'rotate-180')} />
            </button>

            {aberta && (
              <div className="space-y-0.5 border-t border-gray-100 px-2 pb-3 pt-2">
                {qtdEnsaios === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">Nenhum ensaio dessa cena aconteceu ainda.</p>}
                {ordenarPorFrequencia(comPessoa, l => resumir(l.registros), l => l.personagem.nome, ordem).map(({ personagem, registros }) => {
                  const uid = personagem.participanteUid as string
                  return (
                    <LinhaPessoa
                      key={personagem.id}
                      titulo={personagem.nome}
                      subtitulo={atorDe(uid)}
                      uid={uid}
                      users={users}
                      registros={registros}
                      onClick={() => onAbrir(personagem.nome, uid, registros)}
                    />
                  )
                })}
                {semPessoa.length > 0 && (
                  <p className="px-2 pt-2 text-[11px] text-muted-foreground">
                    Sem pessoa vinculada: {semPessoa.map(l => l.personagem.nome).join(', ')}
                  </p>
                )}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

function AbaPersonagens({ cenas, ensaios, ordem, atorDe, users, onAbrir }: AbaProps) {
  const [busca, setBusca] = useState('')

  const itens = useMemo(
    () =>
      agregarPersonagens(cenas, [])
        .filter(a => a.participanteUid)
        .map(a => {
          const registros = a.ocorrencias
            .flatMap(o => registrosDoPersonagem(o.cena, o.personagem, ensaios))
            .sort((x, y) => y.ensaio.data.localeCompare(x.ensaio.data) || y.ensaio.horario.localeCompare(x.ensaio.horario))
          return { agregado: a, registros, resumo: resumir(registros) }
        }),
    [cenas, ensaios],
  )

  const termo = busca.trim().toLowerCase()
  const filtrados = termo
    ? itens.filter(i => i.agregado.nome.toLowerCase().includes(termo) || atorDe(i.agregado.participanteUid as string).toLowerCase().includes(termo))
    : itens
  const lista = ordenarPorFrequencia(filtrados, i => i.resumo, i => i.agregado.nome, ordem)

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input placeholder="Buscar personagem ou pessoa" value={busca} onChange={e => setBusca(e.target.value)} className="pl-9" />
      </div>
      {lista.length === 0 ? (
        <p className="py-6 text-center text-sm text-white/80">Nenhum personagem encontrado.</p>
      ) : (
        <Card className="space-y-0.5 p-2">
          {lista.map(({ agregado, registros }) => {
            const uid = agregado.participanteUid as string
            return (
              <LinhaPessoa
                key={agregado.key}
                titulo={agregado.nome}
                subtitulo={atorDe(uid)}
                detalhe={agregado.ocorrencias.map(o => o.cena.nome).join(' · ')}
                uid={uid}
                users={users}
                registros={registros}
                onClick={() => onAbrir(agregado.nome, uid, registros)}
              />
            )
          })}
        </Card>
      )}
    </div>
  )
}

interface DetalheDialogProps {
  detalhe: { titulo: string; uid?: string; registros: RegistroFrequencia[]; mostrarCena: boolean } | null
  onClose: () => void
  atorDe: (uid: string) => string
  users: Record<string, AppUser>
  todayKey: string
}

function DetalheDialog({ detalhe, onClose, ...props }: DetalheDialogProps) {
  return (
    <Dialog open={!!detalhe} onClose={onClose} title={detalhe?.titulo}>
      {/* `key`: filtro e motivos recomeçam a cada personagem aberto. */}
      {detalhe && <DetalheConteudo key={`${detalhe.titulo}:${detalhe.uid}`} detalhe={detalhe} {...props} />}
    </Dialog>
  )
}

function DetalheConteudo({ detalhe, atorDe, users, todayKey }: Omit<DetalheDialogProps, 'onClose' | 'detalhe'> & { detalhe: NonNullable<DetalheDialogProps['detalhe']> }) {
  const [filtro, setFiltro] = useState<SituacaoFrequencia | null>(null)
  const [motivosLidos, setMotivosLidos] = useState<Record<string, string>>({})

  const registros = detalhe.registros
  const resumo = resumir(registros)

  // Motivo de quem avisou que não ia: na subcoleção privada (com fallback pro legado no ensaio).
  useEffect(() => {
    let ativo = true
    for (const r of detalhe.registros) {
      if (r.situacao !== 'avisouFalta' || r.ensaio.ausencias?.[r.uid]) continue
      getAusencia(r.ensaio.id, r.uid)
        .then(a => {
          if (ativo && a?.motivo) setMotivosLidos(m => ({ ...m, [r.ensaio.id]: a.motivo }))
        })
        .catch(() => {})
    }
    return () => {
      ativo = false
    }
  }, [detalhe])
  const motivoDe = (r: RegistroFrequencia) => r.ensaio.ausencias?.[r.uid]?.motivo ?? motivosLidos[r.ensaio.id]

  // Por personagem com mais de uma cena: resumo de cada uma.
  const porCena = useMemo(() => {
    if (!detalhe.mostrarCena) return []
    const mapa = new Map<string, { cena: Cena; registros: RegistroFrequencia[] }>()
    for (const r of detalhe.registros) {
      const atual = mapa.get(r.cena.id) ?? { cena: r.cena, registros: [] }
      atual.registros.push(r)
      mapa.set(r.cena.id, atual)
    }
    return [...mapa.values()].sort((a, b) => a.cena.nome.localeCompare(b.cena.nome, 'pt-BR', { numeric: true }))
  }, [detalhe])

  const visiveis = filtro ? registros.filter(r => r.situacao === filtro) : registros

  return (
    <div className="space-y-4">
      {detalhe.uid && (
        <div className="flex items-center gap-2.5">
          <Avatar photoURL={users[detalhe.uid]?.photoURL} name={atorDe(detalhe.uid)} className="h-10 w-10 text-sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{atorDe(detalhe.uid)}</p>
            <p className="text-xs text-muted-foreground">
              {registros.length} ensaio{registros.length === 1 ? '' : 's'} da{porCena.length > 1 ? 's' : ''} cena{porCena.length > 1 ? 's' : ''}
            </p>
          </div>
          <div className="text-right">
            <p className={cn('text-2xl font-bold leading-none tabular-nums', corTaxa(resumo.taxa))}>{formatTaxa(resumo.taxa)}</p>
            <p className="text-[11px] text-muted-foreground">frequência</p>
          </div>
        </div>
      )}

      <BarraFrequencia resumo={resumo} className="h-2" />

      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
        {SITUACOES.map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setFiltro(f => (f === s ? null : s))}
            className={cn(
              'rounded-xl border px-2 py-1.5 text-left transition',
              COR_SITUACAO[s].fundo,
              filtro && filtro !== s && 'opacity-40',
              filtro === s && 'ring-2 ring-primary/50',
            )}
          >
            <p className={cn('text-lg font-bold leading-tight tabular-nums', COR_SITUACAO[s].texto)}>{resumo[s]}</p>
            <p className="text-[10px] leading-tight text-gray-600">{SITUACAO_LABELS[s]}</p>
          </button>
        ))}
      </div>

      {porCena.length > 1 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Por cena</p>
          {porCena.map(({ cena, registros: rs }) => {
            const r = resumir(rs)
            return (
              <div key={cena.id} className="space-y-1 rounded-lg bg-gray-50 px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-medium">{cena.nome}</p>
                  <span className={cn('text-sm font-bold tabular-nums', corTaxa(r.taxa))}>{formatTaxa(r.taxa)}</span>
                </div>
                <BarraFrequencia resumo={r} />
                <ContagensCurtas resumo={r} />
              </div>
            )
          })}
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">
          Ensaios {filtro ? `— ${SITUACAO_LABELS[filtro].toLowerCase()}` : ''} ({visiveis.length})
        </p>
        {visiveis.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted-foreground">Nenhum ensaio.</p>
        ) : (
          visiveis.map(r => {
            const obrigatorioMarcado = !!r.ensaio.obrigatorios?.length && r.ensaio.obrigatorios.includes(r.personagem.id)
            return (
              <Link
                key={r.ensaio.id}
                to={`/cenas/${r.cena.id}/ensaios/${r.ensaio.id}`}
                className={cn('flex items-start gap-2.5 rounded-xl border px-3 py-2 hover:brightness-95', COR_SITUACAO[r.situacao].fundo)}
              >
                <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', COR_SITUACAO[r.situacao].ponto)} />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <p className="text-sm font-medium capitalize text-gray-900">
                      {dataCurta(r.ensaio.data)} <span className="font-normal text-muted-foreground">· {r.ensaio.horario}</span>
                    </p>
                    <EnsaioStatusChip status={ensaioStatus(r.ensaio, todayKey)} />
                  </div>
                  <p className={cn('text-xs font-medium', COR_SITUACAO[r.situacao].texto)}>{SITUACAO_LABELS[r.situacao]}</p>
                  {r.situacao === 'avisouFalta' && motivoDe(r) && (
                    <p className="whitespace-pre-wrap text-xs text-gray-700">Motivo: {motivoDe(r)}</p>
                  )}
                  <p className="flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
                    {detalhe.mostrarCena && <span>{r.cena.nome}</span>}
                    {detalhe.mostrarCena && r.personagem.nome !== detalhe.titulo && <span>({r.personagem.nome})</span>}
                    {r.ensaio.obrigatorios?.length ? (
                      <span>{obrigatorioMarcado ? 'Obrigatório nesse ensaio' : 'Ensaio só com obrigatórios'}</span>
                    ) : (
                      <span>Cena toda chamada</span>
                    )}
                    {r.ensaio.geral && (
                      <span className="flex items-center gap-0.5">
                        <Star className="h-3 w-3" /> Geral
                      </span>
                    )}
                  </p>
                </div>
                <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-gray-400" />
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
