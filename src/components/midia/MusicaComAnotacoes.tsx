import { useEffect, useRef, useState } from 'react'
import { CloudCheck, Globe, MessageSquarePlus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { criarAnotacao, editarAnotacao, excluirAnotacao, formatTempo, parseTempo } from '@/services/firebase/anotacoesMusica'
import { guardarMusica, musicaGuardada } from '@/lib/midiaCache'
import { cn } from '@/lib/utils'
import type { AnotacaoMusica, Cena, Musica } from '@/types'

interface Props {
  musica: Musica
  /** Já filtradas pra essa música. */
  anotacoes: AnotacaoMusica[]
  /** Onde se anota (cena e, na tela do ensaio, o ensaio). Sem isso, só leitura. */
  contexto?: { cena: Cena; ensaioId?: string; ensaioData?: string }
  uid?: string
  podeAnotar: boolean
  /** Editar/excluir (líder, assistentes da cena e admin). */
  podeGerenciar: (a: AnotacaoMusica) => boolean
  podeMarcarGlobal: boolean
  /** Fora da cena (página de músicas): mostra de qual cena é cada anotação. */
  mostrarCena?: boolean
}

interface Rascunho {
  id?: string
  tempo: string
  texto: string
  global: boolean
}

/**
 * Player de uma música com anotações por momento ("1:55 — entra o personagem X"). "Anotar" pega o
 * ponto em que o player está; tocar no horário de uma anotação pula a música pra lá.
 */
export function MusicaComAnotacoes({ musica, anotacoes, contexto, uid, podeAnotar, podeGerenciar, podeMarcarGlobal, mostrarCena }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [tempoAtual, setTempoAtual] = useState(0)
  const [rascunho, setRascunho] = useState<Rascunho | null>(null)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const ordenadas = [...anotacoes].sort((a, b) => a.tempoSeg - b.tempoSeg)

  // Já baixada antes: toca do aparelho. Só troca a fonte se o player ainda não começou.
  const [src, setSrc] = useState(musica.url)
  useEffect(() => {
    let vivo = true
    let local: string | null = null
    setSrc(musica.url)
    musicaGuardada(musica.url).then(blobUrl => {
      if (!blobUrl) return
      const audio = audioRef.current
      if (!vivo || (audio && (!audio.paused || audio.currentTime > 0))) return URL.revokeObjectURL(blobUrl)
      local = blobUrl
      setSrc(blobUrl)
    })
    return () => {
      vivo = false
      if (local) URL.revokeObjectURL(local)
    }
  }, [musica.url])
  const noAparelho = src !== musica.url

  function irPara(seg: number) {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = seg
    audio.play().catch(() => {})
  }

  function novaAnotacao() {
    const agora = audioRef.current?.currentTime ?? 0
    audioRef.current?.pause()
    setErro('')
    setRascunho({ tempo: formatTempo(agora), texto: '', global: false })
  }

  function editar(a: AnotacaoMusica) {
    setErro('')
    setRascunho({ id: a.id, tempo: formatTempo(a.tempoSeg), texto: a.texto, global: a.global })
  }

  async function salvar() {
    if (!rascunho || !uid) return
    const tempoSeg = parseTempo(rascunho.tempo)
    if (tempoSeg === null) return setErro('Momento inválido. Use minutos:segundos, ex.: 1:55.')
    if (!rascunho.texto.trim()) return setErro('Escreva a anotação.')
    setSalvando(true)
    setErro('')
    try {
      if (rascunho.id) {
        await editarAnotacao(rascunho.id, { tempoSeg, texto: rascunho.texto, global: rascunho.global }, uid)
      } else if (contexto) {
        await criarAnotacao(
          {
            musicaId: musica.id,
            cenaId: contexto.cena.id,
            cenaNome: contexto.cena.nome,
            ensaioId: contexto.ensaioId,
            ensaioData: contexto.ensaioData,
            tempoSeg,
            texto: rascunho.texto,
            global: rascunho.global,
          },
          uid,
        )
      }
      setRascunho(null)
    } catch {
      setErro('Não foi possível salvar. Tente de novo.')
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(id: string) {
    try {
      await excluirAnotacao(id)
    } catch {
      setErro('Não foi possível excluir. Tente de novo.')
    } finally {
      setExcluindoId(null)
    }
  }

  return (
    <div className="space-y-1.5">
      <audio
        ref={audioRef}
        controls
        src={src}
        className="h-9 w-full"
        onTimeUpdate={e => setTempoAtual(e.currentTarget.currentTime)}
        onPlay={() => {
          if (!noAparelho) guardarMusica(musica.url)
        }}
      />
      {noAparelho && (
        <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <CloudCheck className="h-3 w-3" />
          Salva no aparelho
        </p>
      )}

      {ordenadas.length > 0 && (
        <div className="space-y-1">
          {ordenadas.map(a =>
            rascunho?.id === a.id ? null : (
              <div key={a.id} className="flex items-start gap-2 rounded-lg bg-gray-50 px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => irPara(a.tempoSeg)}
                  title="Tocar a partir daqui"
                  className="mt-0.5 shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-primary hover:bg-primary/20"
                >
                  {formatTempo(a.tempoSeg)}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap text-sm text-gray-800">{a.texto}</p>
                  {(a.global || a.ensaioData || (mostrarCena && a.cenaNome)) && (
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                      {a.global && (
                        <span className="flex items-center gap-0.5">
                          <Globe className="h-3 w-3" />
                          Global
                        </span>
                      )}
                      {mostrarCena && a.cenaNome && <span>{a.cenaNome}</span>}
                      {a.ensaioData && (
                        <span>Ensaio {new Date(`${a.ensaioData}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                      )}
                    </p>
                  )}
                </div>
                {podeGerenciar(a) &&
                  (excluindoId === a.id ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button variant="destructive" size="sm" className="h-7 px-2 text-xs" onClick={() => excluir(a.id)}>
                        Excluir
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setExcluindoId(null)}>
                        Não
                      </Button>
                    </div>
                  ) : (
                    <div className="flex shrink-0 items-center">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => editar(a)} title="Editar">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => setExcluindoId(a.id)} title="Excluir">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
              </div>
            ),
          )}
        </div>
      )}

      {rascunho ? (
        <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-2">
          <div className="flex items-center gap-2">
            <Input
              value={rascunho.tempo}
              onChange={e => setRascunho({ ...rascunho, tempo: e.target.value })}
              className="h-9 w-20 text-center font-mono tabular-nums"
              aria-label="Momento da música (minutos:segundos)"
              inputMode="numeric"
            />
            <button
              type="button"
              onClick={() => setRascunho({ ...rascunho, tempo: formatTempo(audioRef.current?.currentTime ?? 0) })}
              className="text-xs font-medium text-primary hover:underline"
            >
              Usar o momento do player ({formatTempo(tempoAtual)})
            </button>
          </div>
          <Textarea
            value={rascunho.texto}
            onChange={e => setRascunho({ ...rascunho, texto: e.target.value })}
            placeholder="Ex.: entra o personagem X"
            maxLength={500}
            autoFocus
          />
          {podeMarcarGlobal && (
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={rascunho.global}
                onChange={e => setRascunho({ ...rascunho, global: e.target.checked })}
                className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
              Global — aparece também na página de músicas e na sonoplastia
            </label>
          )}
          {erro && <p className="text-xs text-red-600">{erro}</p>}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setRascunho(null)} disabled={salvando}>
              Cancelar
            </Button>
            <Button size="sm" className="flex-1" onClick={salvar} disabled={salvando}>
              {salvando && <Spinner size="sm" className="border-white/40 border-t-white" />}
              Salvar
            </Button>
          </div>
        </div>
      ) : (
        <>
          {erro && <p className="text-xs text-red-600">{erro}</p>}
          {podeAnotar && contexto && (
            <button
              type="button"
              onClick={novaAnotacao}
              className={cn('flex items-center gap-1.5 text-xs font-medium text-primary hover:underline')}
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
              Anotar em {formatTempo(tempoAtual)}
            </button>
          )}
        </>
      )}
    </div>
  )
}
