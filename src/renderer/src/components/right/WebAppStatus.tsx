import { useWebAppStore } from '@renderer/stores/webappStore'
import { EmptyState } from '@renderer/components/primitives/EmptyState'
import { Button } from '@renderer/components/primitives/Button'
import { Monitor, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'
import { Badge } from '@renderer/components/primitives/Badge'

export function WebAppStatus() {
  const session = useWebAppStore((s) => s.session)
  const warnings = useWebAppStore((s) => s.warnings)
  const stopWebApp = useWebAppStore((s) => s.stopWebApp)
  const projectConfig = useWebAppStore((s) =>
    session ? s.projectConfigByHash[session.commitHash] ?? null : null
  )

  if (!session) {
    return (
      <EmptyState
        icon={<Monitor size={28} />}
        title="No webapp running"
        description="Click the play button next to a commit to run its webapp."
      />
    )
  }

  const statusColor = {
    idle: 'neutral',
    detecting: 'info',
    building: 'info',
    running: 'success',
    error: 'error'
  }[session.status] as 'neutral' | 'info' | 'success' | 'error'

  const statusIcon = {
    idle: <Monitor size={16} />,
    detecting: <Loader2 size={16} className="animate-spin" />,
    building: <Loader2 size={16} className="animate-spin" />,
    running: <CheckCircle size={16} />,
    error: <AlertTriangle size={16} />
  }[session.status]

  return (
    <div className="p-4 space-y-4">
      {/* Session Status */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-fg-primary">Session Status</h3>
          <Button variant="secondary" size="sm" onClick={stopWebApp}>
            Stop
          </Button>
        </div>

        <div className="bg-bg-elevated border border-border rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            {statusIcon}
            <span className="text-[12px] font-medium text-fg-primary capitalize">
              {session.status}
            </span>
            <Badge tone={statusColor} />
          </div>

          <div className="text-[11px] text-fg-muted space-y-1">
            <div>
              <span className="font-mono">Commit:</span>{' '}
              <span className="font-mono text-fg-secondary">{session.commitHash.slice(0, 7)}</span>
            </div>
            {session.port && (
              <div>
                <span className="font-mono">Port:</span>{' '}
                <span className="font-mono text-fg-secondary">{session.port}</span>
              </div>
            )}
            {session.pid && (
              <div>
                <span className="font-mono">PID:</span>{' '}
                <span className="font-mono text-fg-secondary">{session.pid}</span>
              </div>
            )}
            <div>
              <span className="font-mono">Started:</span>{' '}
              <span className="font-mono text-fg-secondary">
                {new Date(session.startedAt).toLocaleTimeString()}
              </span>
            </div>
          </div>

          {session.status === 'running' && session.port && (
            <div className="pt-2 border-t border-border">
              <a
                href={`http://localhost:${session.port}`}
                className="text-[11px] text-accent hover:underline font-mono"
                onClick={(e) => {
                  e.preventDefault()
                  window.vibelens.app.openExternal(`http://localhost:${session.port}`)
                }}
              >
                http://localhost:{session.port}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Project Config */}
      {projectConfig && projectConfig.type !== 'unknown' && (
        <div className="space-y-2">
          <h3 className="text-[13px] font-semibold text-fg-primary">Project Configuration</h3>
          <div className="bg-bg-elevated border border-border rounded-lg p-3 space-y-2 text-[11px] text-fg-muted">
            <div>
              <span className="font-mono">Type:</span>{' '}
              <span className="font-mono text-fg-secondary">{projectConfig.type}</span>
            </div>
            {projectConfig.devCommand && (
              <div>
                <span className="font-mono">Dev command:</span>{' '}
                <span className="font-mono text-fg-secondary">{projectConfig.devCommand}</span>
              </div>
            )}
            {projectConfig.devPort && (
              <div>
                <span className="font-mono">Default port:</span>{' '}
                <span className="font-mono text-fg-secondary">{projectConfig.devPort}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[13px] font-semibold text-fg-primary">Warnings</h3>
          <div className="space-y-2">
            {warnings.map((warning, idx) => (
              <div
                key={idx}
                className={`border rounded-lg p-3 text-[11px] ${
                  warning.severity === 'error'
                    ? 'bg-state-error/10 border-state-error/30 text-state-error'
                    : 'bg-state-warning/10 border-state-warning/30 text-state-warning'
                }`}
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium capitalize">{warning.type.replace(/-/g, ' ')}</div>
                    <div className="mt-1 text-fg-muted">{warning.message}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
