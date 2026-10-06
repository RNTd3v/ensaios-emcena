import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Download, Eye, FileText, Pause, Play, Settings2, SkipBack, SkipForward, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/Spinner'
import { removerRoteiroCena, salvarRoteiroCena, subscribeToRoteiroCena } from '@/services/firebase/roteiroCena'
import { urlDoArquivo } from '@/services/firebase/storage'
import { useAuthStore } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { falaDe, lerRoteiro, recortarTexto, type BlocoRoteiro } from '@/lib/roteiroCena'
import { ROTEIRO_TIPOS } from '@/lib/roteiro'
import { cn } from '@/lib/utils'
import type { Cena, RoteiroCena, RoteiroTipo } from '@/types'

/**
 * Roteiro da cena: PDF só com as páginas dela (pra baixar) e o texto lido em voz alta
 * (SpeechSynthesis, voz do próprio aparelho), com modo "ensaiar minhas falas" — o app lê as falas
 * dos outros e para na vez da pessoa. O admin gera o recorte a partir dos PDFs de Configurações.
 */
export function RoteiroCenaCard({ cena, meusPersonagens, isAdmin }: { cena: Cena; meusPersonagens: string[]; isAdmin: boolean }) {
  const [roteiro, setRoteiro] = useState<RoteiroCena | null | undefined>(undefined)
  const [aberto, setAberto] = useState(false)
  const [configurando, setConfigurando] = useState(false)

  useEffect(() => subscribeToRoteiroCena(cena.id, setRoteiro), [cena.id])

  if (roteiro === undefined || (!roteiro && !isAdmin)) return null

  return (
    <Card>
      <CardContent>
        <div className={cn('flex items-center gap-2', aberto && roteiro && 'pb-2.5 border-b border-gray-100')}>
          <button
            type="button"
            onClick={() => setAberto(v => !v)}
            disabled={!roteiro}
            className="flex flex-1 items-center gap-1.5 text-left text-base font-semibold"
          >
            {roteiro ? (
              <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', !aberto && '-rotate-90')} />
            ) : (
              <FileText className="h-4 w-4 text-gray-400" />
            )}
            Roteiro da cena
          </button>
          {roteiro && (
            <span className="text-xs text-muted-foreground">
              {roteiro.paginaInicio === roteiro.paginaFim ? `p. ${roteiro.paginaInicio}` : `p. ${roteiro.paginaInicio}–${roteiro.paginaFim}`}
            </span>
          )}
          {isAdmin && (
            <Button variant="ghost" size="icon" title="Configurar roteiro da cena" onClick={() => setConfigurando(true)}>
              <Settings2 className="h-4 w-4 text-gray-500" />
            </Button>
          )}
        </div>

        {!roteiro && (
          <p className="pt-1 text-xs text-muted-foreground">Escolha as páginas do roteiro que são dessa cena pra gerar o PDF e o áudio.</p>
        )}

        {roteiro && aberto && (
          <div className="space-y-3 pt-3">
            <a
              href={roteiro.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-full bg-primary/10 py-2 text-sm font-medium text-primary hover:bg-primary/15"
            >
              <Download className="h-4 w-4" />
              Baixar PDF da cena
            </a>
            {roteiro.blocos.some(b => b.tipo === 'fala') ? (
              <LeitorRoteiro blocos={roteiro.blocos} meusPersonagens={meusPersonagens} />
            ) : (
              <p className="text-xs text-muted-foreground">Não deu pra ler o texto desse PDF (talvez seja escaneado) — só o download está disponível.</p>
            )}
          </div>
        )}
      </CardContent>

      {configurando && <RoteiroCenaDialog cena={cena} roteiro={roteiro} onClose={() => setConfigurando(false)} />}
    </Card>
  )
}

// ---------- Leitura em voz alta ----------

interface Trecho {
  bloco: number
  texto: string
  tipo: 'nome' | 'fala' | 'direcao'
  personagem?: string
  minha: boolean
}

/** "NOEMI E BOAZ" → "Noemi e Boaz" (lido com entonação de nome, não soletrado). */
function nomeLegivel(t: string): string {
  return t.toLocaleLowerCase('pt-BR').replace(/(^|\s)(\p{L})/gu, (_, sp: string, l: string) => sp + l.toLocaleUpperCase('pt-BR')).replace(/ E /g, ' e ')
}

/** Uma frase por trecho: falas longas inteiras passam do limite de algumas vozes (Chrome corta ~15s). */
function frases(t: string): string[] {
  return t.split(/(?<=[.!?…])\s+/).map(f => f.trim()).filter(Boolean)
}

function montarTrechos(blocos: BlocoRoteiro[], opcoes: { lerNomes: boolean; lerDirecoes: boolean; meus: string[] }): Trecho[] {
  const trechos: Trecho[] = []
  blocos.forEach((b, i) => {
    if (b.tipo === 'direcao') {
      if (opcoes.lerDirecoes) trechos.push({ bloco: i, texto: b.texto.replace(/^[[(]|[\])]$/g, ''), tipo: 'direcao', minha: false })
      return
    }
    const minha = falaDe(b.personagem, opcoes.meus)
    if (opcoes.lerNomes) trechos.push({ bloco: i, texto: nomeLegivel(b.personagem), tipo: 'nome', personagem: b.personagem, minha })
    // Linhas seguidas da fala viram um texto só (no PDF a frase quebra no meio), dividido por frase.
    let corrido: string[] = []
    const soltar = () => {
      for (const f of frases(corrido.join(' '))) trechos.push({ bloco: i, texto: f, tipo: 'fala', personagem: b.personagem, minha })
      corrido = []
    }
    for (const l of b.linhas) {
      if (!l.rubrica) {
        corrido.push(l.texto)
        continue
      }
      soltar()
      if (opcoes.lerDirecoes) trechos.push({ bloco: i, texto: l.texto.replace(/^\(|\)$/g, ''), tipo: 'direcao', minha: false })
    }
    soltar()
  })
  return trechos
}

function hash(t: string): number {
  let h = 0
  for (const c of t) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}

const TONS = [1, 0.85, 1.15, 0.92, 1.08, 0.78, 1.22]

/** Vozes em português do aparelho (pt-BR primeiro) — a lista chega depois, via `voiceschanged`. */
function useVozesPt(): SpeechSynthesisVoice[] {
  const [vozes, setVozes] = useState<SpeechSynthesisVoice[]>([])
  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const carregar = () =>
      setVozes(
        speechSynthesis
          .getVoices()
          .filter(v => v.lang.toLowerCase().startsWith('pt'))
          .sort((a, b) => Number(b.lang.toLowerCase() === 'pt-br') - Number(a.lang.toLowerCase() === 'pt-br')),
      )
    carregar()
    speechSynthesis.addEventListener('voiceschanged', carregar)
    return () => speechSynthesis.removeEventListener('voiceschanged', carregar)
  }, [])
  return vozes
}

