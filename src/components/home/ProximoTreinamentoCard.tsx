import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Backpack, ChevronDown, ChevronRight, ChevronUp, Drama, GraduationCap, MapPin, Shirt, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useUsersMap } from '@/components/oracao/OrandoAgora'
import { RespostaPresenca } from '@/components/ensaio/RespostaPresenca'
import { AvatarStatus, RespostasDaCasa } from '@/components/ensaio/RespostasDaCasa'
import type { PessoaDaCasa } from '@/components/home/ProximoEnsaioCard'
import { subscribeToMeusVinculos } from '@/services/firebase/conjuges'
import { useEhElenco, useProximosTreinamentos, type SessaoDoTreinamento } from '@/hooks/useTreinamentos'
import { grupoDaPessoa } from '@/services/firebase/treinamentos'
import { uidsAusentes } from '@/services/firebase/ensaios'
import { useSettingsStore } from '@/stores/settingsStore'
import { formatRelativeDia, toDateKey } from '@/lib/agenda'
import { formatHoraCompacta } from '@/lib/cenaHorario'

/** "Ana", "Ana e Beto", "Ana, Beto e Caio". */
function juntarNomes(nomes: string[]): string {
  return nomes.length > 1 ? `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}` : (nomes[0] ?? '')
}

/**
 * Cards na Home com o próximo treinamento / ensaio geral da pessoa e de cada filho, com a resposta
 * de presença ali mesmo. Quando a pessoa e os filhos (ou vários filhos) estão na mesma sessão, é um
 * card só: "Vou" / "Não vou" por pessoa e um "Todos vão". Treinamento tem prioridade: o ensaio que
 * cai no mesmo dia some do card de próximo ensaio (ver ProximoEnsaioCard). Sem treinamento, não
 * renderiza nada.
 */
