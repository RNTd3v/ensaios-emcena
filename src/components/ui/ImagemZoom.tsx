import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { corsDoStorage } from '@/lib/imagem'

const ESCALA_MAX = 5
const ESCALA_TOQUE_DUPLO = 2.5

interface Ponto {
  x: number
  y: number
}

interface Props {
  src: string
  alt?: string
  onClose: () => void
}

/**
 * Imagem em tela cheia com zoom de pinça, arrastar e toque duplo. O viewport do app trava o zoom
 * da página (maximum-scale=1), então o zoom é feito aqui, só na imagem.
 */
export function ImagemZoom({ src, alt, onClose }: Props) {
  const areaRef = useRef<HTMLDivElement>(null)
  const [t, setT] = useState({ s: 1, x: 0, y: 0 })
  const [animando, setAnimando] = useState(false)
  const tRef = useRef(t)
  tRef.current = t
  const pointers = useRef(new Map<number, Ponto>())
  const gesto = useRef<{ s: number; x: number; y: number; dist: number; meio: Ponto } | null>(null)
  const ultimoToque = useRef(0)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Captura antes do Dialog de baixo: o Esc fecha só o zoom.
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [onClose])

  /** Ponto relativo ao centro da área (a transformação usa origem no centro). */
  function relativo(p: Ponto): Ponto {
    const r = areaRef.current!.getBoundingClientRect()
    return { x: p.x - r.left - r.width / 2, y: p.y - r.top - r.height / 2 }
  }

  /** Não deixa a imagem sair de vista: o deslocamento máximo cresce com o zoom. */
  function limitar(s: number, x: number, y: number) {
    const r = areaRef.current!.getBoundingClientRect()
    const mx = ((s - 1) * r.width) / 2
    const my = ((s - 1) * r.height) / 2
    return { s, x: Math.max(-mx, Math.min(mx, x)), y: Math.max(-my, Math.min(my, y)) }
  }

  function iniciarGesto() {
    const pts = [...pointers.current.values()].map(relativo)
    const atual = tRef.current
    if (pts.length >= 2) {
      const [a, b] = pts
      gesto.current = { ...atual, dist: Math.hypot(a.x - b.x, a.y - b.y), meio: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }
    } else if (pts.length === 1) {
      gesto.current = { ...atual, dist: 0, meio: pts[0] }
    } else {
      gesto.current = null
    }
  }

  function onPointerDown(e: ReactPointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    setAnimando(false)
    iniciarGesto()
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (!pointers.current.has(e.pointerId) || !gesto.current) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pts = [...pointers.current.values()].map(relativo)
    const g = gesto.current
    if (pts.length >= 2 && g.dist > 0) {
      const [a, b] = pts
      const meio = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const s = Math.max(1, Math.min(ESCALA_MAX, (g.s * Math.hypot(a.x - b.x, a.y - b.y)) / g.dist))
      // Mantém sob os dedos o mesmo ponto da imagem que estava no início da pinça.
      const qx = (g.meio.x - g.x) / g.s
      const qy = (g.meio.y - g.y) / g.s
      setT(limitar(s, meio.x - s * qx, meio.y - s * qy))
    } else if (pts.length === 1 && g.s > 1) {
      setT(limitar(g.s, g.x + pts[0].x - g.meio.x, g.y + pts[0].y - g.meio.y))
    }
  }

  function onPointerUp(e: ReactPointerEvent) {
    const eraToqueUnico = pointers.current.size === 1
    pointers.current.delete(e.pointerId)
    iniciarGesto()
    if (pointers.current.size > 0 || !eraToqueUnico) return

    const agora = Date.now()
    if (agora - ultimoToque.current < 300) {
      ultimoToque.current = 0
      setAnimando(true)
      const atual = tRef.current
      if (atual.s > 1) return setT({ s: 1, x: 0, y: 0 })
      const p = relativo({ x: e.clientX, y: e.clientY })
      const s = ESCALA_TOQUE_DUPLO
      setT(limitar(s, p.x - s * ((p.x - atual.x) / atual.s), p.y - s * ((p.y - atual.y) / atual.s)))
    } else {
      ultimoToque.current = agora
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      <div className="flex justify-end p-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))]">
        <button onClick={onClose} className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Fechar">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div
        ref={areaRef}
        className="relative flex-1 overflow-hidden touch-none select-none pb-[env(safe-area-inset-bottom,0px)]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          src={src}
          crossOrigin={corsDoStorage(src)}
          alt={alt ?? ''}
          draggable={false}
          className="h-full w-full object-contain"
          style={{
            transform: `translate(${t.x}px, ${t.y}px) scale(${t.s})`,
            transition: animando ? 'transform 200ms ease-out' : undefined,
          }}
        />
      </div>
      <p className="pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] text-center text-xs text-white/60">
        Pince para dar zoom · toque duas vezes para ampliar
      </p>
    </div>,
    document.body,
  )
}
