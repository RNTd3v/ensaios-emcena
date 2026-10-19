import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, CalendarDays, Check, CheckCheck, ChevronDown, ChevronRight, CircleHelp, Clapperboard, Clock, MapPin, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/Spinner'
import { Card, CardContent } from '@/components/ui/card'
import { EnsaioStatusChip } from '@/components/ensaio/EnsaioStatusChip'
import { RespostaPresenca, ensaioJaComecou } from '@/components/ensaio/RespostaPresenca'
import { Avatar } from '@/components/ui/Avatar'
import { useAgora, useUsersMap } from '@/components/oracao/OrandoAgora'
import { PreparoInfo } from '@/components/ensaio/PreparoEnsaio'
import { useSettingsStore } from '@/stores/settingsStore'
import { useProximosTreinamentos } from '@/hooks/useTreinamentos'
import { useEnsaiosDasMinhasCenas } from '@/hooks/useEnsaiosDasMinhasCenas'
import { aplicarIndisponibilidades, confirmarPresenca, uidsAusentes, uidsIndisponiveis } from '@/services/firebase/ensaios'
import { getInscricao } from '@/services/firebase/inscricoes'
import { subscribeToLocais } from '@/services/firebase/locais'
import { addDays, canCheckin, formatRelativeDia, toDateKey } from '@/lib/agenda'
import { formatDuracao, formatHoraCompacta } from '@/lib/cenaHorario'
import { segundosDoCronometro } from '@/lib/cronometro'
import { uidsDoEnsaio } from '@/lib/ensaioPublico'
import { ensaioStatus } from '@/lib/ensaioStatus'
import { localIcon } from '@/lib/localIcons'
import { cn } from '@/lib/utils'
import type { Cena, Ensaio, Inscricao, LocalEnsaio } from '@/types'

/** Alguém da casa que pode ter ensaio: a própria pessoa (sem `nome`) ou um filho. */
export interface PessoaDaCasa {
  uid: string
  /** Só pros filhos — a própria pessoa aparece como "Você". */
  nome?: string
}

type Item = { ensaio: Ensaio; cena: Cena }

/** O que cada pessoa da casa tem pela frente; `null` enquanto as cenas carregam. */
type EnsaiosDaPessoa = { temCena: boolean; doDia: Item[]; futuros: Item[]; realizados: Item[] } | null

const porDataHora = (a: Item, b: Item) =>
  a.ensaio.data.localeCompare(b.ensaio.data) || a.ensaio.horario.localeCompare(b.ensaio.horario)

/** "Ana", "Ana e Beto", "Ana, Beto e Caio". */
function juntarNomes(nomes: string[]): string {
  return nomes.length > 1 ? `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}` : (nomes[0] ?? '')
}

/**
 * Cards em destaque na Home pra quem é do elenco (tem personagem vinculado em alguma cena ativa) e
 * pros filhos dela: os ensaios de hoje (todos, inclusive os já finalizados) e o próximo ensaio ainda
 * não finalizado de cada um — que só ganha card próprio se não for de hoje (aí já está no card do
 * dia) — e o resto dos próximos 7 dias numa lista compacta ("Mais nesta semana"). Quando a pessoa
 * e os filhos (ou vários filhos) estão no mesmo ensaio, é um card só, com a resposta de cada um ali
 * mesmo ("Vou" / "Não vou" com motivo) e um "Todos vão".
 * Ensaio de hoje que já começou e não foi finalizado ganha um card "Ensaio acontecendo" (como o
 * "Orando agora"), com quem está presente e, pra quem confirmou, o "não vou conseguir ir".
 * Ensaio com obrigatórios marcados só aparece pra quem é obrigatório.
 * Não renderiza nada pra quem não tem personagem. Ensaio no mesmo dia de um treinamento da pessoa
 * fica de fora — o treinamento tem prioridade e aparece no ProximoTreinamentoCard.
 */
