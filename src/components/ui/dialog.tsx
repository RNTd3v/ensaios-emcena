import * as React from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DialogProps {
  open: boolean
  onClose: () => void
  title?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function Dialog({ open, onClose, title, children, className }: DialogProps) {
  const [mounted, setMounted] = React.useState(false)
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setMounted(true)
      const t = setTimeout(() => setVisible(true), 10)
      return () => clearTimeout(t)
    } else {
      setVisible(false)
      const t = setTimeout(() => setMounted(false), 300)
      return () => clearTimeout(t)
    }
  }, [open])

  React.useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <div
        className={cn(
          'absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          'relative z-10 w-full bg-card shadow-2xl overflow-y-auto p-6',
          'max-h-[85vh] pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]',
          'transition-transform duration-300 ease-out',
          'sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-border',
          visible ? 'translate-y-0' : 'translate-y-full',
          className,
        )}
      >
        {title && (
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-primary/30">
            <h2 className="text-xl font-semibold text-foreground">{title}</h2>
            <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  )
}
