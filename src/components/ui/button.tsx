import * as React from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'ghost' | 'link' | 'success'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

const variantClasses: Record<string, string> = {
  default: 'bg-primary text-primary-foreground hover:opacity-90 shadow-sm',
  destructive: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
  outline: 'border border-border bg-transparent hover:bg-muted text-foreground',
  ghost: 'hover:bg-muted text-foreground',
  link: 'text-primary underline-offset-4 hover:underline',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
}

const sizeClasses: Record<string, string> = {
  default: 'h-11 px-4 py-2 text-base',
  sm: 'h-10 px-4 text-sm',
  lg: 'h-12 px-8 text-base',
  icon: 'h-11 w-11',
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        'disabled:pointer-events-none disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  ),
)
Button.displayName = 'Button'
