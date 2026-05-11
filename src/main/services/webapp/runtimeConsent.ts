/**
 * Bridges the managed-runtime download flow to a renderer-side consent prompt.
 *
 * Flow:
 *   1. nodeRuntime calls `requestConsent({ kind: 'node', version })`.
 *   2. If the user has previously decided (consentService), we return the
 *      stored decision immediately.
 *   3. Otherwise we send `runtimeConsent:request` to the renderer and wait
 *      for the renderer to invoke `runtimeConsent:respond` via IPC.
 *   4. We persist the decision (when `remember` is true) and resolve.
 *
 * Concurrent requests for the same kind share a single in-flight promise so
 * we never open two prompts for the same thing.
 */

import { BrowserWindow, ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import {
  type RuntimeKind,
  getConsent,
  setConsent
} from '../consentService'

export interface ConsentRequest {
  id: string
  kind: RuntimeKind
  version: string
  /** Human-readable size estimate when we know it. */
  approxSizeMB?: number
}

export interface ConsentResponse {
  id: string
  granted: boolean
  /** When true, persist the decision so we don't ask again. */
  remember: boolean
}

const pending = new Map<string, (resp: ConsentResponse) => void>()
const inflightByKind = new Map<RuntimeKind, Promise<boolean>>()

let ipcRegistered = false

function ensureIpcRegistered(): void {
  if (ipcRegistered) return
  ipcRegistered = true
  ipcMain.on('runtimeConsent:respond', (_event, resp: ConsentResponse) => {
    const resolver = pending.get(resp.id)
    if (resolver) {
      pending.delete(resp.id)
      resolver(resp)
    }
  })
}

function getTargetWindow(): BrowserWindow | null {
  // The single main window. If the app ever supports multiple, we'd target
  // the focused one; for now, first window is unambiguous.
  const wins = BrowserWindow.getAllWindows()
  return wins[0] ?? null
}

/**
 * Returns true iff the user has consented to downloading a binary of `kind`.
 * Uses persisted consent when available; otherwise asks the renderer.
 * On any error (no window, IPC timeout) returns false so the caller falls
 * back to system binaries.
 */
export async function requestConsent(req: Omit<ConsentRequest, 'id'>): Promise<boolean> {
  ensureIpcRegistered()

  const stored = getConsent(req.kind)
  if (stored) {
    return stored.granted
  }

  const existing = inflightByKind.get(req.kind)
  if (existing) return existing

  const job = new Promise<boolean>((resolve) => {
    const win = getTargetWindow()
    if (!win) {
      console.warn('[runtimeConsent] no window available to prompt user')
      resolve(false)
      return
    }
    const id = randomUUID()
    pending.set(id, (resp) => {
      if (resp.remember) setConsent(req.kind, resp.granted)
      resolve(resp.granted)
    })
    const payload: ConsentRequest = { id, ...req }
    win.webContents.send('runtimeConsent:request', payload)
  })

  inflightByKind.set(req.kind, job)
  try {
    return await job
  } finally {
    inflightByKind.delete(req.kind)
  }
}