const VELOCIDADES = [0.8, 1, 1.25, 1.5]

function LeitorRoteiro({ blocos, meusPersonagens }: { blocos: BlocoRoteiro[]; meusPersonagens: string[] }) {
  const suportado = typeof window !== 'undefined' && 'speechSynthesis' in window
  const vozes = useVozesPt()
  const temMinhas = useMemo(() => blocos.some(b => b.tipo === 'fala' && falaDe(b.personagem, meusPersonagens)), [blocos, meusPersonagens])

  const [modo, setModo] = useState<'ouvir' | 'ensaiar'>('ouvir')
  const [velocidade, setVelocidade] = useState(1)
  const [lerNomes, setLerNomes] = useState(true)
  const [lerDirecoes, setLerDirecoes] = useState(false)
  const [esconderMinhas, setEsconderMinhas] = useState(false)
  const [verTexto, setVerTexto] = useState(false)

  const trechos = useMemo(() => montarTrechos(blocos, { lerNomes, lerDirecoes, meus: meusPersonagens }), [blocos, lerNomes, lerDirecoes, meusPersonagens])
  const [atual, setAtual] = useState(-1)
  const [tocando, setTocando] = useState(false)
  /** Modo ensaiar: índice do trecho em que parou esperando a fala da pessoa. */
  const [aguardando, setAguardando] = useState<number | null>(null)
  const [revelado, setRevelado] = useState(false)

  // As opções podem mudar com a leitura em andamento: o encadeamento (onend) lê sempre as atuais.
  const opcoes = useRef({ trechos, modo, velocidade, vozes })
  useEffect(() => {
    opcoes.current = { trechos, modo, velocidade, vozes }
  })
  const geracao = useRef(0)

  useEffect(() => () => {
    geracao.current++
    if (suportado) speechSynthesis.cancel()
  }, [suportado])

  /** Trocar o que é lido (nomes/direções) muda os trechos: para e volta pro começo. */
  function mudarLeitura(mudar: () => void) {
    geracao.current++
    if (suportado) speechSynthesis.cancel()
    setTocando(false)
    setAguardando(null)
    setAtual(-1)
    mudar()
  }

  function falar(i: number, g: number) {
    if (g !== geracao.current) return
    const { trechos: lista, modo: m, velocidade: vel, vozes: vs } = opcoes.current
    if (i >= lista.length) {
      setTocando(false)
      setAtual(-1)
      return
    }
    const t = lista[i]
    setAtual(i)
    if (m === 'ensaiar' && t.minha && t.tipo === 'fala') {
      setTocando(false)
      setRevelado(false)
      setAguardando(i)
      return
    }
    const u = new SpeechSynthesisUtterance(t.texto)
    u.lang = 'pt-BR'
    u.rate = vel
    if (t.tipo === 'fala' && t.personagem) {
      const h = hash(t.personagem)
      if (vs.length) u.voice = vs[h % vs.length]
      u.pitch = TONS[h % TONS.length]
    } else {
      // Narrador (nomes e direções): voz padrão, um pouco mais rápido.
      if (vs.length) u.voice = vs[0]
      u.rate = vel * 1.1
    }
    u.onend = () => falar(i + 1, g)
    u.onerror = e => {
      if (e.error !== 'interrupted' && e.error !== 'canceled') falar(i + 1, g)
    }
    speechSynthesis.speak(u)
  }

  function tocarDe(i: number) {
    speechSynthesis.cancel()
    const g = ++geracao.current
    setAguardando(null)
    setTocando(true)
    falar(Math.max(0, i), g)
  }

  function pausar() {
    geracao.current++
    speechSynthesis.cancel()
    setTocando(false)
  }

  /** Primeiro trecho de outro bloco (pra frente ou pra trás). */
  function inicioDoBloco(direcao: 1 | -1): number {
    const base = atual < 0 ? 0 : atual
    const blocoAtual = trechos[base]?.bloco ?? 0
    if (direcao === 1) {
      const j = trechos.findIndex(t => t.bloco > blocoAtual)
      return j < 0 ? base : j
    }
    // Pra trás: início do bloco anterior (ou do atual, se já estava no meio dele).
    const inicioAtual = trechos.findIndex(t => t.bloco === blocoAtual)
    const alvoBloco = base > inicioAtual ? blocoAtual : trechos[Math.max(0, inicioAtual - 1)]?.bloco ?? 0
    return Math.max(0, trechos.findIndex(t => t.bloco === alvoBloco))
  }

  function continuarDepoisDaMinha() {
    if (aguardando === null) return
    const bloco = trechos[aguardando].bloco
    const j = trechos.findIndex(t => t.bloco > bloco)
    if (j < 0) {
      setAguardando(null)
      setAtual(-1)
      return
    }
    tocarDe(j)
  }

  function tocarBloco(bloco: number) {
    const j = trechos.findIndex(t => t.bloco === bloco)
    if (j >= 0 && suportado) tocarDe(j)
  }

  const blocoAtual = atual >= 0 ? trechos[atual]?.bloco : undefined
  const refsBloco = useRef<Record<number, HTMLDivElement | null>>({})
  useEffect(() => {
    if (blocoAtual !== undefined && verTexto) refsBloco.current[blocoAtual]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [blocoAtual, verTexto])

  const chip = (ativo: boolean) =>
    cn(
      'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
      ativo ? 'border-primary bg-primary/10 text-primary' : 'border-gray-300 bg-white text-gray-600',
    )

  const falaAguardada = aguardando !== null ? blocos[trechos[aguardando].bloco] : undefined

  return (
    <div className="space-y-3">
      {suportado ? (
        <div className="space-y-3 rounded-xl bg-gray-50 p-3">
          <div className="flex items-center justify-center gap-3">
            <Button variant="ghost" size="icon" title="Fala anterior" onClick={() => tocarDe(inicioDoBloco(-1))}>
              <SkipBack className="h-5 w-5" />
            </Button>
            <Button
              size="icon"
              className="h-12 w-12 rounded-full"
              title={tocando ? 'Pausar' : 'Ouvir'}
              onClick={() => (tocando ? pausar() : tocarDe(atual < 0 ? 0 : atual))}
            >
              {tocando ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </Button>
            <Button variant="ghost" size="icon" title="Próxima fala" onClick={() => tocarDe(inicioDoBloco(1))}>
              <SkipForward className="h-5 w-5" />
            </Button>
          </div>

          {aguardando !== null && falaAguardada?.tipo === 'fala' && (
            <div className="space-y-2 rounded-lg border border-primary/40 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Sua vez · {nomeLegivel(falaAguardada.personagem)}</p>
              {esconderMinhas && !revelado ? (
                <button type="button" onClick={() => setRevelado(true)} className="flex items-center gap-1.5 text-sm text-gray-500 underline-offset-2 hover:underline">
                  <Eye className="h-4 w-4" />
                  Mostrar o texto
                </button>
              ) : (
                <div className="space-y-0.5 text-sm text-gray-800">
                  {falaAguardada.linhas.map((l, k) => (
                    <p key={k} className={cn(l.rubrica && 'text-xs italic text-gray-500')}>
                      {l.texto}
                    </p>
                  ))}
                </div>
              )}
              <Button size="sm" className="w-full gap-1.5" onClick={continuarDepoisDaMinha}>
                <Play className="h-4 w-4" />
                Continuar
              </Button>
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-1.5">
            <button type="button" onClick={() => setModo('ouvir')} className={chip(modo === 'ouvir')}>
              Ouvir tudo
            </button>
            {temMinhas && (
              <button type="button" onClick={() => setModo('ensaiar')} className={chip(modo === 'ensaiar')}>
                Ensaiar minhas falas
              </button>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {VELOCIDADES.map(v => (
              <button key={v} type="button" onClick={() => setVelocidade(v)} className={chip(velocidade === v)}>
                {String(v).replace('.', ',')}x
              </button>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            <button type="button" onClick={() => mudarLeitura(() => setLerNomes(v => !v))} className={chip(lerNomes)}>
              Ler quem fala
            </button>
            <button type="button" onClick={() => mudarLeitura(() => setLerDirecoes(v => !v))} className={chip(lerDirecoes)}>
              Ler direções de cena
            </button>
            {modo === 'ensaiar' && (
              <button type="button" onClick={() => setEsconderMinhas(v => !v)} className={chip(esconderMinhas)}>
                Esconder minhas falas
              </button>
            )}
          </div>
          {modo === 'ensaiar' && (
            <p className="text-center text-[11px] text-muted-foreground">O áudio para na sua fala — fale e toque em Continuar.</p>
          )}
          {vozes.length === 0 && (
            <p className="text-center text-[11px] text-muted-foreground">
              Sem voz em português no aparelho — no iPhone, baixe uma em Ajustes › Acessibilidade › Conteúdo Falado › Vozes.
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Esse navegador não lê texto em voz alta — dá pra ler o texto abaixo.</p>
      )}

      <button
        type="button"
        onClick={() => setVerTexto(v => !v)}
        className="flex w-full items-center gap-1.5 text-left text-sm font-medium text-gray-700"
      >
        <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', !verTexto && '-rotate-90')} />
        Ver texto
      </button>
      {verTexto && (
        <div className="max-h-96 space-y-2 overflow-y-auto rounded-lg border border-gray-100 p-2">
          {blocos.map((b, i) => {
            if (b.tipo === 'direcao') {
              return (
                <div key={i} ref={el => void (refsBloco.current[i] = el)} className="text-center text-xs italic text-gray-500">
                  {b.texto}
                </div>
              )
            }
            const minha = falaDe(b.personagem, meusPersonagens)
            const escondida = minha && modo === 'ensaiar' && esconderMinhas
            return (
              <div
                key={i}
                ref={el => void (refsBloco.current[i] = el)}
                onClick={() => tocarBloco(i)}
                className={cn(
                  'cursor-pointer rounded-lg px-2 py-1.5',
                  minha && 'bg-primary/10',
                  blocoAtual === i && 'ring-2 ring-primary',
                )}
              >
                <p className={cn('text-xs font-semibold', minha ? 'text-primary' : 'text-gray-900')}>
                  {b.personagem}
                  {b.modo && <span className="ml-1 font-normal text-gray-400">[{b.modo}]</span>}
                </p>
                <div className={cn('text-sm text-gray-800', escondida && 'select-none blur-sm')}>
                  {b.linhas.map((l, k) => (
                    <p key={k} className={cn(l.rubrica && 'text-xs italic text-gray-500')}>
                      {l.texto}
                    </p>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------- Configuração (admin) ----------

interface Previa {
  pdf: Uint8Array
  blocos: BlocoRoteiro[]
}

function RoteiroCenaDialog({ cena, roteiro, onClose }: { cena: Cena; roteiro: RoteiroCena | null; onClose: () => void }) {
  const user = useAuthStore(s => s.user)
  const roteiros = useSettingsStore(s => s.settings.roteiros)
  const disponiveis = ROTEIRO_TIPOS.filter(t => roteiros?.[t.tipo])
  const [tipo, setTipo] = useState<RoteiroTipo>(roteiro?.tipo ?? disponiveis[0]?.tipo ?? 'normal')
  const [inicio, setInicio] = useState(roteiro ? String(roteiro.paginaInicio) : '')
  const [fim, setFim] = useState(roteiro ? String(roteiro.paginaFim) : '')
  const [marcadorInicio, setMarcadorInicio] = useState(roteiro?.marcadorInicio ?? '')
  const [marcadorFim, setMarcadorFim] = useState(roteiro?.marcadorFim ?? '')
  const [previa, setPrevia] = useState<Previa | null>(null)
  const [trabalhando, setTrabalhando] = useState<'previa' | 'salvar' | 'remover' | null>(null)
  const [erro, setErro] = useState('')

  /** Mudou algum campo: a prévia antiga não vale mais. */
  function campo<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v)
      setPrevia(null)
    }
  }

  const paginaInicio = parseInt(inicio, 10)
  const paginaFim = parseInt(fim || inicio, 10)
  const intervaloOk = paginaInicio > 0 && paginaFim >= paginaInicio

  async function gerarPrevia() {
    const arquivo = roteiros?.[tipo]
    if (!arquivo || !intervaloOk) return
    setTrabalhando('previa')
    setErro('')
    try {
      const url = await urlDoArquivo(arquivo.path)
      const resp = await fetch(url)
      if (!resp.ok) throw new Error('Não foi possível baixar o roteiro.')
      const { recortarPdf } = await import('@/lib/roteiroPdf')
      const recorte = await recortarPdf(await resp.arrayBuffer(), paginaInicio, paginaFim)
      setPrevia({ pdf: recorte.pdf, blocos: lerRoteiro(recortarTexto(recorte.texto, marcadorInicio, marcadorFim)) })
    } catch (e) {
      // Vai pro console (e pro diagnóstico do "Reportar problema") e aparece na tela, pra saber o motivo.
      console.error('Roteiro da cena: falha ao gerar prévia', e)
      const detalhe = e instanceof Error ? e.message : String(e)
      setErro(detalhe.startsWith('O roteiro tem') ? detalhe : `Não foi possível ler o roteiro. Tente de novo. (${detalhe})`)
    } finally {
      setTrabalhando(null)
    }
  }

  async function salvar() {
    if (!previa || !user) return
    setTrabalhando('salvar')
    setErro('')
    try {
      await salvarRoteiroCena({
        cenaId: cena.id,
        tipo,
        paginaInicio,
        paginaFim,
        marcadorInicio,
        marcadorFim,
        pdf: previa.pdf,
        blocos: previa.blocos,
        byUid: user.uid,
        anterior: roteiro,
      })
      onClose()
    } catch {
      setErro('Não foi possível salvar. Tente de novo.')
      setTrabalhando(null)
    }
  }

  async function remover() {
    if (!roteiro) return
    setTrabalhando('remover')
    try {
      await removerRoteiroCena(roteiro)
      onClose()
    } catch {
      setErro('Não foi possível remover. Tente de novo.')
      setTrabalhando(null)
    }
  }

  const falas = previa?.blocos.filter(b => b.tipo === 'fala') ?? []
  const personagens = [...new Set(falas.map(f => (f.tipo === 'fala' ? f.personagem : '')))]

  return (
    <Dialog open onClose={onClose} title="Roteiro da cena">
      {disponiveis.length === 0 ? (
        <p className="text-sm text-gray-700">Nenhum PDF de roteiro cadastrado. Suba o roteiro em Configurações primeiro.</p>
      ) : (
        <div className="space-y-4">
          {disponiveis.length > 1 && (
            <div>
              <Label htmlFor="roteiro-tipo">PDF</Label>
              <Select id="roteiro-tipo" value={tipo} onChange={e => campo(setTipo)(e.target.value as RoteiroTipo)}>
                {disponiveis.map(t => (
                  <option key={t.tipo} value={t.tipo}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="roteiro-inicio">Da página</Label>
              <Input id="roteiro-inicio" type="number" inputMode="numeric" min={1} value={inicio} onChange={e => campo(setInicio)(e.target.value)} />
            </div>
            <div className="flex-1">
              <Label htmlFor="roteiro-fim">Até a página</Label>
              <Input id="roteiro-fim" type="number" inputMode="numeric" min={1} value={fim} onChange={e => campo(setFim)(e.target.value)} placeholder={inicio} />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Se a cena começa ou termina no meio da página, informe um trecho do texto (ex.: o título da cena). O PDF continua com as páginas
              inteiras; o corte vale pro áudio e pro texto.
            </p>
            <Input value={marcadorInicio} onChange={e => campo(setMarcadorInicio)(e.target.value)} placeholder="Começa em… (opcional, ex.: CENA 3)" />
            <Input value={marcadorFim} onChange={e => campo(setMarcadorFim)(e.target.value)} placeholder="Termina antes de… (opcional, ex.: CENA 4)" />
          </div>

          {previa && (
            <div className="space-y-1.5 rounded-lg bg-gray-50 p-3 text-xs text-gray-700">
              {falas.length ? (
                <>
                  <p>
                    <span className="font-semibold">{falas.length} falas</span> · {personagens.join(', ')}
                  </p>
                  <p className="text-muted-foreground">
                    Começa com: <span className="text-gray-700">{resumoBloco(previa.blocos[0])}</span>
                  </p>
                  <p className="text-muted-foreground">
                    Termina com: <span className="text-gray-700">{resumoBloco(previa.blocos.at(-1))}</span>
                  </p>
                </>
              ) : (
                <p className="text-amber-700">
                  Nenhuma fala encontrada nessas páginas. Se o PDF for escaneado, só o download vai funcionar — dá pra salvar assim mesmo.
                </p>
              )}
            </div>
          )}

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          {previa ? (
            <Button className="w-full" onClick={salvar} disabled={!!trabalhando}>
              {trabalhando === 'salvar' && <Spinner size="sm" className="border-white/40 border-t-white" />}
              Salvar na cena
            </Button>
          ) : (
            <Button className="w-full" onClick={gerarPrevia} disabled={!!trabalhando || !intervaloOk}>
              {trabalhando === 'previa' && <Spinner size="sm" className="border-white/40 border-t-white" />}
              Ver prévia
            </Button>
          )}

          {roteiro && (
            <Button variant="outline" className="w-full gap-1.5 text-red-600" onClick={remover} disabled={!!trabalhando}>
              <Trash2 className="h-4 w-4" />
              Remover roteiro da cena
            </Button>
          )}
        </div>
      )}
    </Dialog>
  )
}

function resumoBloco(b: BlocoRoteiro | undefined): string {
  if (!b) return '—'
  if (b.tipo === 'direcao') return b.texto
  return `${b.personagem}: ${b.linhas.find(l => !l.rubrica)?.texto ?? ''}`
}
