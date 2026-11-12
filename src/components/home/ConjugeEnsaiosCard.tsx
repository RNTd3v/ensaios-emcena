import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Heart } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useUsersMap } from '@/components/oracao/OrandoAgora'
import { useEnsaiosDasMinhasCenas } from '@/hooks/useEnsaiosDasMinhasCenas'
import { subscribeToMeusVinculos } from '@/services/firebase/conjuges'
import { addDays, formatRelativeDia, toDateKey } from '@/lib/agenda'
import { formatHoraCompacta } from '@/lib/cenaHorario'
import { grupoDoEnsaio, uidsDoEnsaio } from '@/lib/ensaioPublico'

/**
 * Ensaios do cônjuge (vínculo aceito) nos próximos 7 dias — só pra organização: sem resposta de
 * presença, sem aviso. Não renderiza nada sem vínculo ou sem ensaio no período.
 */
export function ConjugeEnsaiosCard({ uid }: { uid: string }) {
  const [conjugeUid, setConjugeUid] = useState<string | undefined>()
  useEffect(
    () => subscribeToMeusVinculos(uid, lista => setConjugeUid(lista.find(v => v.status === 'aceito')?.uids.find(u => u !== uid))),
    [uid],
  )
  if (!conjugeUid) return null
  return <Lista conjugeUid={conjugeUid} />
}

function Lista({ conjugeUid }: { conjugeUid: string }) {
  const users = useUsersMap()
  const { minhasCenas, ensaiosPorCena } = useEnsaiosDasMinhasCenas(conjugeUid, undefined, true)
  const todayKey = toDateKey(new Date())
  const ateKey = toDateKey(addDays(new Date(`${todayKey}T00:00:00`), 7))

  const itens = useMemo(
    () =>
      minhasCenas
        .flatMap(cena =>
          (ensaiosPorCena[cena.id] ?? [])
            .filter(e => !e.canceledByUid && !e.finalizadoAt && e.data >= todayKey && e.data <= ateKey && uidsDoEnsaio(cena.personagens, e).has(conjugeUid))
            .map(ensaio => ({ ensaio, cena })),
        )
        .sort((a, b) => a.ensaio.data.localeCompare(b.ensaio.data) || a.ensaio.horario.localeCompare(b.ensaio.horario)),
    [minhasCenas, ensaiosPorCena, todayKey, ateKey, conjugeUid],
  )
  if (!itens.length) return null

  const u = users[conjugeUid]
  const nome = u?.apelido || u?.displayName?.split(' ')[0] || 'Cônjuge'

  return (
    <Card>
      <CardContent className="space-y-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Heart className="h-4 w-4 text-primary" />
          Ensaios de {nome} nesta semana
        </p>
        <div className="divide-y divide-gray-100">
          {itens.map(({ ensaio, cena }) => {
            const grupo = grupoDoEnsaio(ensaio, cena.personagens, [conjugeUid])
            const horario = grupo?.horario ?? ensaio.horario
            const local = grupo?.local || ensaio.local
            return (
              <Link key={ensaio.id} to={`/cenas/${cena.id}/ensaios/${ensaio.id}`} className="flex items-center gap-3 py-2">
                <div className="w-11 shrink-0 text-sm font-semibold text-primary">{formatHoraCompacta(horario)}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{cena.nome}</p>
                  <p className="truncate text-xs text-gray-500">
                    {formatRelativeDia(ensaio.data, todayKey)}
                    {grupo ? ` · Grupo${grupo.nome ? `: ${grupo.nome}` : ''}` : ''}
                    {local ? ` · ${local}` : ''}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
