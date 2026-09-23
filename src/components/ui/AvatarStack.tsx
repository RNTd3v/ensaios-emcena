import { useCallback, useRef, useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'

interface AvatarStackItem {
  key: string
  photoURL?: string | null
  name: string
}

interface Props {
  items: AvatarStackItem[]
  className?: string
}

const AVATAR_SIZE = 28 // h-7 w-7
const AVATAR_STEP = 20 // 28px de avatar menos 8px de sobreposição (-space-x-2)

/**
 * Avatares sobrepostos que se ajustam à largura disponível do container — o que não cabe
 * vira "+N". Sem isso, um limite fixo de itens deixa espaço vazio ou estoura o card dependendo
 * da largura real da tela.
 */
export function AvatarStack({ items, className }: Props) {
  const [rowWidth, setRowWidth] = useState(0)
  const observerRef = useRef<ResizeObserver | null>(null)

  const rowRef = useCallback((el: HTMLDivElement | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null
    if (!el) return
    const observer = new ResizeObserver(entries => setRowWidth(entries[0].contentRect.width))
    observer.observe(el)
    observerRef.current = observer
  }, [])

  if (items.length === 0) return null

  const maxVisible = rowWidth > 0 ? Math.max(1, Math.floor((rowWidth - AVATAR_SIZE) / AVATAR_STEP) + 1) : items.length
  const visibleCount = items.length <= maxVisible ? items.length : maxVisible - 1
  const hiddenCount = items.length - visibleCount

  return (
    <div ref={rowRef} className={cn('flex -space-x-2 min-w-0', className)}>
      {items.slice(0, visibleCount).map(item => (
        <Avatar key={item.key} photoURL={item.photoURL} name={item.name} className="h-7 w-7 shrink-0 text-[10px] ring-2 ring-white" />
      ))}
      {hiddenCount > 0 && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[10px] font-medium text-gray-600 ring-2 ring-white">
          +{hiddenCount}
        </div>
      )}
    </div>
  )
}
