import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Bell,
  Expand,
  Minimize,
  List,
  Maximize2,
  BellRing,
  Clapperboard,
  Crown,
  Download,
  EllipsisVertical,
  HandHelping,
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
import { Button } from '@/components/ui/button'
import { AnimacaoInstalacao, type PlataformaAnimacao } from '@/components/apresentacao/AnimacaoInstalacao'
import { PASSO_POR_QUADRO } from '@/components/apresentacao/quadrosInstalacao'

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
      else if (e.key === 'f' || e.key === 'F') alternarTelaCheia()
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
          admin={topico?.admin}
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
        <Controles layout="lista" onAlternar={alternarLayout} />
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
      else if (e.key === 'f' || e.key === 'F') alternarTelaCheia()
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
        <Controles layout="lista" onAlternar={alternarLayout} />
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
function TopicoAtual({ numero, titulo, admin, onAlternar }: { numero?: number; titulo?: string; admin?: boolean; onAlternar: () => void }) {
  const total = TOTAL_TOPICOS()
  return (
    <div className="space-y-3 rounded-3xl bg-neutral-900/60 px-6 py-5 text-white shadow-xl backdrop-blur-md">
      {numero ? (
        <>
          <p className="text-sm font-medium uppercase tracking-widest text-white/60">
            {numero} de {total}
          </p>
          <p className="text-3xl font-bold leading-tight">{titulo}</p>
          {admin && <SeloAdmin claro grande />}
          <div className="flex gap-1 pt-1" aria-hidden>
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={cn('h-1.5 flex-1 rounded-full', i < numero ? 'bg-[#fff]' : 'bg-white/20')} />
            ))}
          </div>
        </>
      ) : (
        <p className="text-lg font-semibold">Pronto pra começar · →</p>
      )}
      <Controles layout="enxuto" onAlternar={onAlternar} />
    </div>
  )
}

/**
 * Tela cheia do navegador (some barra de abas/endereço) — tecla F ou o botão. Precisa de um clique ou
 * tecla do apresentador (o navegador não deixa entrar sozinho).
 */
function alternarTelaCheia() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  else document.documentElement.requestFullscreen().catch(() => {})
}

function useTelaCheia(): boolean {
  const [cheia, setCheia] = useState(() => !!document.fullscreenElement)
  useEffect(() => {
    const atualizar = () => setCheia(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', atualizar)
    return () => document.removeEventListener('fullscreenchange', atualizar)
  }, [])
  return cheia
}

/** Botões discretos do apresentador: alternar layout (L) e tela cheia (F). */
function Controles({ layout, onAlternar }: { layout: LayoutApresentacao; onAlternar: () => void }) {
  const cheia = useTelaCheia()
  const IconeTela = cheia ? Minimize : Expand
  return (
    <div className={cn('flex flex-wrap gap-1', layout === 'lista' && 'mt-6')}>
      <BotaoLayout layout={layout} onAlternar={onAlternar} />
      <button
        type="button"
        onClick={alternarTelaCheia}
        title="Tela cheia (tecla F)"
        className={cn(
          'flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] text-white/50 hover:bg-white/10 hover:text-white',
          layout === 'lista' && 'bg-neutral-900/60 px-3 py-1.5 text-xs text-white/80 backdrop-blur-md',
        )}
      >
        <IconeTela className="h-3.5 w-3.5" />
        {cheia ? 'Sair da tela cheia (F)' : 'Tela cheia (F)'}
      </button>
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
        layout === 'lista' && 'bg-neutral-900/60 px-3 py-1.5 text-xs text-white/80 backdrop-blur-md',
      )}
    >
      <Icone className="h-3.5 w-3.5" />
      {layout === 'enxuto' ? 'Ver lista (L)' : 'Só o tópico atual (L)'}
    </button>
  )
}

