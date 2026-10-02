import { useEffect, useState, type ReactNode } from 'react'
import { Bell, Copy, Download, EllipsisVertical, Lock, Share, SquarePlus, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PlataformaAnimacao = 'iphone' | 'android'

/**
 * Um quadro da animação: a tela desenhada + onde cai o "toque" (em % da tela) + qual passo da lista
 * (índice em `INSTALACAO_APRESENTACAO[...].passos`) ele ilustra.
 */
interface Quadro {
  tela: ReactNode
  toque?: { x: number; y: number }
  passo: number
}

const DURACAO_QUADRO_MS = 2200

/**
 * Celular em miniatura repetindo o passo a passo de instalar o app (Safari no iPhone, Chrome no
 * Android) e ativar as notificações. Só HTML/CSS — sem vídeo. Cores fixas (hex), pra não mudar com o
 * tema escuro do app. Avisa o passo atual por `onPasso`, pra lista ao lado acompanhar.
 */
export function AnimacaoInstalacao({
  plataforma,
  onPasso,
  escala = 1,
  quadro: quadroControlado,
}: {
  plataforma: PlataformaAnimacao
  onPasso?: (passo: number) => void
  /** Ampliar (ex.: 1.8 no "Ver no iPhone"): é tudo vetorial/texto, então fica nítido. */
  escala?: number
  /** Quadro fixo (o apresentador avança no clique); sem isso, roda sozinha em loop. */
  quadro?: number
}) {
  const quadros = QUADROS[plataforma]
  const [auto, setAuto] = useState(0)
  const controlado = quadroControlado !== undefined

  useEffect(() => {
    if (controlado) return
    const id = setInterval(() => setAuto(n => (n + 1) % quadros.length), DURACAO_QUADRO_MS)
    return () => clearInterval(id)
  }, [quadros.length, controlado])

  const i = controlado ? Math.min(quadroControlado, quadros.length - 1) : auto
  const quadro = quadros[i]
  useEffect(() => onPasso?.(quadro.passo), [quadro.passo, onPasso])

  return (
    // Caixa com o tamanho já ampliado; dentro, o celular de 150×300 escalado a partir do canto.
    <div className="shrink-0" style={{ width: 150 * escala, height: 300 * escala }}>
    <div
      style={{ transform: `scale(${escala})`, transformOrigin: 'top left' }}
      className={cn(
        'relative h-[300px] w-[150px] shrink-0 overflow-hidden border-[6px] border-[#171717] bg-[#fff] shadow-xl',
        plataforma === 'iphone' ? 'rounded-[26px]' : 'rounded-[20px]',
      )}
    >
      {plataforma === 'iphone' ? (
        <div className="absolute left-1/2 top-1 z-20 h-3 w-12 -translate-x-1/2 rounded-full bg-[#171717]" />
      ) : (
        <div className="absolute left-1/2 top-1.5 z-20 h-2 w-2 -translate-x-1/2 rounded-full bg-[#171717]" />
      )}
      {/* key: cada quadro entra com um fade curto. */}
      <div key={i} className="absolute inset-0 animate-[aparecer_300ms_ease-out]">
        {quadro.tela}
      </div>
      {quadro.toque && (
        <span
          key={`t${i}`}
          className="pointer-events-none absolute z-30 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
          style={{ left: `${quadro.toque.x}%`, top: `${quadro.toque.y}%` }}
        >
          <span className="absolute h-full w-full animate-ping rounded-full bg-[#7b467f]/50 [animation-delay:600ms]" />
          <span className="h-3.5 w-3.5 rounded-full border-2 border-[#fff] bg-[#7b467f] opacity-0 shadow animate-[aparecer_200ms_ease-out_600ms_forwards]" />
        </span>
      )}
    </div>
    </div>
  )
}

// ---------- Peças das telas ----------

const ICONE_APP = '/apple-touch-icon.png'

/** O app aberto no navegador: miniatura da tela de login. */
function PaginaApp({ comCardInstalar = false }: { comCardInstalar?: boolean }) {
  return (
    <div className="flex h-full flex-col items-center gap-1.5 bg-gradient-to-b from-[#2b2440] to-[#5b3a63] px-2 pt-8">
      <p className="text-[7px] font-semibold tracking-[0.2em] text-[#fff]/80">MUSICAL</p>
      <p className="text-center font-serif text-[11px] font-bold leading-none text-[#fff]">VILA ESPERANÇA</p>
      {comCardInstalar ? (
        <div className="mt-3 w-full rounded-lg bg-[#fff] p-1.5 text-[7px] text-[#1c1620] shadow">
          <div className="flex items-center gap-1">
            <img src={ICONE_APP} alt="" className="h-4 w-4 rounded" />
            <span className="font-semibold">Instale o app no celular</span>
          </div>
          <div className="mt-1 flex items-center justify-center gap-1 rounded bg-[#7b467f] py-1 font-semibold text-[#fff]">
            <Download className="h-2.5 w-2.5" /> Instalar app
          </div>
        </div>
      ) : (
        <div className="mt-6 w-full rounded-full bg-[#fff] py-1 text-center text-[7px] font-semibold text-[#1c1620]">Entrar com Google</div>
      )}
    </div>
  )
}

function BarraSafari() {
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 bg-[#f5f5f7] px-2 pb-2 pt-1.5">
      <div className="flex items-center justify-center gap-1 rounded-md bg-[#e5e5ea] py-1 text-[7px] text-[#3a3a3c]">
        <Lock className="h-2 w-2" /> ensaios-emcena.web.app
      </div>
      <div className="mt-1.5 flex justify-around text-[#007aff]">
        <span className="text-[9px]">‹</span>
        <span className="text-[9px]">›</span>
        <Share className="h-3 w-3" />
        <span className="text-[9px]">⧉</span>
      </div>
    </div>
  )
}

function BarraChrome() {
  return (
    <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-1 bg-[#f1f3f4] px-1.5 pb-1 pt-4">
      <div className="flex flex-1 items-center gap-1 rounded-full bg-[#fff] px-1.5 py-0.5 text-[6.5px] text-[#3c4043]">
        <Lock className="h-2 w-2" /> ensaios-emcena.web.app
      </div>
      <EllipsisVertical className="h-3 w-3 text-[#3c4043]" />
    </div>
  )
}

/** Tela de início com alguns ícones; `novo` = o do app aparecendo. */
function TelaInicio({ android = false }: { android?: boolean }) {
  const cores = ['#34c759', '#ff9500', '#007aff', '#ff2d55', '#5856d6', '#ffcc00', '#5ac8fa']
  return (
    <div className={cn('grid h-full grid-cols-4 content-start gap-x-1.5 gap-y-2.5 px-2.5 pt-9', android ? 'bg-gradient-to-b from-[#1a2a3a] to-[#2d4a5a]' : 'bg-gradient-to-b from-[#3b2a5a] to-[#a0607a]')}>
      {/* O ícone do app entra no começo da 2ª linha — é onde cai o toque do quadro. */}
      {[...cores.slice(0, 4), 'app', ...cores.slice(4)].map(c =>
        c === 'app' ? (
          <div key={c} className="flex flex-col items-center gap-0.5 animate-[surgir_500ms_ease-out_300ms_both]">
            <img src={ICONE_APP} alt="" className={cn('h-6 w-6', android ? 'rounded-full' : 'rounded-[7px]')} />
            <span className="text-[5px] leading-none text-[#fff]">Vila Esp…</span>
          </div>
        ) : (
          <div key={c} className="flex flex-col items-center gap-0.5">
            <span className={cn('h-6 w-6', android ? 'rounded-full' : 'rounded-[7px]')} style={{ backgroundColor: c }} />
            <span className="h-0.5 w-4 rounded bg-[#fff]/40" />
          </div>
        ),
      )}
    </div>
  )
}

/** O app instalado aberto, com o pedido de permissão de notificação. */
function PermissaoNotificacao({ android = false }: { android?: boolean }) {
  return (
    <div className="relative h-full bg-gradient-to-b from-[#2b2440] to-[#5b3a63] pt-6">
      <div className="flex items-center justify-between px-2">
        <span className="h-4 w-4 rounded-full bg-[#fff]/20" />
        <Bell className="h-3.5 w-3.5 text-[#fff]" />
      </div>
      <div className="mx-2 mt-3 space-y-1.5">
        <div className="h-8 rounded-md bg-[#fff]/15" />
        <div className="h-8 rounded-md bg-[#fff]/15" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-[#000]/40 px-2">
        <div className={cn('w-full bg-[#fff] text-center text-[#1c1620] shadow-lg', android ? 'rounded-xl p-2 text-left' : 'rounded-xl pt-2')}>
          <p className="px-1 text-[7.5px] font-semibold leading-tight">“Vila Esperança” quer enviar notificações</p>
          {android ? (
            <div className="mt-2 flex justify-end gap-2 text-[7px] font-semibold text-[#1a73e8]">
              <span>Não permitir</span>
              <span>Permitir</span>
            </div>
          ) : (
            <div className="mt-2 grid grid-cols-2 border-t border-[#e5e5ea] text-[7.5px] text-[#007aff]">
              <span className="border-r border-[#e5e5ea] py-1">Não Permitir</span>
              <span className="py-1 font-semibold">Permitir</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------- iPhone (Safari) ----------

const QUADROS_IPHONE: Quadro[] = [
  {
    passo: 0,
    tela: (
      <>
        <PaginaApp />
        <BarraSafari />
      </>
    ),
  },
  {
    passo: 1,
    toque: { x: 70, y: 94 },
    tela: (
      <>
        <PaginaApp />
        <BarraSafari />
      </>
    ),
  },
  {
    passo: 2,
    toque: { x: 50, y: 78 },
    tela: (
      <>
        <PaginaApp />
        <div className="absolute inset-0 bg-[#000]/30" />
        <div className="absolute inset-x-0 bottom-0 animate-[subir_350ms_ease-out] rounded-t-xl bg-[#f2f2f7] px-2 pb-3 pt-2 text-[7.5px] text-[#1c1c1e]">
          <div className="mb-1.5 flex items-center gap-1.5">
            <img src={ICONE_APP} alt="" className="h-5 w-5 rounded-md" />
            <span className="font-semibold">Vila Esperança</span>
          </div>
          <div className="divide-y divide-[#e5e5ea] rounded-lg bg-[#fff]">
            <div className="flex items-center justify-between px-2 py-1.5">
              Copiar <Copy className="h-2.5 w-2.5" />
            </div>
            <div className="flex items-center justify-between bg-[#7b467f]/10 px-2 py-1.5 font-semibold">
              Adicionar à Tela de Início <SquarePlus className="h-2.5 w-2.5" />
            </div>
            <div className="flex items-center justify-between px-2 py-1.5">
              Favoritos <Star className="h-2.5 w-2.5" />
            </div>
          </div>
        </div>
      </>
    ),
  },
  {
    passo: 2,
    toque: { x: 84, y: 13 },
    tela: (
      <div className="h-full bg-[#f2f2f7] px-2 pt-6 text-[7.5px] text-[#1c1c1e]">
        <div className="flex items-center justify-between">
          <span className="text-[#007aff]">Cancelar</span>
          <span className="font-semibold">Adicionar</span>
          <span className="font-semibold text-[#007aff]">Adicionar</span>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#fff] p-2">
          <img src={ICONE_APP} alt="" className="h-8 w-8 rounded-lg" />
          <div>
            <p className="font-semibold">Vila Esperança</p>
            <p className="text-[6.5px] text-[#8e8e93]">ensaios-emcena.web.app</p>
          </div>
        </div>
      </div>
    ),
  },
  { passo: 3, toque: { x: 17, y: 31 }, tela: <TelaInicio /> },
  { passo: 4, toque: { x: 70, y: 57 }, tela: <PermissaoNotificacao /> },
]

// ---------- Android (Chrome) ----------

const QUADROS_ANDROID: Quadro[] = [
  {
    passo: 0,
    tela: (
      <>
        <BarraChrome />
        <PaginaApp comCardInstalar />
      </>
    ),
  },
  {
    passo: 1,
    toque: { x: 50, y: 48 },
    tela: (
      <>
        <BarraChrome />
        <PaginaApp comCardInstalar />
      </>
    ),
  },
  {
    passo: 1,
    toque: { x: 78, y: 58 },
    tela: (
      <>
        <BarraChrome />
        <PaginaApp comCardInstalar />
        <div className="absolute inset-0 flex items-center justify-center bg-[#000]/40 px-2">
          <div className="w-full rounded-xl bg-[#fff] p-2 text-[7.5px] text-[#202124] shadow-lg">
            <p className="font-semibold">Instalar app?</p>
            <div className="mt-1.5 flex items-center gap-1.5">
              <img src={ICONE_APP} alt="" className="h-5 w-5 rounded-full" />
              <span>Vila Esperança</span>
            </div>
            <div className="mt-2 flex justify-end gap-2 font-semibold text-[#1a73e8]">
              <span>Cancelar</span>
              <span>Instalar</span>
            </div>
          </div>
        </div>
      </>
    ),
  },
  { passo: 3, toque: { x: 17, y: 31 }, tela: <TelaInicio android /> },
  { passo: 4, toque: { x: 82, y: 56 }, tela: <PermissaoNotificacao android /> },
]

const QUADROS: Record<PlataformaAnimacao, Quadro[]> = { iphone: QUADROS_IPHONE, android: QUADROS_ANDROID }
