import { useEffect, useRef, useState } from 'react'
import { useWebAppStore } from '@renderer/stores/webappStore'
import { EmptyState } from '@renderer/components/primitives/EmptyState'
import { Monitor, Loader2, AlertCircle, ExternalLink, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { Button } from '@renderer/components/primitives/Button'

export function LivePreview() {
  const { session, stopWebApp } = useWebAppStore()
  const webviewRef = useRef<HTMLElement>(null)
  const [zoom, setZoom] = useState(1)

  // Compute webview URL directly from session state
  // Use 127.0.0.1 instead of localhost to avoid Electron webview network isolation issues
  const webviewUrl = session?.status === 'running' && session.port
    ? `http://127.0.0.1:${session.port}`
    : null

  // Setup webview event handlers
  useEffect(() => {
    if (!webviewRef.current || !webviewUrl) return

    const webview = webviewRef.current

    // @ts-ignore - webview events
    const domReadyHandler = () => {
      // Apply zoom after DOM is ready
      // @ts-ignore
      webview.setZoomFactor(zoom)
    }

    // @ts-ignore
    const failLoadHandler = (e) => {
      console.error('[LivePreview] Failed to load:', e.errorDescription)
    }

    // @ts-ignore
    const consoleMessageHandler = (e) => {
      // Forward webview console messages to main console for debugging
      console.log('[WebView]', e.message)
    }

    // Attach event listeners
    // @ts-ignore
    webview.addEventListener('dom-ready', domReadyHandler)
    // @ts-ignore
    webview.addEventListener('did-fail-load', failLoadHandler)
    // @ts-ignore
    webview.addEventListener('console-message', consoleMessageHandler)

    return () => {
      // @ts-ignore
      webview.removeEventListener('dom-ready', domReadyHandler)
      // @ts-ignore
      webview.removeEventListener('did-fail-load', failLoadHandler)
      // @ts-ignore
      webview.removeEventListener('console-message', consoleMessageHandler)
    }
  }, [webviewUrl, zoom])

  // Apply zoom changes
  useEffect(() => {
    if (webviewRef.current) {
      // @ts-ignore
      webviewRef.current.setZoomFactor(zoom)
    }
  }, [zoom])

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.1, 2))
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.1, 0.5))
  const handleZoomReset = () => setZoom(1)

  if (!session) {
    return (
      <EmptyState
        icon={<Monitor size={32} />}
        title="No webapp running"
        description="Click the play button next to a commit in the timeline to run its webapp here."
      />
    )
  }

  if (session.status === 'building') {
    return (
      <EmptyState
        icon={<Loader2 size={32} className="animate-spin" />}
        title="Building webapp..."
        description="Installing dependencies and starting dev server. Check the Log tab for progress."
      />
    )
  }

  if (session.status === 'error') {
    return (
      <EmptyState
        icon={<AlertCircle size={32} className="text-state-error" />}
        title="Build failed"
        description="The webapp failed to build. Check the Log tab for error details."
        action={
          <Button variant="secondary" size="sm" onClick={() => stopWebApp()}>
            Stop Session
          </Button>
        }
      />
    )
  }

  // Running state - show webview
  if (session.status === 'running' && webviewUrl) {
    return (
      <div className="flex flex-col h-full w-full bg-bg-panel">
        {/* Toolbar with URL and actions */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-bg-secondary/60 text-xs">
          <Monitor size={12} className="text-accent" />
          <span className="flex-1 font-mono text-fg-secondary truncate">{webviewUrl}</span>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 border-l border-border pl-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
              title="Zoom out"
            >
              <ZoomOut size={12} />
            </Button>
            <span className="text-[10px] font-mono text-fg-muted min-w-[35px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomIn}
              disabled={zoom >= 2}
              title="Zoom in"
            >
              <ZoomIn size={12} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomReset}
              title="Reset zoom"
            >
              <Maximize2 size={12} />
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.vibelens.app.openExternal(webviewUrl)}
            className="flex items-center gap-1 border-l border-border pl-2"
          >
            <ExternalLink size={12} />
            <span>Open in Browser</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => stopWebApp()}
          >
            Stop
          </Button>
        </div>

        {/* WebView container */}
        <div className="flex-1 relative overflow-hidden bg-white">
          {/* @ts-ignore - webview is an Electron component not in React types */}
          <webview
            ref={webviewRef}
            src={webviewUrl}
            style={{
              width: '100%',
              height: '100%',
              display: 'inline-flex',
              visibility: 'visible'
            }}
            allowpopups="true"
            partition="persist:webapp"
            nodeintegration="false"
            webpreferences="allowRunningInsecureContent"
          />
        </div>
      </div>
    )
  }

  // Fallback
  return (
    <EmptyState
      icon={<Monitor size={32} />}
      title="Webapp session active"
      description={`Waiting for server... Status: ${session?.status || 'unknown'}`}
    />
  )
}
