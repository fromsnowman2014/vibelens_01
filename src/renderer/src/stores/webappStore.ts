import { create } from 'zustand'
import type { WebAppSession, ProjectConfig, WebAppWarning } from '@shared/types'
import { api, unwrap } from '../api/client'
import { useRepoStore } from './repoStore'

interface BuildLog {
  id: string
  timestamp: number
  level: 'info' | 'warn' | 'error'
  message: string
  source: 'build' | 'runtime' | 'preview'
  /** Number of times the most recent identical log was repeated. >=1.
   *  Displayed as "× N" when greater than 1. */
  count?: number
}

/** Maximum build logs we retain in memory. Older entries are dropped from
 *  the head. Keeps memory + render cost bounded for chatty apps. */
const MAX_BUILD_LOGS = 500

/** Window during which an identical log collapses into a counter on the
 *  previous entry instead of pushing a new row. */
const DEDUP_WINDOW_MS = 2000

interface ConsoleLog {
  id: string
  timestamp: number
  level: 'log' | 'warn' | 'error'
  args: string[]
  source: string
}

interface WebAppState {
  session: WebAppSession | null
  /** Per-commit cache of detected project config. Replaces the old single-slot field
   *  that caused every commit row to share the same detect result. */
  projectConfigByHash: Record<string, ProjectConfig>
  /** Hashes currently being detected (in-flight), to dedupe concurrent calls. */
  detectingHashes: Set<string>
  buildLogs: BuildLog[]
  consoleLogs: ConsoleLog[]
  warnings: WebAppWarning[]

  // Auto tab switching flags
  shouldAutoSwitchToPreview: boolean
  shouldAutoSwitchToLog: boolean

  // Actions
  startWebApp: (commitHash: string) => Promise<void>
  stopWebApp: () => Promise<void>
  detectProject: (commitHash: string) => Promise<ProjectConfig | null>
  appendBuildLog: (log: Omit<BuildLog, 'id' | 'timestamp'>) => void
  appendConsoleLog: (log: Omit<ConsoleLog, 'id' | 'timestamp'>) => void
  addWarning: (warning: WebAppWarning) => void
  clearLogs: () => void
  resetAutoSwitchFlags: () => void

  // Cleanup on repo change
  clearForRepo: () => void
}

let logCleanupFn: (() => void) | null = null