export function ProximoEnsaioCard({ uid, dependentes }: { uid: string; dependentes: PessoaDaCasa[] }) {
  const [porPessoa, setPorPessoa] = useState<Record<string, EnsaiosDaPessoa>>({})
  const [locais, setLocais] = useState<LocalEnsaio[]>([])
  // "Mais nesta semana" começa fechado: o destaque é o próximo ensaio, o resto fica a um toque.
  const [semanaAberta, setSemanaAberta] = useState(false)
  const { settings } = useSettingsStore()
  // Re-renderiza a cada 30s pra o ensaio virar "acontecendo" na hora em que começa.
  useAgora()

  useEffect(() => subscribeToLocais(setLocais), [])

  const reportar = useCallback((quem: string, ensaios: EnsaiosDaPessoa) => {
    setPorPessoa(prev => ({ ...prev, [quem]: ensaios }))
  }, [])

  const pessoas = useMemo<PessoaDaCasa[]>(() => [{ uid }, ...dependentes], [uid, dependentes])
  const todayKey = toDateKey(new Date())

  // Junta os ensaios de todo mundo por id: cada ensaio com as pessoas da casa que estão nele.
  const { acontecendo, restantesDoDia, proximos, daSemana, realizados, meuVazio } = useMemo(() => {
    const quemVai = new Map<string, PessoaDaCasa[]>()
    const itemPorId = new Map<string, Item>()
    for (const pessoa of pessoas) {
      const dela = porPessoa[pessoa.uid]
      for (const item of [...(dela?.doDia ?? []), ...(dela?.futuros ?? []), ...(dela?.realizados ?? [])]) {
        const lista = quemVai.get(item.ensaio.id) ?? []
        if (!lista.includes(pessoa)) lista.push(pessoa)
        quemVai.set(item.ensaio.id, lista)
        if (!itemPorId.has(item.ensaio.id)) itemPorId.set(item.ensaio.id, item)
      }
    }
    const comPessoas = (ids: Iterable<string>) =>
      [...new Set(ids)].map(id => ({ ...itemPorId.get(id)!, pessoas: quemVai.get(id)! })).sort(porDataHora)

    const doDia = comPessoas(pessoas.flatMap(p => (porPessoa[p.uid]?.doDia ?? []).map(i => i.ensaio.id)))
    const acontecendo = doDia.filter(({ ensaio }) => !ensaio.finalizadoAt && ensaioJaComecou(ensaio))
    const proximos = comPessoas(
      pessoas.flatMap(p => {
        const proximo = porPessoa[p.uid]?.futuros[0]
        // Se o próximo é de hoje, ele já está no card do dia.
        return proximo && proximo.ensaio.data !== todayKey ? [proximo.ensaio.id] : []
      }),
    )
    // O resto dos próximos 7 dias (sem hoje nem os que já têm card de próximo), em linhas compactas.
    const ateKey = toDateKey(addDays(new Date(`${todayKey}T00:00:00`), 7))
    const jaMostrados = new Set(proximos.map(i => i.ensaio.id))
    const daSemana = comPessoas(
      pessoas.flatMap(p =>
        (porPessoa[p.uid]?.futuros ?? [])
          .filter(i => i.ensaio.data > todayKey && i.ensaio.data <= ateKey && !jaMostrados.has(i.ensaio.id))
          .map(i => i.ensaio.id),
      ),
    )
    // Do mais recente pro mais antigo.
    const realizados = comPessoas(pessoas.flatMap(p => (porPessoa[p.uid]?.realizados ?? []).map(i => i.ensaio.id))).reverse()
    const meus = porPessoa[uid]
    return {
      acontecendo,
      restantesDoDia: doDia.filter(item => !acontecendo.includes(item)),
      proximos,
      daSemana,
      realizados,
      meuVazio: !!meus?.temCena && !meus.doDia.length && !meus.futuros.length,
    }
  }, [pessoas, porPessoa, todayKey, uid])

  const checkinLimiteHoras = settings.checkinLimiteHoras ?? 2
  const nomesDe = (lista: PessoaDaCasa[]) => juntarNomes(lista.map(p => p.nome ?? 'você'))
  const soEu = (lista: PessoaDaCasa[]) => lista.every(p => p.uid === uid)
  const semMim = (lista: PessoaDaCasa[]) => lista.every(p => p.uid !== uid)
  const bloco = ({ ensaio, cena, pessoas }: Item & { pessoas: PessoaDaCasa[] }) => (
    <EnsaioBloco
      key={ensaio.id}
      ensaio={ensaio}
      cena={cena}
      pessoas={pessoas}
      uid={uid}
      locais={locais}
      todayKey={todayKey}
      checkinLimiteHoras={checkinLimiteHoras}
    />
  )
  const pessoasDoDia = [...new Set(restantesDoDia.flatMap(i => i.pessoas))]

  return (
    <>
      {pessoas.map(p => (
        <ColetarEnsaios key={p.uid} uid={p.uid} dependenteDe={p.uid === uid ? undefined : uid} onChange={reportar} />
      ))}

      {meuVazio && (
        <Link to="/cenas" className="block">
          <Card>
            <CardContent className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CalendarClock className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">Nenhum ensaio confirmado</p>
                <p className="text-xs text-muted-foreground">Veja a agenda das suas cenas.</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
            </CardContent>
          </Card>
        </Link>
      )}

      {acontecendo.map(item => (
        <Card key={item.ensaio.id} className="border-2 border-emerald-500">
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                {semMim(item.pessoas) ? `Ensaio de ${nomesDe(item.pessoas)} acontecendo` : 'Ensaio acontecendo'}
              </p>
              <CronometroAoVivo ensaio={item.ensaio} />
            </div>
            <PresentesAgora ensaio={item.ensaio} cena={item.cena} />
            {bloco(item)}
          </CardContent>
        </Card>
      ))}

      {restantesDoDia.length > 0 && (
        <Card className="border-2 border-primary">
          <CardContent className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              {soEu(pessoasDoDia)
                ? restantesDoDia.length > 1
                  ? 'Seus ensaios de hoje'
                  : 'Seu ensaio de hoje'
                : `${restantesDoDia.length > 1 ? 'Ensaios' : 'Ensaio'} de hoje${semMim(pessoasDoDia) ? ` de ${nomesDe(pessoasDoDia)}` : ''}`}
            </p>
            {restantesDoDia.map((item, i) => (
              <div key={item.ensaio.id} className={i > 0 ? 'border-t-2 border-gray-100 pt-3' : undefined}>
                {bloco(item)}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {proximos.map(item => (
        <Card key={item.ensaio.id} className="border-2 border-primary">
          <CardContent className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              {soEu(item.pessoas)
                ? 'Seu próximo ensaio'
                : semMim(item.pessoas)
                  ? `Próximo ensaio de ${nomesDe(item.pessoas)}`
                  : 'Próximo ensaio'}
            </p>
            {bloco(item)}
          </CardContent>
        </Card>
      ))}

      {(daSemana.length > 0 || realizados.length > 0) && (
        <Card>
          <CardContent className="space-y-1">
            <button
              type="button"
              onClick={() => setSemanaAberta(a => !a)}
              aria-expanded={semanaAberta}
              className={cn('flex w-full items-center gap-2 text-left', semanaAberta && 'pb-1')}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CalendarDays className="h-4 w-4" />
              </span>
              <p className="flex-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {daSemana.length ? 'Mais nesta semana' : 'Ensaios da semana'} ({daSemana.length + realizados.length})
              </p>
              <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', !semanaAberta && '-rotate-90')} />
            </button>
            {semanaAberta && daSemana.map((item, i) => (
              <LinhaDaSemana key={item.ensaio.id} {...item} uid={uid} todayKey={todayKey} className={i > 0 ? 'border-t border-gray-100' : undefined} />
            ))}
            {semanaAberta && realizados.length > 0 && (
              <>
                <p className={cn('pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground', daSemana.length > 0 && 'pt-3')}>
                  Realizados
                </p>
                {realizados.map((item, i) => (
                  <LinhaDaSemana
                    key={item.ensaio.id}
                    {...item}
                    uid={uid}
                    todayKey={todayKey}
                    className={i > 0 ? 'border-t border-gray-100' : undefined}
                  />
                ))}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </>
  )
}

/** "Amanhã", "Ontem" ou "qui 16/10". */
function rotuloDia(dateKey: string, todayKey: string): string {
  const relativo = formatRelativeDia(dateKey, todayKey)
  if (relativo === 'Amanhã') return relativo
  if (dateKey === toDateKey(addDays(new Date(`${todayKey}T00:00:00`), -1))) return 'Ontem'
  const d = new Date(`${dateKey}T00:00:00`)
  const semana = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
  return `${semana} ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
}

/**
 * Um ensaio da semana numa linha: quando, cena, local e a resposta de cada pessoa da casa que está
 * nele (✓ vai, ✗ não vai, ? sem resposta). Já realizado: a presença (✓ presente, ✗ não foi).
 * Tocar abre o ensaio, onde dá pra responder (ou ver o registro).
 */
function LinhaDaSemana({
  ensaio,
  cena,
  pessoas,
  uid,
  todayKey,
  className,
}: Item & { pessoas: PessoaDaCasa[]; uid: string; todayKey: string; className?: string }) {
  const ausentes = uidsAusentes(ensaio)
  const soEu = pessoas.length === 1 && pessoas[0].uid === uid
  const realizado = !!ensaio.finalizadoAt
  return (
    <Link to={`/cenas/${cena.id}/ensaios/${ensaio.id}`} className={cn('flex items-center gap-3 py-2', className)}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900">
          <span className="capitalize">{rotuloDia(ensaio.data, todayKey)}</span> · {formatHoraCompacta(ensaio.horario)}
        </p>
        <p className="truncate text-xs text-gray-700">
          {cena.nome}
          {ensaio.local && <span className="text-muted-foreground"> · {ensaio.local}</span>}
        </p>
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs">
          {pessoas.map(p => {
            const vai = !!ensaio.presencas?.includes(p.uid)
            // No registro, quem não está em `presencas` não foi (avisando ou não).
            const naoVai = realizado ? !vai : ausentes.includes(p.uid)
            const Icone = vai ? Check : naoVai ? X : CircleHelp
            const status = realizado ? (vai ? 'Presente' : 'Não foi') : vai ? 'Confirmado' : naoVai ? 'Não vai' : 'Sem resposta'
            const nome = soEu ? status : (p.nome ?? 'Você')
            return (
              <span
                key={p.uid}
                className={cn('flex items-center gap-0.5', vai ? 'text-emerald-700' : naoVai ? 'text-red-600' : 'text-muted-foreground')}
              >
                <Icone className="h-3.5 w-3.5 shrink-0" />
                {nome}
              </span>
            )
          })}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
    </Link>
  )
}

/**
 * Sem tela: acompanha os ensaios de uma pessoa da casa (cenas, treinamentos, indisponibilidades da
 * inscrição) e avisa o card, que junta os de todo mundo. Modo dependente: `uid` é um filho de `dependenteDe`.
 */
function ColetarEnsaios({
  uid,
  dependenteDe,
  onChange,
}: {
  uid: string
  dependenteDe?: string
  onChange: (uid: string, ensaios: EnsaiosDaPessoa) => void
}) {
  const { cenas, minhasCenas, ensaiosPorCena } = useEnsaiosDasMinhasCenas(uid, dependenteDe)
  const todayKey = toDateKey(new Date())

  // Datas marcadas como indisponíveis na inscrição viram "não vou" nos próximos ensaios que a
  // pessoa ainda não respondeu — cobre ensaios confirmados antes e datas incluídas depois.
  const [minhaInscricao, setMinhaInscricao] = useState<Inscricao | null>(null)
  useEffect(() => {
    getInscricao(uid).then(setMinhaInscricao, () => setMinhaInscricao(null))
  }, [uid])
  const jaAplicados = useRef(new Set<string>())
  useEffect(() => {
    if (!minhaInscricao?.indisponibilidade?.length) return
    for (const cena of minhasCenas) {
      for (const e of ensaiosPorCena[cena.id] ?? []) {
        if (e.canceledByUid || e.finalizadoAt || e.data < todayKey || jaAplicados.current.has(e.id)) continue
        if (!uidsIndisponiveis(cena, e.data, { [uid]: minhaInscricao }, e).includes(uid)) continue
        jaAplicados.current.add(e.id)
        aplicarIndisponibilidades(e.id, [uid]).catch(() => jaAplicados.current.delete(e.id))
      }
    }
  }, [minhaInscricao, minhasCenas, ensaiosPorCena, todayKey, uid])

  // Só conta pra quem é do elenco, então os treinamentos "só elenco" valem.
  const treinamentos = useProximosTreinamentos(uid, true)
  const diasDeTreinamento = useMemo(() => new Set(treinamentos.map(t => t.sessao.data)), [treinamentos])

  // Ensaios de hoje da pessoa (inclusive os já finalizados), os próximos ainda não finalizados e os
  // realizados na última semana.
  const ensaios = useMemo<EnsaiosDaPessoa>(() => {
    if (!cenas) return null
    const doDia: Item[] = []
    const futuros: Item[] = []
    const realizados: Item[] = []
    const semanaPassadaKey = toDateKey(addDays(new Date(`${todayKey}T00:00:00`), -7))
    for (const cena of minhasCenas) {
      for (const e of ensaiosPorCena[cena.id] ?? []) {
        if (e.canceledByUid) continue
        // Com obrigatórios marcados, o ensaio é só deles (vale pra criança também: obrigatória, aparece).
        if (!uidsDoEnsaio(cena.personagens, e).has(uid)) continue
        // Finalizados dos últimos 7 dias (os de hoje já estão no card do dia).
        if (e.data < todayKey) {
          if (e.finalizadoAt && e.data >= semanaPassadaKey) realizados.push({ ensaio: e, cena })
          continue
        }
        if (diasDeTreinamento.has(e.data)) continue
        if (e.data === todayKey) doDia.push({ ensaio: e, cena })
        if (!e.finalizadoAt) futuros.push({ ensaio: e, cena })
      }
    }
    return {
      temCena: minhasCenas.length > 0,
      doDia: doDia.sort(porDataHora),
      futuros: futuros.sort(porDataHora),
      realizados: realizados.sort(porDataHora),
    }
  }, [cenas, minhasCenas, ensaiosPorCena, todayKey, diasDeTreinamento, uid])

  useEffect(() => onChange(uid, ensaios), [onChange, uid, ensaios])
  useEffect(() => () => onChange(uid, null), [onChange, uid])

  return null
}

/**
 * Um ensaio dentro do card: quando, cena, local, preparo, a resposta de cada pessoa da casa que está
 * nele (com "Todos vão" quando são várias) e atalho.
 */
function EnsaioBloco({
  ensaio,
  cena,
  pessoas,
  uid,
  locais,
  todayKey,
  checkinLimiteHoras,
}: {
  ensaio: Ensaio
  cena: Cena
  pessoas: PessoaDaCasa[]
  /** Quem está vendo. */
  uid: string
  locais: LocalEnsaio[]
  todayKey: string
  checkinLimiteHoras: number
}) {
  const personagensDe = (quem: string) => cena.personagens.filter(p => p.participanteUid === quem).map(p => p.nome)
  // Só a própria pessoa: do jeito de sempre, sem nome. Com filhos, cada um com o nome e a resposta.
  const soEu = pessoas.length === 1 && pessoas[0].uid === uid
  const localCadastrado = ensaio.local
    ? locais.find(l => l.nome.trim().toLowerCase() === ensaio.local!.trim().toLowerCase())
    : undefined
  const LocalIcon = localCadastrado ? localIcon(localCadastrado.icone) : MapPin

  const ensaioUrl = `/cenas/${cena.id}/ensaios/${ensaio.id}`
  const meusPersonagens = soEu ? personagensDe(uid) : []

  return (
    <div className="space-y-3">
      <Link to={ensaioUrl} className="block">
        <div className="flex items-start justify-between gap-2">
          <p className="text-2xl font-bold text-gray-900">
            {formatRelativeDia(ensaio.data, todayKey)} · {formatHoraCompacta(ensaio.horario)}
          </p>
          <EnsaioStatusChip status={ensaioStatus(ensaio, todayKey)} />
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-gray-700">
          <Clapperboard className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate">{cena.nome}</span>
        </p>
        {meusPersonagens.length > 0 && (
          <p className="mt-0.5 truncate pl-5.5 text-xs text-muted-foreground">Como {meusPersonagens.join(', ')}</p>
        )}
        {ensaio.local && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-700">
            <LocalIcon className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">{ensaio.local}</span>
          </p>
        )}
        <PreparoInfo roupa={ensaio.roupa} levar={ensaio.levar} className="mt-1" />
      </Link>

      {/* Ensaio já finalizado não pede mais resposta. */}
      {!ensaio.finalizadoAt &&
        (soEu ? (
          <div className="border-t border-gray-100 pt-3">
            <RespostaPresenca ensaio={ensaio} uid={uid} checkinLimiteHoras={checkinLimiteHoras} />
          </div>
        ) : (
          <>
            <TodosVao ensaio={ensaio} pessoas={pessoas} checkinLimiteHoras={checkinLimiteHoras} />
            {pessoas.map(p => {
              const personagens = personagensDe(p.uid)
              return (
                <div key={p.uid} className="space-y-2 border-t border-gray-100 pt-3">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {p.nome ?? 'Você'}
                    {personagens.length > 0 && (
                      <span className="font-normal text-muted-foreground"> · como {personagens.join(', ')}</span>
                    )}
                  </p>
                  <RespostaPresenca ensaio={ensaio} uid={p.uid} checkinLimiteHoras={checkinLimiteHoras} paraQuem={p.nome} />
                </div>
              )
            })}
          </>
        ))}

      <Link
        to={ensaioUrl}
        className="flex items-center justify-center gap-1 rounded-full bg-primary/10 py-2 text-sm font-medium text-primary hover:bg-primary/15"
      >
        Abrir ensaio
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

/** Confirma de uma vez todo mundo da casa que ainda não respondeu — só com 2+ sem resposta e o check-in aberto. */
function TodosVao({
  ensaio,
  pessoas,
  checkinLimiteHoras,
}: {
  ensaio: Ensaio
  pessoas: PessoaDaCasa[]
  checkinLimiteHoras: number
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const ausentes = uidsAusentes(ensaio)
  const semResposta = pessoas.filter(p => !ensaio.presencas?.includes(p.uid) && !ausentes.includes(p.uid))
  if (semResposta.length < 2 || ensaioJaComecou(ensaio) || !canCheckin(ensaio.data, ensaio.horario, checkinLimiteHoras))
    return null

  async function confirmarTodos() {
    setSaving(true)
    setError('')
    try {
      await Promise.all(semResposta.map(p => confirmarPresenca(ensaio.id, p.uid)))
    } catch {
      setError('Não foi possível salvar. Tente de novo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-1 border-t border-gray-100 pt-3">
      <Button size="sm" className="w-full gap-1.5" onClick={confirmarTodos} disabled={saving}>
        {saving ? <Spinner size="sm" className="border-white/40 border-t-white" /> : <CheckCheck className="h-4 w-4" />}
        Todos vão
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

/** Tempo do cronômetro da tela ao vivo, andando a cada segundo — só aparece se alguém iniciou. */
function CronometroAoVivo({ ensaio }: { ensaio: Ensaio }) {
  const correndo = ensaio.cronometro?.inicioMs != null
  useAgora(correndo ? 1000 : 60_000)
  if (!ensaio.cronometro || segundosDoCronometro(ensaio.cronometro) === 0) return null
  return (
    <span className="flex items-center gap-1 font-mono text-sm font-semibold tabular-nums text-emerald-700">
      <Clock className="h-3.5 w-3.5" />
      {formatDuracao(segundosDoCronometro(ensaio.cronometro))}
    </span>
  )
}

/** Fotos de quem está com presença marcada no ensaio (do elenco da cena). */
function PresentesAgora({ ensaio, cena }: { ensaio: Ensaio; cena: Cena }) {
  const users = useUsersMap()
  const elenco = uidsDoEnsaio(cena.personagens, ensaio)
  const presentes = (ensaio.presencas ?? []).filter(uid => elenco.has(uid))
  if (!presentes.length) return <p className="text-xs text-muted-foreground">Ninguém com presença marcada ainda.</p>
  const MAX = 8
  const nomeDe = (uid: string) => users[uid]?.apelido || users[uid]?.displayName?.split(' ')[0] || ''
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">
        {presentes.length} {presentes.length === 1 ? 'presente' : 'presentes'} de {elenco.size}
      </p>
      <div className="flex flex-wrap gap-2.5">
        {presentes.slice(0, MAX).map(uid => (
          <div key={uid} className="flex w-11 flex-col items-center gap-0.5 text-center">
            <Avatar photoURL={users[uid]?.photoURL} name={nomeDe(uid)} className="h-9 w-9 text-xs ring-2 ring-emerald-400 ring-offset-1" />
            <span className="w-full truncate text-[10px] text-gray-700">{nomeDe(uid)}</span>
          </div>
        ))}
        {presentes.length > MAX && (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
            +{presentes.length - MAX}
          </span>
        )}
      </div>
    </div>
  )
}
