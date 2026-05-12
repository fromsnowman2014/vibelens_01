import { Monitor, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@renderer/components/primitives/Button'
import { EmptyState } from '@renderer/components/primitives/EmptyState'

export function PreviewIdle() {
  return (
    <EmptyState
      icon={<Monitor size={32} />}
      title="No webapp running"
      description="Click the play button next to a commit in the timeline to run its webapp here."
    />
  )
}

export function PreviewBuilding() {
  return (
    <EmptyState
      icon={<Loader2 size={32} className="animate-spin" />}
      title="Building webapp..."
      description="Installing dependencies and starting dev server. Check the Log tab for progress."
    />
  )
}

export function PreviewError({ onStop }: { onStop: () => void }) {
  return (
    <EmptyState
      icon={<AlertCircle size={32} className="text-state-error" />}
      title="Build failed"
      description="The webapp failed to build. Check the Log tab for error details."
      action={
        <Button variant="secondary" size="sm" onClick={onStop}>
          Stop Session
        </Button>
      }
    />
  )
}

export function PreviewWaiting({ status }: { status?: string }) {
  return (
    <EmptyState
      icon={<Monitor size={32} />}
      title="Webapp session active"
      description={`Waiting for server... Status: ${status ?? 'unknown'}`}
    />
  )
}