/** Escudo "Admin": o tópico mostra algo que o público (não admin) não vê no próprio app. */
function SeloAdmin({ claro = false, grande = false }: { claro?: boolean; grande?: boolean }) {
  return (
    <span
      title="Só o admin vê isso no app"
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full font-semibold uppercase tracking-wide',
        grande ? 'px-2.5 py-1 text-xs' : 'px-1.5 py-0.5 text-[10px]',
        claro ? 'bg-white/15 text-white' : 'bg-primary/10 text-primary',
      )}
    >
      <ShieldCheck className={grande ? 'h-3.5 w-3.5' : 'h-3 w-3'} />
      Admin
    </span>
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
          <span className="flex items-center gap-1.5 font-semibold leading-7">
            {topico.titulo}
            {topico.admin && <SeloAdmin claro={!ativo} />}
          </span>
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
                  {f.assistente && <HandHelping className="h-4 w-4 text-primary" />}
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
  // "Ver no iPhone" / "Ver no Android": a animação ampliada, quase da altura da tela.
  const [ampliado, setAmpliado] = useState<number | null>(null)
  const plataformaAmpliada = ampliado !== null ? INSTALACAO_APRESENTACAO[ampliado] : undefined

  return (
    <Slide
      titulo={plataformaAmpliada ? `Instale no ${plataformaAmpliada.plataforma}` : 'Instale o app no celular'}
      subtitulo="Ele abre direto da tela de início, em tela cheia, e recebe as notificações dos ensaios."
      rodape="Já instalou? Entre com a mesma conta Google de antes."
      onFechar={onFechar}
    >
      {plataformaAmpliada && ampliado !== null ? (
        <PlataformaAmpliada plataforma={plataformaAmpliada} animacao={ANIMACOES[ampliado]} onVoltar={() => setAmpliado(null)} />
      ) : (
        <div className="mt-5 grid grid-cols-[1fr_1fr_auto] gap-6">
          {INSTALACAO_APRESENTACAO.map((p, idx) => (
            <PlataformaInstalacao key={p.plataforma} plataforma={p} animacao={ANIMACOES[idx]} onAmpliar={() => setAmpliado(idx)} />
          ))}
          <section className="flex flex-col items-center justify-center gap-3">
            <div className="rounded-3xl bg-[#fff] p-3 shadow-lg">
              <QRCodeSVG value={APP_URL_APRESENTACAO} size={140} level="M" />
            </div>
            <p className="text-sm font-semibold">{APP_URL_APRESENTACAO.replace('https://', '')}</p>
          </section>
        </div>
      )}
    </Slide>
  )
}

/** Na ordem de `INSTALACAO_APRESENTACAO`. */
const ANIMACOES: PlataformaAnimacao[] = ['iphone', 'android']

type PlataformaDados = (typeof INSTALACAO_APRESENTACAO)[number]

/** Uma plataforma no slide: o celular animado + a lista de passos, com o passo atual destacado. */
function PlataformaInstalacao({
  plataforma: p,
  animacao,
  onAmpliar,
}: {
  plataforma: PlataformaDados
  animacao: PlataformaAnimacao
  onAmpliar: () => void
}) {
  const [passoAtual, setPassoAtual] = useState(0)
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <TituloSecao icon={Smartphone}>
          {p.plataforma} · {p.navegador}
        </TituloSecao>
        <Button size="sm" className="gap-1.5" onClick={onAmpliar}>
          <Maximize2 className="h-3.5 w-3.5" />
          Ver no {p.plataforma}
        </Button>
      </div>
      <div className="flex items-start gap-4">
        <button type="button" onClick={onAmpliar} title={`Ver no ${p.plataforma}`} className="rounded-[26px]">
          <AnimacaoInstalacao plataforma={animacao} onPasso={setPassoAtual} />
        </button>
        <ListaPassos passos={p.passos} atual={passoAtual} />
      </div>
      <p className="text-sm text-muted-foreground">{p.notificacoes}</p>
    </section>
  )
}

