import { PropsWithChildren } from 'react'
import { cx } from '@renderer/lib/cx'

export type BadgeTone = 'neutral' | 'success' | 'info' | 'warning' | 'error'

interface Props {
  tone?: BadgeTone
  className?: string
  dot?: boolean
  title?: string
}

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-bg-tertiary text-fg-secondary border-border',
  success: 'bg-state-success/15 text-state-success border-state-success/30',
  info: 'bg-accent/15 text-accent border-accent/30',
  warning: 'bg-state-warning/15 text-state-warning border-state-warning/30',
  error: 'bg-state-error/15 text-state-error border-state-error/30'
}

const dots: Record<BadgeTone, string> = {
  neutral: 'bg-fg-muted',
  success: 'bg-state-success',
  info: 'bg-accent',
  warning: 'bg-state-warning',
  error: 'bg-state-error'
}

export function Badge({
  tone = 'neutral',
  className,
  dot,
  title,
  children
}: PropsWithChildren<Props>) {
  return (
    <span
      title={title}
      className={cx(
        'inline-flex items-center gap-1 px-1.5 h-5 rounded-chip border text-[10.5px] font-medium uppercase tracking-wide',
        tones[tone],
        className
      )}
    >
      {dot && <span className={cx('w-1.5 h-1.5 rounded-full', dots[tone])} />}
      {children}
    </span>
  )
}
