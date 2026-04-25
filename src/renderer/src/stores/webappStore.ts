import { create } from 'zustand'
import type { WebAppSession, ProjectConfig, WebAppWarning } from '@shared/types'
import { api, unwrap } from '../api/client'
import { useRepoStore } from './repoStore'

interface BuildLog {
  id: string
  timestamp: number
  level: 'info' | 'warn' | 'error'
  message: string
  source: 'build' | 'runtime'
}

interface ConsoleLog {
  id: string
  timestamp: number
  level: 'log' | 'warn' | 'error'
  args: string[]
  source: string
}

interface WebAppState {
  session: WebAppSession | null
  projectConfig: ProjectConfig | null
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
  projectConfig: null,
  buildLogs: [],
  consoleLogs: [],
  warnings: [],
  shouldAutoSwitchToPreview: false,
  shouldAutoSwitchToLog: false,

  detectProject: async (commitHash: string) => {
    const repo = useRepoStore.getState()
    const { path } = repo
    if (!path) return null

    try {
      const config = await unwrap(api.webapp.detect(path, commitHash))
      set({ projectConfig: config })
      return config
    } catch (e) {
      console.error('Project detection failed:', e)
      return null
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
      const session = await unwrap(api.webapp.start(path, commitHash))
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
    const newLog: BuildLog = {
      ...log,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now()
    }
    set((s) => ({
      buildLogs: [...s.buildLogs, newLog]
    }))
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
      projectConfig: null,
      buildLogs: [],
      consoleLogs: [],
      warnings: [],
      shouldAutoSwitchToPreview: false,
      shouldAutoSwitchToLog: false
    })
  }
}))
