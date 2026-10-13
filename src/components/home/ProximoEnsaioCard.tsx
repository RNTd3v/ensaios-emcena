import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, ChevronRight, Clapperboard, Clock, MapPin } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { EnsaioStatusChip } from '@/components/ensaio/EnsaioStatusChip'
import { RespostaPresenca, ensaioJaComecou } from '@/components/ensaio/RespostaPresenca'
import { Avatar } from '@/components/ui/Avatar'
import { useAgora, useUsersMap } from '@/components/oracao/OrandoAgora'
import { PreparoInfo } from '@/components/ensaio/PreparoEnsaio'
import { useSettingsStore } from '@/stores/settingsStore'
import { useProximosTreinamentos } from '@/hooks/useTreinamentos'
import { useEnsaiosDasMinhasCenas } from '@/hooks/useEnsaiosDasMinhasCenas'
import { aplicarIndisponibilidades, uidsIndisponiveis } from '@/services/firebase/ensaios'
import { getInscricao } from '@/services/firebase/inscricoes'
import { subscribeToLocais } from '@/services/firebase/locais'
import { formatRelativeDia, toDateKey } from '@/lib/agenda'
import { formatDuracao, formatHoraCompacta } from '@/lib/cenaHorario'
import { segundosDoCronometro } from '@/lib/cronometro'
import { ensaioStatus } from '@/lib/ensaioStatus'
import { localIcon } from '@/lib/localIcons'
import type { Cena, Ensaio, Inscricao, LocalEnsaio } from '@/types'

/**
 * Cards em destaque na Home pra quem é do elenco (tem personagem vinculado em alguma cena ativa):
 * os ensaios de hoje dessa pessoa (todos, inclusive os já finalizados) e o próximo ensaio ainda não
 * finalizado — que só ganha card próprio se não for de hoje (aí já está no card do dia). Cada um
 * com a resposta dela ali mesmo ("Vou" / "Não vou" com motivo) e atalho pra página do ensaio.
 * Ensaio de hoje que já começou e não foi finalizado ganha um card "Ensaio acontecendo" (como o
 * "Orando agora"), com quem está presente e, pra quem confirmou, o "não vou conseguir ir".
 * Não renderiza nada pra quem não tem personagem. Ensaio no mesmo dia de um treinamento da pessoa
 * fica de fora — o treinamento tem prioridade e aparece no ProximoTreinamentoCard.
 */
