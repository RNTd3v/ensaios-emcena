import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Bug, CheckCircle2, ChevronDown, RotateCcw, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/Spinner'
import { marcarReporte, subscribeToReportes } from '@/services/firebase/reportes'
import { cn } from '@/lib/utils'
import type { Reporte } from '@/types'

type Aba = 'aberto' | 'resolvido'

function quando(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/** Resumo do aparelho a partir do user agent (só pra leitura rápida; o completo fica embaixo). */
function aparelhoCurto(ua: string): string {
  const so = /iphone|ipad/i.test(ua) ? 'iPhone/iPad' : /android/i.test(ua) ? 'Android' : /mac os/i.test(ua) ? 'Mac' : /windows/i.test(ua) ? 'Windows' : 'Outro'
  const nav = /crios/i.test(ua) ? 'Chrome' : /fxios|firefox/i.test(ua) ? 'Firefox' : /edg/i.test(ua) ? 'Edge' : /chrome/i.test(ua) ? 'Chrome' : /safari/i.test(ua) ? 'Safari' : ''
  return [so, nav].filter(Boolean).join(' · ')
}

/** Problemas reportados pelo app (menu → Reportar problema), com o diagnóstico de cada aparelho. */
export function AdminReportes() {
  const [params] = useSearchParams()
  const destaque = params.get('id')
  const [reportes, setReportes] = useState<Reporte[] | null>(null)
  const [aba, setAba] = useState<Aba>('aberto')
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set(destaque ? [destaque] : []))

  useEffect(() => subscribeToReportes(setReportes), [])

  // Veio da notificação de um relato já resolvido: abre na aba certa.
  useEffect(() => {
    const r = reportes?.find(x => x.id === destaque)
    if (r) setAba(r.status)
  }, [reportes, destaque])

  const lista = useMemo(() => (reportes ?? []).filter(r => r.status === aba), [reportes, aba])
  const contagem = (s: Aba) => (reportes ?? []).filter(r => r.status === s).length

  function alternar(id: string) {
    setAbertos(prev => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/admin">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-semibold text-white">Problemas reportados</h1>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/10 p-1">
        {(['aberto', 'resolvido'] as Aba[]).map(a => (
          <button
            key={a}
            type="button"
            onClick={() => setAba(a)}
            className={cn('rounded-lg py-2 text-sm font-medium', aba === a ? 'bg-white text-gray-900' : 'text-white/80')}
          >
            {a === 'aberto' ? 'Abertos' : 'Resolvidos'} ({contagem(a)})
          </button>
        ))}
      </div>

      {!reportes ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : lista.length === 0 ? (
        <p className="py-6 text-center text-sm text-white/80">{aba === 'aberto' ? 'Nenhum problema em aberto.' : 'Nada resolvido ainda.'}</p>
      ) : (
        <div className="space-y-2">
          {lista.map(r => {
            const aberto = abertos.has(r.id)
            return (
              <Card key={r.id} className={cn('p-0', r.id === destaque && 'ring-2 ring-amber-400')}>
                <button type="button" onClick={() => alternar(r.id)} className="flex w-full items-start gap-3 p-4 text-left" aria-expanded={aberto}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Bug className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">
                      {r.nome} <span className="font-normal text-muted-foreground">· {quando(r.createdAt)}</span>
                    </p>
                    <p className={cn('text-sm text-gray-700', !aberto && 'line-clamp-2')}>{r.texto}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                      <span className="font-mono">{r.id.slice(0, 6).toUpperCase()}</span>
                      <span className="flex items-center gap-0.5">
                        <Smartphone className="h-3 w-3" />
                        {aparelhoCurto(r.aparelho.userAgent)}
                        {r.aparelho.instalado ? ' · instalado' : ''}
                      </span>
                      <span className="truncate">{r.tela}</span>
                    </p>
                  </div>
                  <ChevronDown className={cn('mt-1 h-4 w-4 shrink-0 text-gray-400 transition-transform', aberto && 'rotate-180')} />
                </button>

                {aberto && (
                  <div className="space-y-3 border-t border-gray-100 px-4 pb-4 pt-3">
                    {r.printUrl && (
                      <a href={r.printUrl} target="_blank" rel="noreferrer" className="block">
                        <img src={r.printUrl} alt="Print enviado" className="max-h-72 w-full rounded-lg border border-gray-200 object-contain" />
                      </a>
                    )}
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                      <dt className="text-muted-foreground">Tela</dt>
                      <dd className="break-all">{r.tela}</dd>
                      <dt className="text-muted-foreground">Versão</dt>
                      <dd>{r.aparelho.versao}</dd>
                      <dt className="text-muted-foreground">Instalado</dt>
                      <dd>{r.aparelho.instalado ? 'Sim' : 'Não (navegador)'}</dd>
                      <dt className="text-muted-foreground">Internet</dt>
                      <dd>{r.aparelho.online ? 'Online' : 'Offline'}</dd>
                      <dt className="text-muted-foreground">Tela</dt>
                      <dd>{r.aparelho.tela}</dd>
                      <dt className="text-muted-foreground">Navegador</dt>
                      <dd className="break-all">{r.aparelho.userAgent}</dd>
                    </dl>
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Últimas mensagens do app ({r.registros.length})</p>
                      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-gray-50 p-2 font-mono text-[10px] text-gray-700">
                        {r.registros.length ? r.registros.join('\n') : 'Nenhuma.'}
                      </pre>
                    </div>
                    <Button
                      variant={r.status === 'aberto' ? 'default' : 'outline'}
                      className="w-full gap-1.5"
                      onClick={() => marcarReporte(r.id, r.status === 'aberto' ? 'resolvido' : 'aberto')}
                    >
                      {r.status === 'aberto' ? <CheckCircle2 className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                      {r.status === 'aberto' ? 'Marcar como resolvido' : 'Reabrir'}
                    </Button>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
