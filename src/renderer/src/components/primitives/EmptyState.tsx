import { ReactNode } from 'react'
import { cx } from '@renderer/lib/cx'

interface Props {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: Props) {
  return (
    <div
      className={cx(
        'h-full w-full flex flex-col items-center justify-center text-center gap-3 px-8 py-12 text-fg-secondary',
        className
      )}
    >
      {icon && <div className="text-fg-muted">{icon}</div>}
      <div className="text-fg-primary text-sm font-medium">{title}</div>
      {description && (
        <div className="max-w-sm text-[12.5px] leading-relaxed text-fg-secondary selectable">
          {description}
        </div>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
