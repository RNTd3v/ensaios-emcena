import { cn } from '@/lib/utils'

const SIZE_MAP = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-[3px]',
}

interface Props {
  size?: keyof typeof SIZE_MAP
  className?: string
}

export function Spinner({ size = 'md', className }: Props) {
  return (
    <div
      role="status"
      aria-label="Carregando"
      className={cn('animate-spin rounded-full border-primary/25 border-t-primary', SIZE_MAP[size], className)}
    />
  )
}