/**
 * Uma plataforma em tamanho grande, no ritmo do apresentador: cada clique (ou → / PageDown do
 * passador) mostra o próximo toque no celular, e os passos vão aparecendo na lista ao lado. No
 * último quadro, o → segue pro próximo tópico normalmente.
 */
function PlataformaAmpliada({ plataforma: p, animacao, onVoltar }: { plataforma: PlataformaDados; animacao: PlataformaAnimacao; onVoltar: () => void }) {
  const passos = PASSO_POR_QUADRO[animacao]
  const [quadro, setQuadro] = useState(0)
  const ultimo = passos.length - 1
  const passoAtual = passos[quadro]

  useEffect(() => {
    // Captura antes dos atalhos da apresentação (que trocariam de tópico) — só enquanto há quadro
    // pra avançar/voltar.
    function onKey(e: KeyboardEvent) {
      const avancar = e.key === 'ArrowRight' || e.key === 'PageDown'
      const voltar = e.key === 'ArrowLeft' || e.key === 'PageUp'
      if (avancar && quadro < ultimo) setQuadro(q => q + 1)
      else if (voltar && quadro > 0) setQuadro(q => q - 1)
      else return
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [quadro, ultimo])

  return (
    <div className="mt-5 grid grid-cols-[auto_1fr] items-center gap-10">
      <button
        type="button"
        onClick={() => setQuadro(q => (q < ultimo ? q + 1 : 0))}
        title="Clique pra avançar"
        className="rounded-[40px]"
      >
        <AnimacaoInstalacao plataforma={animacao} quadro={quadro} escala={1.8} />
      </button>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <TituloSecao icon={Smartphone}>
            {p.plataforma} · {p.navegador}
          </TituloSecao>
          <span className="text-sm text-muted-foreground">
            {quadro < ultimo ? 'Clique no celular ou → pra avançar' : 'Pronto! Clique pra recomeçar'}
          </span>
        </div>
        <ListaPassos passos={p.passos} atual={passoAtual} grande revelarAte={passoAtual} />
        <p className="text-base text-muted-foreground">{p.notificacoes}</p>
        <Button variant="outline" className="gap-1.5" onClick={onVoltar}>
          <ArrowLeft className="h-4 w-4" />
          Voltar pros dois
        </Button>
      </div>
    </div>
  )
}

function ListaPassos({
  passos,
  atual,
  grande = false,
  revelarAte,
}: {
  passos: PassoInstalacao[]
  atual: number
  grande?: boolean
  /** Passos depois desse ficam escondidos (vão aparecendo conforme o apresentador avança). */
  revelarAte?: number
}) {
  return (
    <ol className={cn('min-w-0 flex-1', grande ? 'space-y-2.5' : 'space-y-1.5')}>
      {passos.map((passo, i) => {
        const Icone = passo.icone ? ICONE_PASSO[passo.icone] : undefined
        const ativo = i === atual
        return (
          <li
            key={i}
            className={cn(
              CARTAO,
              'flex items-center transition-colors duration-300',
              grande ? 'gap-4 px-5 py-3.5' : 'gap-2.5 px-3 py-2',
              ativo && 'border-primary bg-primary/10 dark:border-primary',
              revelarAte !== undefined && i > revelarAte && 'invisible',
              revelarAte !== undefined && i === revelarAte && 'animate-[entrar_400ms_ease-out]',
            )}
          >
            <span
              className={cn(
                'flex shrink-0 items-center justify-center rounded-full font-semibold',
                grande ? 'h-9 w-9 text-base' : 'h-6 w-6 text-xs',
                ativo ? 'bg-primary text-white' : 'bg-primary/15 text-primary',
              )}
            >
              {i + 1}
            </span>
            <span className={cn('flex flex-wrap items-center leading-snug', grande ? 'gap-x-1.5 text-xl' : 'gap-x-1 text-sm')}>
              {passo.texto}
              {Icone && <Icone className={cn('shrink-0 text-primary', grande ? 'h-5 w-5' : 'h-3.5 w-3.5')} />}
              {passo.destaque && <strong>{passo.destaque}</strong>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
