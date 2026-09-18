import * as React from 'react'
import { cn } from '@/lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'destructive' | 'warning' | 'outline'
}

const variantClasses: Record<string, string> = {
  default: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  destructive: 'bg-red-100 text-red-700 border-red-200',
  warning: 'bg-amber-100 text-amber-700 border-amber-200',
  outline: 'bg-gray-100 text-gray-700 border-gray-200',
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  )
}
