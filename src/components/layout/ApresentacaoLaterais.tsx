import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  List,
  Maximize2,
  BellRing,
  Clapperboard,
  Crown,
  Download,
  EllipsisVertical,
  ListChecks,
  Megaphone,
  Share,
  ShieldCheck,
  Smartphone,
  SquarePlus,
  UsersRound,
  X,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import {
  APP_URL_APRESENTACAO,
  AUTOMATICAS_APRESENTACAO,
  AVISOS_APRESENTACAO,
  FUNCOES_APRESENTACAO,
  INSTALACAO_APRESENTACAO,
  NUMERO_PRIMEIRO_TOPICO_APP,
  PEDIDOS_CONCLUSAO,
  TOPICO_LOGIN,
  TOPICOS_APRESENTACAO,
  TOTAL_TOPICOS,
  lerLayoutApresentacao,
  sairModoApresentacao,
  salvarLayoutApresentacao,
  type LayoutApresentacao,
  type AcaoApresentacao,
  type FuncaoApresentacao,
  type PassoInstalacao,
  type TopicoApresentacao,
} from '@/lib/apresentacao'
import { cn } from '@/lib/utils'

/**
 * Tópicos da apresentação nas duas laterais do iPhone. Clicar navega o app; as setas do teclado
 * (e PageUp/PageDown, que é o que os passadores de slide mandam) vão pro tópico anterior/seguinte.
 */
export function useApresentacaoLaterais(ativo: boolean, onSair: () => void, onAcao: (acao: AcaoApresentacao) => void) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [clicado, setClicado] = useState<number | null>(null)
  const [slideFechado, setSlideFechado] = useState(false)
  const [layout, alternarLayout] = useLayoutApresentacao()

  // O tópico clicado continua o atual mesmo navegando por dentro dele (ex.: abrir uma cena);
  // antes do primeiro clique, vale o tópico da rota aberta.
  const atual = clicado ?? TOPICOS_APRESENTACAO.findIndex(t => t.rota === pathname)

  function ir(i: number) {
    const topico = TOPICOS_APRESENTACAO[i]
    if (!topico) return
    setClicado(i)
    setSlideFechado(false)
    navigate(topico.rota)
    if (topico.acao) onAcao(topico.acao)
  }

  const slide = ativo && !slideFechado ? TOPICOS_APRESENTACAO[atual]?.slide : undefined

  useEffect(() => {
    if (!ativo) return
    function onKey(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null
      if (alvo?.closest('input, textarea, select, [contenteditable="true"]')) return
      if (e.key === 'Escape' && slide) {
        setSlideFechado(true)
        e.preventDefault()
        return
      }
      if (e.key === 'l' || e.key === 'L') alternarLayout()
      else if (e.key === 'ArrowRight' || e.key === 'PageDown') ir(Math.min(atual + 1, TOPICOS_APRESENTACAO.length - 1))
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') ir(Math.max(atual - 1, 0))
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!ativo) return undefined

  const sobreposicao =
    slide === 'instalacao' ? (
      <SlideInstalacao onFechar={() => setSlideFechado(true)} />
    ) : slide === 'permissoes' ? (
      <SlidePermissoes onFechar={() => setSlideFechado(true)} />
    ) : slide === 'notificacoes' ? (
      <SlideNotificacoes onFechar={() => setSlideFechado(true)} />
    ) : slide === 'conclusao' ? (
      <SlideConclusao onFechar={() => setSlideFechado(true)} />
    ) : undefined

  if (layout === 'enxuto') {
    const topico = TOPICOS_APRESENTACAO[atual]
    return {
      sobreposicao,
      esquerda: (
        <TopicoAtual
          numero={topico ? atual + NUMERO_PRIMEIRO_TOPICO_APP : undefined}
          titulo={topico?.titulo}
          onAlternar={alternarLayout}
        />
      ),
      direita: null,
    }
  }

  const meio = Math.ceil(TOPICOS_APRESENTACAO.length / 2)
  const coluna = (inicio: number, fim: number) => (
    <ol className="space-y-2">
      {TOPICOS_APRESENTACAO.slice(inicio, fim).map((t, k) => (
        <TopicoItem
          key={t.rota + t.titulo}
          topico={t}
          numero={inicio + k + NUMERO_PRIMEIRO_TOPICO_APP}
          ativo={inicio + k === atual}
          onClick={() => ir(inicio + k)}
        />
      ))}
    </ol>
  )

  return {
    sobreposicao,
    esquerda: coluna(0, meio),
    direita: (
      <>
        {coluna(meio, TOPICOS_APRESENTACAO.length)}
        <BotaoLayout layout="lista" onAlternar={alternarLayout} />
        <button
          type="button"
          onClick={() => {
            sairModoApresentacao()
            onSair()
          }}
          className="mt-6 flex items-center gap-1.5 rounded-lg bg-neutral-900/60 px-3 py-1.5 text-xs text-white/80 backdrop-blur-md hover:bg-neutral-900/80 hover:text-white"
        >
          <X className="h-3.5 w-3.5" /> Sair do modo apresentação
        </button>
      </>
    ),
  }
}

/**
 * Na tela de login: só o tópico 1 (instalar o app), que abre o slide de instalação. → / PageDown
 * também abrem; Esc fecha. Os demais tópicos aparecem depois de entrar.
 */
export function useApresentacaoLogin(ativo: boolean, onSair: () => void) {
  const [slideAberto, setSlideAberto] = useState(false)
  const [layout, alternarLayout] = useLayoutApresentacao()

  useEffect(() => {
    if (!ativo) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'l' || e.key === 'L') alternarLayout()
      else if (e.key === 'Escape' && slideAberto) setSlideAberto(false)
      else if (e.key === 'ArrowRight' || e.key === 'PageDown') setSlideAberto(true)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ativo, slideAberto, alternarLayout])

  if (!ativo) return undefined
  const sobreposicao = slideAberto ? <SlideInstalacao onFechar={() => setSlideAberto(false)} /> : undefined
  if (layout === 'enxuto') {
    return { sobreposicao, esquerda: <TopicoAtual numero={1} titulo={TOPICO_LOGIN.titulo} onAlternar={alternarLayout} />, direita: null }
  }
  return {
    sobreposicao,
    esquerda: (
      <ol className="space-y-2">
        <TopicoItem topico={TOPICO_LOGIN} numero={1} ativo onClick={() => setSlideAberto(true)} />
      </ol>
    ),
    direita: (
      <div className="space-y-6">
        <p className="rounded-2xl bg-neutral-900/60 px-4 py-3 text-sm text-white/80 shadow-lg backdrop-blur-md">
          Os próximos tópicos aparecem depois de entrar com o Google.
        </p>
        <BotaoLayout layout="lista" onAlternar={alternarLayout} />
        <button
          type="button"
          onClick={() => {
            sairModoApresentacao()
            onSair()
          }}
          className="flex items-center gap-1.5 rounded-lg bg-neutral-900/60 px-3 py-1.5 text-xs text-white/80 backdrop-blur-md hover:bg-neutral-900/80 hover:text-white"
        >
          <X className="h-3.5 w-3.5" /> Sair do modo apresentação
        </button>
      </div>
    ),
  }
}

