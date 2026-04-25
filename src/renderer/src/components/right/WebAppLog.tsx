import { useEffect, useRef } from 'react'
import { useWebAppStore } from '@renderer/stores/webappStore'
import { EmptyState } from '@renderer/components/primitives/EmptyState'
import { ScrollText, Info, AlertCircle, AlertTriangle } from 'lucide-react'
import { Button } from '@renderer/components/primitives/Button'
import { cx } from '@renderer/lib/cx'

export function WebAppLog() {
  const { buildLogs, consoleLogs, clearLogs, session } = useWebAppStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [buildLogs, consoleLogs])

  if (!session) {
    return (
      <EmptyState
        icon={<ScrollText size={28} />}
        title="No logs yet"
        description="Start a webapp to see build and runtime logs here."
      />
    )
  }

  const allLogs = buildLogs.length === 0 && consoleLogs.length === 0

  if (allLogs && session.status === 'idle') {
    return (
      <EmptyState
        icon={<ScrollText size={28} />}
        title="No logs yet"
        description="Logs will appear here once the build starts."
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with clear button */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-border bg-bg-secondary/40">
        <span className="text-[11px] text-fg-muted font-medium">
          {buildLogs.length} build logs
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearLogs}
          disabled={buildLogs.length === 0}
        >
          Clear
        </Button>
      </div>

      {/* Logs container */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto font-mono text-[10.5px] p-2 space-y-0.5 select-text"
      >
        {buildLogs.map((log) => {
          const icon = {
            info: <Info size={12} className="text-accent" />,
            warn: <AlertTriangle size={12} className="text-state-warning" />,
            error: <AlertCircle size={12} className="text-state-error" />
          }[log.level]

          const textColor = {
            info: 'text-fg-secondary',
            warn: 'text-state-warning',
            error: 'text-state-error'
          }[log.level]

          return (
            <div
              key={log.id}
              className={cx('flex items-start gap-2 p-1.5 rounded hover:bg-bg-elevated', textColor)}
            >
              <span className="flex-shrink-0 mt-0.5">{icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[9px] text-fg-muted">
                  {new Date(log.timestamp).toLocaleTimeString()} • {log.source}
                </div>
                <div className="whitespace-pre-wrap break-words">{log.message}</div>
              </div>
            </div>
          )
        })}

        {consoleLogs.map((log) => {
          const icon = {
            log: <Info size={12} className="text-fg-muted" />,
            warn: <AlertTriangle size={12} className="text-state-warning" />,
            error: <AlertCircle size={12} className="text-state-error" />
          }[log.level]

          const textColor = {
            log: 'text-fg-secondary',
            warn: 'text-state-warning',
            error: 'text-state-error'
          }[log.level]

          return (
            <div
              key={log.id}
              className={cx('flex items-start gap-2 p-1.5 rounded hover:bg-bg-elevated', textColor)}
            >
              <span className="flex-shrink-0 mt-0.5">{icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[9px] text-fg-muted">
                  {new Date(log.timestamp).toLocaleTimeString()} • {log.source}
                </div>
                <div className="whitespace-pre-wrap break-words">{log.args.join(' ')}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
