import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, ChevronRight, Clapperboard, MapPin } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { EnsaioStatusChip } from '@/components/ensaio/EnsaioStatusChip'
import { RespostaPresenca } from '@/components/ensaio/RespostaPresenca'
import { useSettingsStore } from '@/stores/settingsStore'
import { subscribeToCenasDoParticipante } from '@/services/firebase/cenas'
import { aplicarIndisponibilidades, subscribeToEnsaiosDaCena, uidsIndisponiveis } from '@/services/firebase/ensaios'
import { getInscricao } from '@/services/firebase/inscricoes'
import { subscribeToLocais } from '@/services/firebase/locais'
import { formatRelativeDia, toDateKey } from '@/lib/agenda'
import { formatHoraCompacta } from '@/lib/cenaHorario'
import { ensaioStatus } from '@/lib/ensaioStatus'
import { localIcon } from '@/lib/localIcons'
import type { Cena, Ensaio, Inscricao, LocalEnsaio } from '@/types'

/**
 * Card em destaque na Home pra quem é do elenco (tem personagem vinculado em alguma cena ativa):
 * o próximo ensaio dessa pessoa — o de hoje ainda não finalizado, senão o próximo futuro — com
 * a resposta dela ali mesmo ("Vou" / "Não vou" com motivo) e atalho pra página do ensaio.
 * Não renderiza nada pra quem não tem personagem.
 */
export function ProximoEnsaioCard({ uid }: { uid: string }) {
  const [cenas, setCenas] = useState<Cena[] | null>(null)
  const [ensaiosPorCena, setEnsaiosPorCena] = useState<Record<string, Ensaio[]>>({})
  const [locais, setLocais] = useState<LocalEnsaio[]>([])
  const { settings } = useSettingsStore()

  useEffect(() => subscribeToCenasDoParticipante(uid, setCenas), [uid])
  useEffect(() => subscribeToLocais(setLocais), [])

  const minhasCenas = useMemo(
    () => (cenas ?? []).filter(c => c.ativo && c.personagens.some(p => p.participanteUid === uid)),
    [cenas, uid],
  )
  const cenaIdsKey = minhasCenas.map(c => c.id).sort().join(',')

  // Uma assinatura por cena — a regra de `ensaios` só libera leitura filtrando por `cenaId`.
  useEffect(() => {
    if (!cenaIdsKey) return
    const unsubs = cenaIdsKey.split(',').map(cenaId =>
      subscribeToEnsaiosDaCena(cenaId, ensaios => setEnsaiosPorCena(prev => ({ ...prev, [cenaId]: ensaios }))),
    )
    return () => unsubs.forEach(u => u())
  }, [cenaIdsKey])

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

  const proximo = useMemo(() => {
    const candidatos: { ensaio: Ensaio; cena: Cena }[] = []
    for (const cena of minhasCenas) {
      for (const e of ensaiosPorCena[cena.id] ?? []) {
        if (e.canceledByUid || e.finalizadoAt || e.data < todayKey) continue
        candidatos.push({ ensaio: e, cena })
      }
    }
    return candidatos.sort((a, b) => a.ensaio.data.localeCompare(b.ensaio.data) || a.ensaio.horario.localeCompare(b.ensaio.horario))[0]
  }, [minhasCenas, ensaiosPorCena, todayKey])

  if (!cenas || minhasCenas.length === 0) return null

  if (!proximo) {
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

  const { ensaio, cena } = proximo
  const meusPersonagens = cena.personagens.filter(p => p.participanteUid === uid).map(p => p.nome)
  const localCadastrado = ensaio.local
    ? locais.find(l => l.nome.trim().toLowerCase() === ensaio.local!.trim().toLowerCase())
    : undefined
  const LocalIcon = localCadastrado ? localIcon(localCadastrado.icone) : MapPin

  const ensaioUrl = `/cenas/${cena.id}/ensaios/${ensaio.id}`

  return (
    <Card className="border-2 border-primary">
      <CardContent className="space-y-3">
        <Link to={ensaioUrl} className="block space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Seu próximo ensaio</p>
            <EnsaioStatusChip status={ensaioStatus(ensaio, todayKey)} />
          </div>

          <div>
            <p className="text-2xl font-bold text-gray-900">
              {formatRelativeDia(ensaio.data, todayKey)} · {formatHoraCompacta(ensaio.horario)}
            </p>
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
          </div>
        </Link>

        <div className="border-t border-gray-100 pt-3">
          <RespostaPresenca ensaio={ensaio} uid={uid} checkinLimiteHoras={settings.checkinLimiteHoras ?? 2} />
        </div>

        <Link
          to={ensaioUrl}
          className="flex items-center justify-center gap-1 rounded-full bg-primary/10 py-2 text-sm font-medium text-primary hover:bg-primary/15"
        >
          Abrir ensaio
          <ChevronRight className="h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  )
}