export function ProximoTreinamentoCard({ uid, dependentes }: { uid: string; dependentes: PessoaDaCasa[] }) {
  // Aberto/fechado escolhido pela pessoa; sem escolha, só abre faltando até 2 dias.
  const [abertos, setAbertos] = useState<Record<string, boolean>>({})
  const [porPessoa, setPorPessoa] = useState<Record<string, SessaoDoTreinamento | null>>({})
  const { settings } = useSettingsStore()
  const todayKey = toDateKey(new Date())
  const checkinLimiteHoras = settings.checkinLimiteHoras ?? 2

  const reportar = useCallback((quem: string, proximo: SessaoDoTreinamento | null) => {
    setPorPessoa(prev => ({ ...prev, [quem]: proximo }))
  }, [])

  const pessoas = useMemo<PessoaDaCasa[]>(() => [{ uid }, ...dependentes], [uid, dependentes])

  // Cônjuge (vínculo aceito): aparece nas sessões em que ele também está, só pra ver — sem resposta.
  const [conjugeUid, setConjugeUid] = useState<string | undefined>()
  useEffect(
    () => subscribeToMeusVinculos(uid, lista => setConjugeUid(lista.find(v => v.status === 'aceito')?.uids.find(u => u !== uid))),
    [uid],
  )
  const users = useUsersMap()
  const conjugeNome = conjugeUid ? users[conjugeUid]?.apelido || users[conjugeUid]?.displayName?.split(' ')[0] || 'Cônjuge' : undefined

  // Junta por sessão: cada uma com as pessoas da casa pra quem ela vale (o próximo de cada um).
  const sessoes = useMemo(() => {
    const porSessao = new Map<string, SessaoDoTreinamento & { pessoas: PessoaDaCasa[] }>()
    for (const p of pessoas) {
      const proximo = porPessoa[p.uid]
      if (!proximo) continue
      const atual = porSessao.get(proximo.sessao.id)
      if (atual) atual.pessoas.push(p)
      else porSessao.set(proximo.sessao.id, { ...proximo, pessoas: [p] })
    }
    // O cônjuge só entra numa sessão que já tem alguém da casa.
    const doConjuge = conjugeUid ? porPessoa[conjugeUid] : undefined
    const comConjuge = doConjuge && porSessao.get(doConjuge.sessao.id)
    const conjugeNaSessao = comConjuge ? doConjuge.sessao.id : undefined
    return [...porSessao.values()].map(x => ({ ...x, conjuge: x.sessao.id === conjugeNaSessao })).sort(
      (a, b) => a.sessao.data.localeCompare(b.sessao.data) || a.sessao.horario.localeCompare(b.sessao.horario),
    )
  }, [pessoas, porPessoa, conjugeUid])

  return (
    <>
      {pessoas.map(p => (
        <ColetarTreinamento key={p.uid} uid={p.uid} dependenteDe={p.uid === uid ? undefined : uid} onChange={reportar} />
      ))}
      {conjugeUid && <ColetarTreinamento uid={conjugeUid} onChange={reportar} />}
      {sessoes.map(({ sessao, treinamento, pessoas: quem, conjuge }) => {
        const url = `/treinamentos/${treinamento.id}`
        const geral = treinamento.tipo === 'ensaio_geral'
        const soEu = quem.length === 1 && quem[0].uid === uid
        const semMim = quem.every(p => p.uid !== uid)
        const nomes = juntarNomes(quem.map(p => p.nome ?? 'você'))
        // Ensaio geral em grupos: o horário e o local do grupo de cada pessoa.
        const grupos = quem.map(p => ({ pessoa: p, grupo: grupoDaPessoa(treinamento, [p.uid]) }))
        const meuGrupo = soEu ? grupos[0].grupo : undefined
        const efetivos = grupos.map(g => ({ pessoa: g.pessoa, horario: g.grupo?.horario ?? sessao.horario }))
        const horariosDistintos = [...new Set(efetivos.map(e => e.horario))]
        const horarioUnico = horariosDistintos.length === 1 ? horariosDistintos[0] : undefined
        const horario = meuGrupo?.horario ?? horarioUnico ?? sessao.horario
        const local = meuGrupo?.local || treinamento.local
        const rotulo = geral ? 'Ensaio geral' : 'Treinamento'
        const titulo = soEu
          ? geral
            ? 'Ensaio geral'
            : 'Seu próximo treinamento'
          : semMim
            ? `${geral ? 'Ensaio geral' : 'Próximo treinamento'} de ${nomes}`
            : geral
              ? 'Ensaio geral'
              : 'Próximo treinamento'
        const diasAte = Math.round((new Date(`${sessao.data}T00:00:00`).getTime() - new Date(`${todayKey}T00:00:00`).getTime()) / 86_400_000)
        const aberto = abertos[sessao.id] ?? diasAte <= 2
        const ausentesDaSessao = uidsAusentes(sessao)
        const faltaResponder = quem.some(p => !sessao.presencas?.includes(p.uid) && !ausentesDaSessao.includes(p.uid))
        const alternar = () => setAbertos(prev => ({ ...prev, [sessao.id]: !aberto }))

        if (!aberto) {
          return (
            <Card key={sessao.id} className="border-2 border-primary">
              <button type="button" onClick={alternar} aria-expanded={false} className="flex w-full items-center gap-2 text-left">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">{titulo}</p>
                  <p className="truncate text-sm text-gray-700">
                    <span className="font-bold text-gray-900">
                      {formatRelativeDia(sessao.data, todayKey)} · {formatHoraCompacta(horario)}
                    </span>
                    {' · '}
                    {treinamento.titulo}
                  </p>
                  <p className="mt-1 text-xs text-amber-700">
                    {faltaResponder
                      ? 'Toque para confirmar presença. Fica aberto sozinho 2 dias antes.'
                      : 'Presença respondida. Toque para ver. Fica aberto sozinho 2 dias antes.'}
                  </p>
                </div>
                <ChevronDown className="h-5 w-5 shrink-0 text-gray-400" />
              </button>
            </Card>
          )
        }

        return (
          <Card key={sessao.id} className="relative border-2 border-primary">
            <button
              type="button"
              onClick={alternar}
              aria-expanded
              aria-label="Recolher"
              className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
            >
              <ChevronUp className="h-5 w-5" />
            </button>
            <CardContent className="space-y-3">
              <Link to={url} className="block space-y-3">
                <p className="pr-6 text-xs font-semibold uppercase tracking-wide text-primary">{titulo}</p>
                <div>
                  {horarioUnico || soEu ? (
                  <p className="text-2xl font-bold text-gray-900">
                    {formatRelativeDia(sessao.data, todayKey)} · {formatHoraCompacta(horario)}
                    {!meuGrupo && !grupos.some(g => g.grupo) && treinamento.horarioFim && ` até ${formatHoraCompacta(treinamento.horarioFim)}`}
                  </p>
                  ) : (
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{formatRelativeDia(sessao.data, todayKey)}</p>
                      {efetivos.map(e => (
                        <p key={e.pessoa.uid} className="text-lg font-bold text-gray-900">
                          <span className="font-medium text-gray-700">{e.pessoa.nome ?? 'Você'}</span> · {formatHoraCompacta(e.horario)}
                        </p>
                      ))}
                      <p className="text-xs text-muted-foreground">Horário geral: {formatHoraCompacta(sessao.horario)}</p>
                    </div>
                  )}
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
                  {meuGrupo?.nome && (
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-700">
                      <Users className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate">Grupo: {meuGrupo.nome}</span>
                    </p>
                  )}
                  {!soEu &&
                    grupos
                      .filter(g => g.grupo)
                      .map(({ pessoa, grupo }) => (
                        <p key={pessoa.uid} className="mt-1 text-xs text-gray-700">
                          <span className="font-medium">{pessoa.nome ?? 'Você'}:</span>
                          {horarioUnico ? ` ${formatHoraCompacta(grupo!.horario)}` : ''}
                          {(grupo!.local || treinamento.local) && `${horarioUnico ? ' · ' : ' '}${grupo!.local || treinamento.local}`}
                          {grupo!.nome && ` · Grupo ${grupo!.nome}`}
                        </p>
                      ))}
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

              {soEu ? (
                <div className="border-t border-gray-100 pt-3">
                  <RespostaPresenca ensaio={sessao} uid={uid} checkinLimiteHoras={checkinLimiteHoras} tipo="treinamento" />
                  {conjuge && conjugeUid && (
                    <div className="mt-3 border-t border-gray-100 pt-3">
                      <AvatarStatus sessao={sessao} uid={conjugeUid} nome={conjugeNome!} />
                    </div>
                  )}
                </div>
              ) : (
                <RespostasDaCasa
                  sessao={sessao}
                  pessoas={quem}
                  checkinLimiteHoras={checkinLimiteHoras}
                  tipo="treinamento"
                  conjuge={conjuge && conjugeUid ? { uid: conjugeUid, nome: conjugeNome! } : undefined}
                />
              )}

              <Link
                to={url}
                className="flex items-center justify-center gap-1 rounded-full bg-primary/10 py-2 text-sm font-medium text-primary hover:bg-primary/15"
              >
                Ver {rotulo.toLowerCase()}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        )
      })}
    </>
  )
}

/** Sem tela: acompanha o próximo treinamento de uma pessoa da casa e avisa o card, que junta os de todo mundo. */
function ColetarTreinamento({
  uid,
  dependenteDe,
  onChange,
}: {
  uid: string
  dependenteDe?: string
  onChange: (uid: string, proximo: SessaoDoTreinamento | null) => void
}) {
  const ehElenco = useEhElenco(uid, dependenteDe)
  const proximo = useProximosTreinamentos(uid, ehElenco)[0] ?? null
  useEffect(() => onChange(uid, proximo), [onChange, uid, proximo])
  useEffect(() => () => onChange(uid, null), [onChange, uid])
  return null
}
