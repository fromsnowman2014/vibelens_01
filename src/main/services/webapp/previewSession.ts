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
 * Non-persistent on purpose (no "persist:" prefix): cookies, caches,
 * service workers, localStorage, IndexedDB all die when the partition is
 * unloaded. Each fresh commit starts with vanilla browser state, matching
 * a freshly-opened Chrome tab. See docs/LIVE_PREVIEW_COMPATIBILITY.md §4.2.
 */
export const PREVIEW_PARTITION = 'webapp'

/** Resolve the Electron Session backing the preview webview. */
export function getWebappSession(): Session {
  return electronSession.fromPartition(PREVIEW_PARTITION)
}

/**
 * Apply request/header policy to the preview session.
 *
 * F2: this used to inject wildcard CORS on every response, which masked
 * the symptoms of webSecurity:false but broke real dev-server behavior
 * (Next.js fetches confused by the rewritten headers; mixed-credentials
 * requests rejected by Chromium). We let the dev server's headers pass
 * through unchanged — dev servers handle localhost CORS correctly on
 * their own.
 *
 * Kept as a function (instead of deleting) because future preview-only
 * policy will land here (e.g. per-host CSP, request blocking).
 */
export function configureWebappSession(): void {
  // Resolve once so the Session object is materialized at startup, matching
  // the prior call site's timing.
  getWebappSession()
  console.log(`${LOG} configured partition=${PREVIEW_PARTITION} (no header rewrites)`)
}

/**
 * Wipe per-origin state from the preview session: cookies, caches, service
 * workers, localStorage/IndexedDB. Called from webappService.startWebApp
 * before spawning the dev server so a previous repo's storage cannot leak
 * into the next one.
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