/** Layout dos tópicos (enxuto/lista), guardado na aba; a tecla L alterna. */
function useLayoutApresentacao(): [LayoutApresentacao, () => void] {
  const [layout, setLayout] = useState<LayoutApresentacao>(lerLayoutApresentacao)
  const alternar = useCallback(() => {
    setLayout(l => {
      const novo = l === 'enxuto' ? 'lista' : 'enxuto'
      salvarLayoutApresentacao(novo)
      return novo
    })
  }, [])
  return [layout, alternar]
}

/**
 * Layout enxuto (pro público): só o tópico atual, grande, com "5 de 15" e a barra de progresso.
 * Sem descrição — as notas do apresentador ficam no layout de lista.
 */
function TopicoAtual({ numero, titulo, onAlternar }: { numero?: number; titulo?: string; onAlternar: () => void }) {
  const total = TOTAL_TOPICOS()
  return (
    <div className="space-y-3 rounded-3xl bg-neutral-900/60 px-6 py-5 text-white shadow-xl backdrop-blur-md">
      {numero ? (
        <>
          <p className="text-sm font-medium uppercase tracking-widest text-white/60">
            {numero} de {total}
          </p>
          <p className="text-3xl font-bold leading-tight">{titulo}</p>
          <div className="flex gap-1 pt-1" aria-hidden>
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={cn('h-1.5 flex-1 rounded-full', i < numero ? 'bg-[#fff]' : 'bg-white/20')} />
            ))}
          </div>
        </>
      ) : (
        <p className="text-lg font-semibold">Pronto pra começar · →</p>
      )}
      <BotaoLayout layout="enxuto" onAlternar={onAlternar} />
    </div>
  )
}

