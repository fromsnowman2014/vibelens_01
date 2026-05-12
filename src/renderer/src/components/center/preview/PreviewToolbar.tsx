import { Monitor, ExternalLink, ZoomIn, ZoomOut, Maximize2, Bug } from 'lucide-react'
import { Button } from '@renderer/components/primitives/Button'
import type { WebviewZoom } from './useWebviewZoom'

interface Props {
  url: string
  zoom: WebviewZoom
  onStop: () => void
  onOpenDevTools: () => void
}

export function PreviewToolbar({ url, zoom, onStop, onOpenDevTools }: Props) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-bg-secondary/60 text-xs">
      <Monitor size={12} className="text-accent" />
      <span className="flex-1 font-mono text-fg-secondary truncate">{url}</span>

      <div className="flex items-center gap-1 border-l border-border pl-2">
        <Button variant="ghost" size="sm" onClick={zoom.zoomOut} disabled={zoom.zoom <= 0.5} title="Zoom out">
          <ZoomOut size={12} />
        </Button>
        <span className="text-[10px] font-mono text-fg-muted min-w-[35px] text-center">
          {Math.round(zoom.zoom * 100)}%
        </span>
        <Button variant="ghost" size="sm" onClick={zoom.zoomIn} disabled={zoom.zoom >= 2} title="Zoom in">
          <ZoomIn size={12} />
        </Button>
        <Button variant="ghost" size="sm" onClick={zoom.reset} title="Reset zoom">
          <Maximize2 size={12} />
        </Button>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={onOpenDevTools}
        className="flex items-center gap-1 border-l border-border pl-2"
        title="Open DevTools for the preview"
      >
        <Bug size={12} />
        <span>DevTools</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => window.vibelens.app.openExternal(url)}
        className="flex items-center gap-1 border-l border-border pl-2"
      >
        <ExternalLink size={12} />
        <span>Open in Browser</span>
      </Button>
      <Button variant="ghost" size="sm" onClick={onStop}>
        Stop
      </Button>
    </div>
  )
}
