import { useEffect, useState, type RefObject } from 'react'
import { RotateCw } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Quanto puxar (px, já amortecido) pra recarregar ao soltar. */
const LIMITE = 70
const MAXIMO = 110

/** Algum elemento rolável entre o toque e o container já está rolado pra baixo (aí o gesto é dele). */
function dentroDeRolagem(alvo: EventTarget | null, container: HTMLElement): boolean {
  for (let el = alvo instanceof Element ? alvo : null; el && el !== container; el = el.parentElement) {
    if (el.scrollTop > 0) return true
  }
  return false
}

/**
 * "Puxar pra atualizar" no container que rola (o `<main>` do layout — a página em si não rola, e
 * no app instalado o iPhone não tem o gesto nativo): com a rolagem no topo, arrastar pra baixo
 * mostra a setinha e, passando do limite, soltar recarrega a página.
 */
export function PuxarParaAtualizar({ container }: { container: RefObject<HTMLElement | null> }) {
  const [puxado, setPuxado] = useState(0)
  const [recarregando, setRecarregando] = useState(false)

  useEffect(() => {
    const el = container.current
    if (!el) return
    let inicioY: number | null = null
    let atual = 0

    const comecar = (e: TouchEvent) => {
      inicioY = e.touches.length === 1 && el.scrollTop <= 0 && !dentroDeRolagem(e.target, el) ? e.touches[0].clientY : null
    }
    const mover = (e: TouchEvent) => {
      if (inicioY === null) return
      const dy = e.touches[0].clientY - inicioY
      // Subiu ou a lista rolou: não é "puxar".
      if (dy <= 0 || el.scrollTop > 0) {
        atual = 0
        setPuxado(0)
        return
      }
      atual = Math.min(MAXIMO, dy * 0.5)
      setPuxado(atual)
    }
    const soltar = () => {
      if (inicioY === null) return
      inicioY = null
      if (atual >= LIMITE) {
        setRecarregando(true)
        window.location.reload()
        return
      }
      atual = 0
      setPuxado(0)
    }

    el.addEventListener('touchstart', comecar, { passive: true })
    el.addEventListener('touchmove', mover, { passive: true })
    el.addEventListener('touchend', soltar)
    el.addEventListener('touchcancel', soltar)
    return () => {
      el.removeEventListener('touchstart', comecar)
      el.removeEventListener('touchmove', mover)
      el.removeEventListener('touchend', soltar)
      el.removeEventListener('touchcancel', soltar)
    }
  }, [container])

  const visivel = recarregando ? LIMITE : puxado
  if (!visivel) return null
  const pronto = recarregando || puxado >= LIMITE

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-30 flex justify-center"
      style={{ top: visivel - 40, transition: puxado ? undefined : 'top 150ms' }}
    >
      <span className={cn('flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-lg', pronto ? 'text-primary' : 'text-gray-400')}>
        <RotateCw
          className={cn('h-5 w-5', recarregando && 'animate-spin')}
          style={recarregando ? undefined : { transform: `rotate(${(visivel / LIMITE) * 270}deg)` }}
        />
      </span>
    </div>
  )
}
