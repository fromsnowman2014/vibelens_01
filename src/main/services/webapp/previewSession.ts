/**
 * Single owner of the embedded preview's Electron Session.
 *
 * Every webview policy that touches the Live Preview surface (partition name,
 * header rewrites, storage cleanup) lives here. Other modules should NOT call
 * `session.fromPartition('webapp'…)` directly — go through this module so
 * future changes have one place to land.
 *
 * See docs/LIVE_PREVIEW_COMPATIBILITY.md for the design rationale.
 */

import { session as electronSession, type Session } from 'electron'

const LOG = '[previewSession]'

/**
 * Partition name used by the <webview> tag in the renderer.
 *
 * R1 keeps the existing persistent name to preserve behavior bit-for-bit
 * during the refactor. F1 will rename this to a non-persistent partition.
 */
export const PREVIEW_PARTITION = 'persist:webapp'

let configured = false

/** Resolve the Electron Session backing the preview webview. */
export function getWebappSession(): Session {
  return electronSession.fromPartition(PREVIEW_PARTITION)
}

/**
 * Apply request/header policy to the preview session. Idempotent — safe to
 * call repeatedly, only takes effect on first call.
 *
 * R1 preserves the existing behavior: a no-op onBeforeSendHeaders and a
 * global onHeadersReceived that injects wildcard CORS. F2 removes both.
 */
export function configureWebappSession(): void {
  if (configured) return
  configured = true
  const sess = getWebappSession()

  sess.webRequest.onBeforeSendHeaders((details, callback) => {
    callback({ requestHeaders: { ...details.requestHeaders } })
  })

  sess.webRequest.onHeadersReceived((details, callback) => {
    const headers = details.responseHeaders || {}
    callback({
      responseHeaders: {
        ...headers,
        'Access-Control-Allow-Origin': ['*'],
        'Access-Control-Allow-Methods': ['*'],
        'Access-Control-Allow-Headers': ['*']
      }
    })
  })

  console.log(`${LOG} configured partition=${PREVIEW_PARTITION}`)
}

/**
 * Wipe per-origin state from the preview session: cookies, caches, service
 * workers, localStorage/IndexedDB. Used between sessions so a previous
 * repo's storage cannot leak into the next one.
 *
 * Not wired up in R1 (no behavior change). F2 will call this from
 * webappService.startWebApp before spawning the dev server.
 */
export async function clearWebappSession(): Promise<void> {
  const sess = getWebappSession()
  await sess.clearStorageData({
    storages: [
      'cookies',
      'localstorage',
      'indexdb',
      'shadercache',
      'serviceworkers',
      'cachestorage'
    ]
  })
  await sess.clearCache()
  console.log(`${LOG} cleared storage for partition=${PREVIEW_PARTITION}`)
}
