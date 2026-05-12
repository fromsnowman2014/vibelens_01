import { useRef } from 'react'
import { useWebAppStore } from '@renderer/stores/webappStore'
import { PreviewFrame } from './preview/PreviewFrame'
import { PreviewToolbar } from './preview/PreviewToolbar'
import {
  PreviewIdle,
  PreviewBuilding,
  PreviewError,
  PreviewWaiting
} from './preview/PreviewStates'
import { useWebviewEvents } from './preview/useWebviewEvents'
import { useWebviewZoom } from './preview/useWebviewZoom'

export function LivePreview() {
  const session = useWebAppStore((s) => s.session)
  const stopWebApp = useWebAppStore((s) => s.stopWebApp)
  const appendBuildLog = useWebAppStore((s) => s.appendBuildLog)
  const webviewRef = useRef<HTMLElement | null>(null)
  const zoom = useWebviewZoom(webviewRef)

  const openWebviewDevTools = () => {
    const el = webviewRef.current as unknown as { openDevTools?: () => void } | null
    el?.openDevTools?.()
  }

  // Match the dev server's bind host (buildManager spawns Next/Vite with -H 127.0.0.1).
  // Using the same address on both sides keeps Next from classifying chunk fetches
  // as cross-origin, which would silently block them.
  const url =
    session?.status === 'running' && session.port ? `http://127.0.0.1:${session.port}` : null

  useWebviewEvents(webviewRef, Boolean(url), {
    onDomReady: () => {
      // Zoom is reapplied here so a navigation/reload restores the user's setting.
      const el = webviewRef.current as unknown as { setZoomFactor?: (z: number) => void } | null
      el?.setZoomFactor?.(zoom.zoom)
    },
    onFailLoad: (e) => {
      // Surface the failure in the log panel where the user is already
      // looking. -3 is ERR_ABORTED (e.g. navigation cancelled); skip noise.
      if (e.errorCode === -3) return
      appendBuildLog({
        level: 'error',
        message: `Failed to load ${e.validatedURL}: ${e.errorDescription} (code ${e.errorCode})`,
        source: 'preview'
      })
    },
    onConsoleMessage: (e) => {
      // Electron webview level: 0=verbose, 1=info, 2=warning, 3=error.
      const level: 'info' | 'warn' | 'error' = e.level >= 3 ? 'error' : e.level === 2 ? 'warn' : 'info'
      appendBuildLog({
        level,
        message: `[${e.sourceId}:${e.line}] ${e.message}`,
        source: 'preview'
      })
    }
  })

  if (!session) return <PreviewIdle />
  if (session.status === 'building') return <PreviewBuilding />
  if (session.status === 'error') return <PreviewError onStop={() => stopWebApp()} />
  if (session.status === 'running' && url) {
    return (
      <div className="flex flex-col h-full w-full bg-bg-panel">
        <PreviewToolbar
          url={url}
          zoom={zoom}
          onStop={() => stopWebApp()}
          onOpenDevTools={openWebviewDevTools}
        />
        <PreviewFrame ref={webviewRef} url={url} />
      </div>
    )
  }
  return <PreviewWaiting status={session?.status} />
}
