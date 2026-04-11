import { PropsWithChildren, ReactNode } from 'react'
import { cx } from '@renderer/lib/cx'

interface Props {
  title?: ReactNode
  rightSlot?: ReactNode
  className?: string
  headerClassName?: string
  bodyClassName?: string
}

export function Panel({
  title,
  rightSlot,
  className,
  headerClassName,
  bodyClassName,
  children
}: PropsWithChildren<Props>) {
  return (
    <section
      className={cx(
        'flex flex-col h-full min-h-0 bg-bg-panel border border-border rounded-panel overflow-hidden',
        className
      )}
    >
      {(title || rightSlot) && (
        <header
          className={cx(
            'flex-shrink-0 flex items-center justify-between px-3 h-9 border-b border-border text-fg-secondary text-[12px] font-medium',
            headerClassName
          )}
        >
          <div className="flex items-center gap-2 min-w-0 truncate">{title}</div>
          <div className="flex items-center gap-1 no-drag">{rightSlot}</div>
        </header>
      )}
      <div className={cx('flex-1 min-h-0 overflow-auto', bodyClassName)}>{children}</div>
    </section>
  )
}