/** Alterna entre o layout enxuto e a lista (mesma coisa que a tecla L). */
function BotaoLayout({ layout, onAlternar }: { layout: LayoutApresentacao; onAlternar: () => void }) {
  const Icone = layout === 'enxuto' ? List : Maximize2
  return (
    <button
      type="button"
      onClick={onAlternar}
      title="Alternar layout (tecla L)"
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] text-white/50 hover:bg-white/10 hover:text-white',
        layout === 'lista' && 'mt-6 bg-neutral-900/60 px-3 py-1.5 text-xs text-white/80 backdrop-blur-md',
      )}
    >
      <Icone className="h-3.5 w-3.5" />
      {layout === 'enxuto' ? 'Ver lista (L)' : 'Só o tópico atual (L)'}
    </button>
  )
}

function TopicoItem({ topico, numero, ativo, onClick }: { topico: TopicoApresentacao; numero: number; ativo: boolean; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left transition-colors',
          ativo ? 'bg-[#fff] text-neutral-900 shadow-xl ring-2 ring-primary' : 'bg-neutral-900/60 text-white shadow-lg backdrop-blur-md hover:bg-neutral-900/80',
        )}
      >
        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
            ativo ? 'bg-primary text-white' : 'bg-white/20 text-white',
          )}
        >
          {numero}
        </span>
        <span className="min-w-0">
          <span className="block font-semibold leading-7">{topico.titulo}</span>
          {topico.descricao && (
            <span className={cn('block text-sm leading-snug', ativo ? 'text-neutral-600' : 'text-white/70')}>{topico.descricao}</span>
          )}
        </span>
      </button>
    </li>
  )
}

const GRUPOS: { grupo: FuncaoApresentacao['grupo']; titulo: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { grupo: 'geral', titulo: 'No app', icon: ShieldCheck },
  { grupo: 'cena', titulo: 'Nas cenas', icon: Clapperboard },
  { grupo: 'equipe', titulo: 'Nas equipes', icon: UsersRound },
]

/** Moldura dos slides, por cima do iPhone. Fecha no X, clicando fora ou com Esc. */
function Slide({ titulo, subtitulo, rodape, onFechar, children }: { titulo: string; subtitulo: string; rodape: string; onFechar: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 hidden items-center justify-center bg-black/40 p-8 backdrop-blur-sm lg:flex" onClick={onFechar}>
      <div
        className="relative max-h-full w-full max-w-6xl overflow-y-auto rounded-3xl bg-background p-8 text-foreground shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <button type="button" onClick={onFechar} className="absolute right-5 top-5 rounded-full p-2 text-muted-foreground hover:bg-muted" title="Fechar (Esc)">
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-3xl font-bold">{titulo}</h2>
        <p className="mt-1 text-muted-foreground">{subtitulo}</p>
        {children}
        <p className="mt-6 text-sm text-muted-foreground">{rodape}</p>
      </div>
    </div>
  )
}

function TituloSecao({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
      <Icon className="h-4 w-4" /> {children}
    </h3>
  )
}

const CARTAO = 'rounded-2xl border border-black/10 bg-muted/40 p-4 dark:border-white/10'

