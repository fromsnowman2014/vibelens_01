import { ReactNode } from 'react'
import { cx } from '@renderer/lib/cx'

interface ActionCardProps {
  icon: ReactNode
  title: string
  description?: string
  badge?: ReactNode
  onClick: () => void
}

export function ActionCard({ icon, title, description, badge, onClick }: ActionCardProps) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'group relative flex flex-col items-center justify-center gap-3 p-6',
        'bg-bg-secondary hover:bg-bg-elevated border border-border rounded-card',
        'transition-all duration-200 ease-out',
        'hover:scale-[1.02] hover:shadow-[0_4px_12px_rgba(0,0,0,0.3)]',
        'active:scale-[0.98]',
        'min-h-[140px] w-full'
      )}
    >
      {/* Icon */}
      <div className="text-3xl opacity-80 group-hover:opacity-100 transition-opacity">
        {icon}
      </div>

      {/* Title and Badge */}
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-[14px] font-medium text-fg-primary">{title}</span>
        {badge && <div className="mt-0.5">{badge}</div>}
      </div>

      {/* Optional Description */}
      {description && (
        <span className="text-[11px] text-fg-muted text-center max-w-[200px]">
          {description}
        </span>
      )}

      {/* Hover glow effect */}
      <div className="absolute inset-0 rounded-card opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-gradient-to-b from-accent/5 to-transparent" />
    </button>
  )
}