export const useWebAppStore = create<WebAppState>((set, get) => ({
  session: null,
  projectConfigByHash: {},
  detectingHashes: new Set<string>(),
  buildLogs: [],
  consoleLogs: [],
  warnings: [],
  shouldAutoSwitchToPreview: false,
  shouldAutoSwitchToLog: false,

  detectProject: async (commitHash: string) => {
    const repo = useRepoStore.getState()
    const { path } = repo
    if (!path) {
      console.warn('[webappStore] detectProject called with no repo path')
      return null
    }

    const shortHash = commitHash.slice(0, 7)
    const cached = get().projectConfigByHash[commitHash]
    if (cached) {
      console.log(`[webappStore] detectProject cache hit commit=${shortHash} type=${cached.type}`)
      return cached
    }

    if (get().detectingHashes.has(commitHash)) {
      console.log(`[webappStore] detectProject already in-flight commit=${shortHash}`)
      return null
    }

    const inflight = new Set(get().detectingHashes)
    inflight.add(commitHash)
    set({ detectingHashes: inflight })

    try {
      console.log(`[webappStore] detectProject start commit=${shortHash}`)
      const config = await unwrap(api.webapp.detect(path, commitHash))
      console.log(
        `[webappStore] detectProject done commit=${shortHash} type=${config.type} workingDir="${config.workingDir}"`
      )
      set((s) => ({
        projectConfigByHash: { ...s.projectConfigByHash, [commitHash]: config }
      }))
      return config
    } catch (e) {
      console.error(`[webappStore] detectProject failed commit=${shortHash}`, e)
      return null
    } finally {
      const next = new Set(get().detectingHashes)
      next.delete(commitHash)
      set({ detectingHashes: next })
    }
  },

  startWebApp: async (commitHash: string) => {
    const repo = useRepoStore.getState()
    const { path } = repo
    if (!path) return

    // Clear previous session
    const currentSession = get().session
    if (currentSession) {
      await get().stopWebApp()
    }

    // Clear logs
    set({
      buildLogs: [],
      consoleLogs: [],
      warnings: [],
      shouldAutoSwitchToPreview: true,
      shouldAutoSwitchToLog: true
    })

    try {
      // Start session
      console.log(`[webappStore] startWebApp commit=${commitHash.slice(0, 7)}`)
      const session = await unwrap(api.webapp.start(path, commitHash))
      console.log(
        `[webappStore] startWebApp session created sessionId=${session.sessionId.slice(0, 8)} port=${session.port}`
      )
      set({ session })

      // Subscribe to logs
      if (logCleanupFn) {
        logCleanupFn()
      }

      logCleanupFn = api.webapp.subscribeLogs(
        session.sessionId,
        (log: any) => {
          // Build log
          get().appendBuildLog({
            level: log.level || 'info',
            message: log.message || '',
            source: log.source || 'build'
          })
        },
        (warning: any) => {
          // Warning
          get().addWarning(warning)
        },
        (status: string) => {
          // Status change handler
          const currentSession = get().session
          if (currentSession && currentSession.sessionId === session.sessionId) {
            set({
              session: {
                ...currentSession,
                status: status as any
              }
            })
          }
        }
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      set({
        session: null,
        warnings: [
          {
            type: 'api-error',
            message: `Failed to start webapp: ${msg}`,
            severity: 'error'
          }
        ]
      })
    }
  },

  stopWebApp: async () => {
    const { session } = get()
    if (!session) return

    try {
      // Cleanup log subscription
      if (logCleanupFn) {
        logCleanupFn()
        logCleanupFn = null
      }

      // Stop session
      await unwrap(api.webapp.stop(session.sessionId))
      set({
        session: null,
        shouldAutoSwitchToPreview: false,
        shouldAutoSwitchToLog: false
      })
    } catch (e) {
      console.error('Failed to stop webapp:', e)
      // Force clear session even if stop failed
      set({
        session: null,
        shouldAutoSwitchToPreview: false,
        shouldAutoSwitchToLog: false
      })
    }
  },

  appendBuildLog: (log) => {
    set((s) => {
      const now = Date.now()
      const prev = s.buildLogs[s.buildLogs.length - 1]
      // Collapse identical consecutive logs within DEDUP_WINDOW_MS into a
      // single entry with an incrementing counter. Cheaper than re-rendering
      // every time a Next dev passive-listener warning fires 6× in a row.
      if (
        prev &&
        prev.level === log.level &&
        prev.source === log.source &&
        prev.message === log.message &&
        now - prev.timestamp < DEDUP_WINDOW_MS
      ) {
        const updated = {
          ...prev,
          count: (prev.count ?? 1) + 1,
          timestamp: now
        }
        return { buildLogs: [...s.buildLogs.slice(0, -1), updated] }
      }
      const newLog: BuildLog = {
        ...log,
        id: `${now}-${Math.random().toString(36).slice(2, 9)}`,
        timestamp: now,
        count: 1
      }
      // Cap at MAX_BUILD_LOGS; drop the oldest if we'd exceed.
      const next = [...s.buildLogs, newLog]
      if (next.length > MAX_BUILD_LOGS) {
        next.splice(0, next.length - MAX_BUILD_LOGS)
      }
      return { buildLogs: next }
    })
  },

  appendConsoleLog: (log) => {
    const newLog: ConsoleLog = {
      ...log,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now()
    }
    set((s) => ({
      consoleLogs: [...s.consoleLogs, newLog]
    }))
  },

  addWarning: (warning) => {
    set((s) => ({
      warnings: [...s.warnings, warning]
    }))
  },

  clearLogs: () => {
    set({
      buildLogs: [],
      consoleLogs: [],
      warnings: []
    })
  },

  resetAutoSwitchFlags: () => {
    set({
      shouldAutoSwitchToPreview: false,
      shouldAutoSwitchToLog: false
    })
  },

  clearForRepo: () => {
    // Cleanup log subscription
    if (logCleanupFn) {
      logCleanupFn()
      logCleanupFn = null
    }

    set({
      session: null,
      projectConfigByHash: {},
      detectingHashes: new Set<string>(),
      buildLogs: [],
      consoleLogs: [],
      warnings: [],
      shouldAutoSwitchToPreview: false,
      shouldAutoSwitchToLog: false
    })
  }
}))
