import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cx } from '@renderer/lib/cx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const base =
  'inline-flex items-center justify-center gap-1.5 rounded-card font-medium whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-not-allowed no-drag'

const sizes: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-[12px]',
  md: 'h-9 px-3.5 text-[13px]'
}

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-bg-primary hover:bg-accent-hover shadow-[0_1px_0_rgba(255,255,255,0.1)_inset]',
  secondary:
    'bg-bg-tertiary text-fg-primary hover:bg-bg-elevated border border-border',
  ghost: 'text-fg-secondary hover:text-fg-primary hover:bg-bg-tertiary',
  danger: 'bg-state-error/80 text-white hover:bg-state-error'
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = 'secondary', size = 'md', loading, children, disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      className={cx(base, sizes[size], variants[variant], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && (
        <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  )
})
