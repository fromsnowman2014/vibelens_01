import { RefObject, useCallback, useEffect, useState } from 'react'

export interface WebviewZoom {
  zoom: number
  zoomIn: () => void
  zoomOut: () => void
  reset: () => void
}

/**
 * Zoom state for the embedded preview surface. Encapsulates the
 * `setZoomFactor` side-effect so the consumer just gets a number and
 * three callbacks.
 */
export function useWebviewZoom(webviewRef: RefObject<HTMLElement | null>): WebviewZoom {
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    const el = webviewRef.current as unknown as { setZoomFactor?: (z: number) => void } | null
    el?.setZoomFactor?.(zoom)
  }, [zoom, webviewRef])

  const zoomIn = useCallback(() => setZoom((z) => Math.min(z + 0.1, 2)), [])
  const zoomOut = useCallback(() => setZoom((z) => Math.max(z - 0.1, 0.5)), [])
  const reset = useCallback(() => setZoom(1), [])

  return { zoom, zoomIn, zoomOut, reset }
}
