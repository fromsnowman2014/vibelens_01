import { forwardRef } from 'react'

interface Props {
  url: string
}

/**
 * The embedded browser surface. The only file in the renderer that knows
 * about the `<webview>` tag, its partition, and its webpreferences. If we
 * later swap to BrowserView/WebContentsView/iframe, this is the only file
 * that changes.
 *
 * R1 preserves every prior attribute. F1 tightens them.
 */
export const PreviewFrame = forwardRef<HTMLElement, Props>(function PreviewFrame({ url }, ref) {
  return (
    <div className="flex-1 relative overflow-hidden bg-white">
      {/* @ts-ignore - webview is an Electron tag not in React types */}
      <webview
        ref={ref}
        src={url}
        style={{
          width: '100%',
          height: '100%',
          display: 'inline-flex',
          visibility: 'visible'
        }}
        // @ts-ignore - electron webview attrs are stringly-typed
        allowpopups="true"
        partition="persist:webapp"
        // @ts-ignore - electron webview attrs are stringly-typed
        nodeintegration="false"
        // @ts-ignore - electron webview attrs are stringly-typed
        webpreferences="allowRunningInsecureContent"
      />
    </div>
  )
})