function SlidePermissoes({ onFechar }: { onFechar: () => void }) {
  return (
    <Slide
      titulo="Quem pode fazer o quê"
      subtitulo="Cada cena e cada equipe têm um líder e quantos assistentes precisar."
      rodape="Relógio de oração e Metas e gastos também têm líder e assistentes próprios, que cuidam dessas telas."
      onFechar={onFechar}
    >
      <div className="mt-6 grid grid-cols-3 gap-6">
        {GRUPOS.map(({ grupo, titulo, icon }) => (
          <section key={grupo} className="space-y-3">
            <TituloSecao icon={icon}>{titulo}</TituloSecao>
            {FUNCOES_APRESENTACAO.filter(f => f.grupo === grupo).map(f => (
              <div key={f.funcao} className={CARTAO}>
                <p className="flex items-center gap-2 text-lg font-semibold">
                  {f.lider && <Crown className="h-4 w-4 text-amber-500" />}
                  {f.funcao}
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] leading-snug">
                  {f.pode.map(p => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ))}
      </div>
    </Slide>
  )
}

function SlideNotificacoes({ onFechar }: { onFechar: () => void }) {
  return (
    <Slide
      titulo="Quem notifica quem"
      subtitulo="Avisos são escritos por alguém; as automáticas o app manda sozinho quando algo acontece."
      rodape="Ninguém recebe notificação da própria ação. Aviso pra um dependente vai pros responsáveis dele."
      onFechar={onFechar}
    >
      <div className="mt-6 grid grid-cols-[2fr_3fr] gap-8">
        <section className="space-y-3">
          <TituloSecao icon={Megaphone}>Avisos manuais</TituloSecao>
          {AVISOS_APRESENTACAO.map(a => (
            <div key={a.quem} className={CARTAO}>
              <p className="flex items-center gap-2 text-lg font-semibold">
                {a.lider && <Crown className="h-4 w-4 text-amber-500" />}
                {a.quem}
              </p>
              <p className="mt-1 text-[15px] leading-snug">{a.paraQuem}</p>
            </div>
          ))}
        </section>
        <section className="space-y-3">
          <TituloSecao icon={BellRing}>Automáticas</TituloSecao>
          <div className={cn(CARTAO, 'p-0')}>
            <table className="w-full text-left text-[15px] leading-snug">
              <thead className="text-sm text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Quando</th>
                  <th className="px-4 py-3 font-medium">Quem recebe</th>
                  <th className="px-4 py-3 font-medium">Quem dispara</th>
                </tr>
              </thead>
              <tbody>
                {AUTOMATICAS_APRESENTACAO.map(n => (
                  <tr key={n.quando} className="border-t border-black/10 dark:border-white/10">
                    <td className="px-4 py-2.5 font-medium">{n.quando}</td>
                    <td className="px-4 py-2.5">{n.recebe}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{n.dispara}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Slide>
  )
}

/** Fechamento: o que fazer hoje + QR do app, e espaço pras perguntas. */
function SlideConclusao({ onFechar }: { onFechar: () => void }) {
  return (
    <Slide
      titulo="Perguntas?"
      subtitulo="Enquanto isso, já dá pra fazer tudo pelo celular."
      rodape="Achou algo estranho depois? Menu → Reportar problema."
      onFechar={onFechar}
    >
      <div className="mt-6 grid grid-cols-[3fr_2fr] items-center gap-10">
        <section className="space-y-3">
          <TituloSecao icon={ListChecks}>O que fazer hoje</TituloSecao>
          <ol className="space-y-3">
            {PEDIDOS_CONCLUSAO.map((p, i) => (
              <li key={p} className={cn(CARTAO, 'flex items-center gap-4 py-3')}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-base font-semibold text-white">
                  {i + 1}
                </span>
                <span className="text-lg font-medium leading-snug">{p}</span>
              </li>
            ))}
          </ol>
          <p className="pt-1 text-base font-semibold text-primary">A partir de agora, os ensaios são confirmados por aqui.</p>
        </section>
        <section className="flex flex-col items-center gap-3">
          <div className="rounded-3xl bg-white p-5 shadow-lg">
            <QRCodeSVG value={APP_URL_APRESENTACAO} size={240} level="M" />
          </div>
          <p className="text-lg font-semibold">{APP_URL_APRESENTACAO.replace('https://', '')}</p>
        </section>
      </div>
    </Slide>
  )
}

const ICONE_PASSO: Record<NonNullable<PassoInstalacao['icone']>, React.ComponentType<{ className?: string }>> = {
  compartilhar: Share,
  adicionar: SquarePlus,
  menu: EllipsisVertical,
  baixar: Download,
  sino: Bell,
}

/** Como instalar no iPhone e no Android (e ativar as notificações), com o QR do app. */
function SlideInstalacao({ onFechar }: { onFechar: () => void }) {
  return (
    <Slide
      titulo="Instale o app no celular"
      subtitulo="Ele abre direto da tela de início, em tela cheia, e recebe as notificações dos ensaios."
      rodape="Já instalou? Entre com a mesma conta Google de antes."
      onFechar={onFechar}
    >
      <div className="mt-6 grid grid-cols-[1fr_1fr_auto] gap-6">
        {INSTALACAO_APRESENTACAO.map(p => (
          <section key={p.plataforma} className="space-y-3">
            <TituloSecao icon={Smartphone}>
              {p.plataforma} · {p.navegador}
            </TituloSecao>
            <ol className="space-y-2">
              {p.passos.map((passo, i) => {
                const Icone = passo.icone ? ICONE_PASSO[passo.icone] : undefined
                return (
                  <li key={i} className={cn(CARTAO, 'flex items-center gap-3 py-2.5')}>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                      {i + 1}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-1.5 text-[15px] leading-snug">
                      {passo.texto}
                      {Icone && <Icone className="h-4 w-4 shrink-0 text-primary" />}
                      {passo.destaque && <strong>{passo.destaque}</strong>}
                    </span>
                  </li>
                )
              })}
            </ol>
            <p className="text-sm text-muted-foreground">{p.notificacoes}</p>
          </section>
        ))}
        <section className="flex flex-col items-center justify-center gap-3">
          <div className="rounded-3xl bg-white p-4 shadow-lg">
            <QRCodeSVG value={APP_URL_APRESENTACAO} size={180} level="M" />
          </div>
          <p className="text-base font-semibold">{APP_URL_APRESENTACAO.replace('https://', '')}</p>
        </section>
      </div>
    </Slide>
  )
}
