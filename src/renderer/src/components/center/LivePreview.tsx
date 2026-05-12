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
  const webviewRef = useRef<HTMLElement | null>(null)
  const zoom = useWebviewZoom(webviewRef)

  // Use 127.0.0.1 instead of localhost to avoid Electron webview network isolation issues.
  const url =
    session?.status === 'running' && session.port ? `http://127.0.0.1:${session.port}` : null

  useWebviewEvents(webviewRef, Boolean(url), {
    onDomReady: () => {
      // Zoom is reapplied here so a navigation/reload restores the user's setting.
      const el = webviewRef.current as unknown as { setZoomFactor?: (z: number) => void } | null
      el?.setZoomFactor?.(zoom.zoom)
    },
    onFailLoad: (e) => {
      console.error('[LivePreview] Failed to load:', e.errorDescription)
    },
    onConsoleMessage: (e) => {
      // Forward webview console messages to main console for debugging.
      console.log('[WebView]', e.message)
    }
  })

  if (!session) return <PreviewIdle />
  if (session.status === 'building') return <PreviewBuilding />
  if (session.status === 'error') return <PreviewError onStop={() => stopWebApp()} />
  if (session.status === 'running' && url) {
    return (
      <div className="flex flex-col h-full w-full bg-bg-panel">
        <PreviewToolbar url={url} zoom={zoom} onStop={() => stopWebApp()} />
        <PreviewFrame ref={webviewRef} url={url} />
      </div>
    )
  }
  return <PreviewWaiting status={session?.status} />
}