export function ProximoEnsaioCard({
  uid,
  dependenteDe,
  nome,
}: {
  /** De quem é o ensaio (a própria pessoa, ou um filho). */
  uid: string
  /** Modo dependente: `uid` é um filho e quem está vendo (responsável) responde por ele. */
  dependenteDe?: string
  nome?: string
}) {
  const { cenas, minhasCenas, ensaiosPorCena } = useEnsaiosDasMinhasCenas(uid, dependenteDe)
  const [locais, setLocais] = useState<LocalEnsaio[]>([])
  const { settings } = useSettingsStore()
  // Re-renderiza a cada 30s pra o ensaio virar "acontecendo" na hora em que começa.
  useAgora()

  useEffect(() => subscribeToLocais(setLocais), [])

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

  // Só renderiza pra quem é do elenco, então os treinamentos "só elenco" valem.
  const treinamentos = useProximosTreinamentos(uid, true)
  const diasDeTreinamento = useMemo(() => new Set(treinamentos.map(t => t.sessao.data)), [treinamentos])

  // Ensaios de hoje da pessoa (inclusive os já finalizados) e o próximo ainda não finalizado.
  const { doDia, proximo } = useMemo(() => {
    const doDia: { ensaio: Ensaio; cena: Cena }[] = []
    const futuros: { ensaio: Ensaio; cena: Cena }[] = []
    for (const cena of minhasCenas) {
      for (const e of ensaiosPorCena[cena.id] ?? []) {
        if (e.canceledByUid || e.data < todayKey || diasDeTreinamento.has(e.data)) continue
        if (e.data === todayKey) doDia.push({ ensaio: e, cena })
        if (!e.finalizadoAt) futuros.push({ ensaio: e, cena })
      }
    }
    const porDataHora = (a: { ensaio: Ensaio }, b: { ensaio: Ensaio }) =>
      a.ensaio.data.localeCompare(b.ensaio.data) || a.ensaio.horario.localeCompare(b.ensaio.horario)
    return { doDia: doDia.sort(porDataHora), proximo: futuros.sort(porDataHora)[0] }
  }, [minhasCenas, ensaiosPorCena, todayKey, diasDeTreinamento])

  if (!cenas || minhasCenas.length === 0) return null

  // Filho sem ensaio hoje nem confirmado: não ocupa espaço na Home.
  if (!proximo && !doDia.length && dependenteDe) return null

  if (!proximo && !doDia.length) {
    return (
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
    )
  }

  const checkinLimiteHoras = settings.checkinLimiteHoras ?? 2
  const acontecendo = doDia.filter(({ ensaio }) => !ensaio.finalizadoAt && ensaioJaComecou(ensaio))
  const restantesDoDia = doDia.filter(item => !acontecendo.includes(item))
  const bloco = ({ ensaio, cena }: { ensaio: Ensaio; cena: Cena }) => (
    <EnsaioBloco
      key={ensaio.id}
      ensaio={ensaio}
      cena={cena}
      uid={uid}
      locais={locais}
      todayKey={todayKey}
      checkinLimiteHoras={checkinLimiteHoras}
      paraQuem={dependenteDe ? nome : undefined}
    />
  )

  return (
    <>
      {acontecendo.map(item => (
        <Card key={item.ensaio.id} className="border-2 border-emerald-500">
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                {dependenteDe ? `Ensaio de ${nome ?? 'dependente'} acontecendo` : 'Ensaio acontecendo'}
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
              {dependenteDe
                ? `${restantesDoDia.length > 1 ? 'Ensaios' : 'Ensaio'} de hoje de ${nome ?? 'dependente'}`
                : restantesDoDia.length > 1
                  ? 'Seus ensaios de hoje'
                  : 'Seu ensaio de hoje'}
            </p>
            {restantesDoDia.map((item, i) => (
              <div key={item.ensaio.id} className={i > 0 ? 'border-t-2 border-gray-100 pt-3' : undefined}>
                {bloco(item)}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Se o próximo é de hoje, ele já está no card do dia. */}
      {proximo && proximo.ensaio.data !== todayKey && (
        <Card className="border-2 border-primary">
          <CardContent className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              {dependenteDe ? `Próximo ensaio de ${nome ?? 'dependente'}` : 'Seu próximo ensaio'}
            </p>
            {bloco(proximo)}
          </CardContent>
        </Card>
      )}
    </>
  )
}

/** Um ensaio dentro do card: quando, cena, personagens, local, preparo, resposta e atalho. */
function EnsaioBloco({
  ensaio,
  cena,
  uid,
  locais,
  todayKey,
  checkinLimiteHoras,
  paraQuem,
}: {
  ensaio: Ensaio
  cena: Cena
  uid: string
  locais: LocalEnsaio[]
  todayKey: string
  checkinLimiteHoras: number
  paraQuem?: string
}) {
  const meusPersonagens = cena.personagens.filter(p => p.participanteUid === uid).map(p => p.nome)
  const localCadastrado = ensaio.local
    ? locais.find(l => l.nome.trim().toLowerCase() === ensaio.local!.trim().toLowerCase())
    : undefined
  const LocalIcon = localCadastrado ? localIcon(localCadastrado.icone) : MapPin

  const ensaioUrl = `/cenas/${cena.id}/ensaios/${ensaio.id}`

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
      {!ensaio.finalizadoAt && (
        <div className="border-t border-gray-100 pt-3">
          <RespostaPresenca ensaio={ensaio} uid={uid} checkinLimiteHoras={checkinLimiteHoras} paraQuem={paraQuem} />
        </div>
      )}

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
  const elenco = new Set(cena.personagens.map(p => p.participanteUid).filter(Boolean))
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
