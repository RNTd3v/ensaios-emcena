import { useState } from 'react'
import { Download, ZoomIn } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { baixarImagem } from '@/lib/imagem'
import { cn } from '@/lib/utils'

interface Props {
  src: string
  nome?: string
  /** Mostra a dica de zoom (só onde tocar na imagem abre o zoom). */
  dicaZoom?: boolean
  className?: string
}

/** Linha embaixo da imagem num visualizador: dica de que tocar amplia + botão de baixar. */
export function ImagemAcoes({ src, nome, dicaZoom = true, className }: Props) {
  const [baixando, setBaixando] = useState(false)

  async function baixar() {
    setBaixando(true)
    try {
      await baixarImagem(src, nome)
    } finally {
      setBaixando(false)
    }
  }

  return (
    <div className={cn('flex items-center justify-between gap-2', className)}>
      {dicaZoom ? (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <ZoomIn className="h-3.5 w-3.5 shrink-0" />
          Toque na imagem para dar zoom
        </p>
      ) : (
        <span />
      )}
      <button
        type="button"
        onClick={baixar}
        disabled={baixando}
        className="flex shrink-0 items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
      >
        {baixando ? <Spinner size="sm" /> : <Download className="h-3.5 w-3.5" />}
        Baixar
      </button>
    </div>
  )
}
