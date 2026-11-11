import { Link } from 'react-router-dom'
import { Backpack, ChevronRight, Drama, GraduationCap, MapPin, Shirt, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { RespostaPresenca } from '@/components/ensaio/RespostaPresenca'
import { useEhElenco, useProximosTreinamentos } from '@/hooks/useTreinamentos'
import { grupoDaPessoa } from '@/services/firebase/treinamentos'
import { useSettingsStore } from '@/stores/settingsStore'
import { formatRelativeDia, toDateKey } from '@/lib/agenda'
import { formatHoraCompacta } from '@/lib/cenaHorario'

/**
 * Card na Home com o próximo treinamento da pessoa (ou de um filho, em `dependenteDe`), com a
 * resposta de presença ali mesmo. Treinamento tem prioridade: o ensaio que cai no mesmo dia some
 * do card de próximo ensaio (ver ProximoEnsaioCard). Sem treinamento, não renderiza nada.
 */
export function ProximoTreinamentoCard({ uid, dependenteDe, nome }: { uid: string; dependenteDe?: string; nome?: string }) {
  const ehElenco = useEhElenco(uid, dependenteDe)
  const proximos = useProximosTreinamentos(uid, ehElenco)
  const { settings } = useSettingsStore()
  const todayKey = toDateKey(new Date())

  const proximo = proximos[0]
  if (!proximo) return null
  const { sessao, treinamento } = proximo
  const url = `/treinamentos/${treinamento.id}`
  const geral = treinamento.tipo === 'ensaio_geral'
  // Ensaio geral em grupos: mostra o horário e o local do grupo da pessoa.
  const grupo = grupoDaPessoa(treinamento, [uid])
  const horario = grupo?.horario ?? sessao.horario
  const local = grupo?.local || treinamento.local

  return (
    <Card className="border-2 border-primary">
      <CardContent className="space-y-3">
        <Link to={url} className="block space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {geral
              ? dependenteDe
                ? `Ensaio geral de ${nome ?? 'dependente'}`
                : 'Ensaio geral'
              : dependenteDe
                ? `Próximo treinamento de ${nome ?? 'dependente'}`
                : 'Seu próximo treinamento'}
          </p>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {formatRelativeDia(sessao.data, todayKey)} · {formatHoraCompacta(horario)}
              {!grupo && treinamento.horarioFim && ` até ${formatHoraCompacta(treinamento.horarioFim)}`}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-gray-700">
              {geral ? <Drama className="h-4 w-4 shrink-0 text-primary" /> : <GraduationCap className="h-4 w-4 shrink-0 text-primary" />}
              <span className="truncate">{treinamento.titulo}</span>
            </p>
            {local && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-700">
                <MapPin className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">{local}</span>
              </p>
            )}
            {grupo?.nome && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-700">
                <Users className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">Grupo: {grupo.nome}</span>
              </p>
            )}
            {treinamento.roupa && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-700">
                <Shirt className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">{treinamento.roupa}</span>
              </p>
            )}
            {treinamento.levar && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-700">
                <Backpack className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">{treinamento.levar}</span>
              </p>
            )}
          </div>
        </Link>

        <div className="border-t border-gray-100 pt-3">
          <RespostaPresenca
            ensaio={sessao}
            uid={uid}
            checkinLimiteHoras={settings.checkinLimiteHoras ?? 2}
            paraQuem={dependenteDe ? nome : undefined}
            tipo="treinamento"
          />
        </div>

        <Link
          to={url}
          className="flex items-center justify-center gap-1 rounded-full bg-primary/10 py-2 text-sm font-medium text-primary hover:bg-primary/15"
        >
          {geral ? 'Ver ensaio geral' : 'Ver treinamento'}
          <ChevronRight className="h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  )
}
