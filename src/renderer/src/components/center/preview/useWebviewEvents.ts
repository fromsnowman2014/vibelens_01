import { RefObject, useEffect } from 'react'

export interface WebviewEventHandlers {
  onDomReady?: () => void
  onFailLoad?: (e: { errorCode: number; errorDescription: string; validatedURL: string }) => void
  onConsoleMessage?: (e: { level: number; message: string; line: number; sourceId: string }) => void
}

/**
 * Wires Electron <webview>'s native event names to JS handlers. The webview
 * tag predates React, so it uses imperative addEventListener; this hook
 * hides that detail.
 */
export function useWebviewEvents(
  webviewRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  handlers: WebviewEventHandlers
): void {
  const { onDomReady, onFailLoad, onConsoleMessage } = handlers
  useEffect(() => {
    if (!enabled) return
    const el = webviewRef.current
    if (!el) return

    const domReady = () => onDomReady?.()
    const failLoad = (e: Event) => {
      // Electron event extends DOM Event with errorCode, errorDescription, validatedURL.
      const ev = e as unknown as { errorCode: number; errorDescription: string; validatedURL: string }
      onFailLoad?.({ errorCode: ev.errorCode, errorDescription: ev.errorDescription, validatedURL: ev.validatedURL })
    }
    const consoleMessage = (e: Event) => {
      const ev = e as unknown as { level: number; message: string; line: number; sourceId: string }
      onConsoleMessage?.({ level: ev.level, message: ev.message, line: ev.line, sourceId: ev.sourceId })
    }

    el.addEventListener('dom-ready', domReady)
    el.addEventListener('did-fail-load', failLoad)
    el.addEventListener('console-message', consoleMessage)
    return () => {
      el.removeEventListener('dom-ready', domReady)
      el.removeEventListener('did-fail-load', failLoad)
      el.removeEventListener('console-message', consoleMessage)
    }
  }, [enabled, webviewRef, onDomReady, onFailLoad, onConsoleMessage])
}
