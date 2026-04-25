import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import type {
  AnalysisResult,
  BranchInfo,
  Commit,
  DiffResult,
  Language,
  ProviderId,
  Settings,
  ProjectConfig,
  WebAppSession
} from '@shared/types'

type Result<T> = { ok: true; data: T } | { ok: false; error: string }

function invoke<T>(channel: string, args?: unknown): Promise<Result<T>> {
  return ipcRenderer.invoke(channel, args) as Promise<Result<T>>
}

const api = {
  repo: {
    open: () =>
      invoke<{ path: string; valid: boolean; reason?: string } | null>('repo:open'),
    clone: (url: string, dest: string) =>
      invoke<{ path: string; valid: boolean }>('repo:clone', { url, dest }),
    selectDirectory: () => invoke<string | null>('repo:selectDirectory'),
    validate: (p: string) => invoke<{ valid: boolean }>('repo:validate', { path: p }),
    getBranches: (p: string) => invoke<BranchInfo>('repo:getBranches', { path: p }),
    openInFinder: (p: string) => invoke<boolean>('repo:openInFinder', { path: p })
  },
  git: {
    listCommits: (path: string, branch: string, limit: number, offset: number) =>
      invoke<Commit[]>('git:listCommits', { path, branch, limit, offset }),
    getDiff: (path: string, commitHash: string) =>
      invoke<DiffResult>('git:getDiff', { path, commitHash }),
    getFileAtCommit: (path: string, commitHash: string, filePath: string) =>
      invoke<string>('git:getFileAtCommit', { path, commitHash, filePath })
  },
  analysis: {
    getCached: (path: string, commitHash: string, language: Language) =>
      invoke<AnalysisResult | null>('analysis:getCached', {
        path,
        commitHash,
        language
      }),
    analyze: (
      path: string,
      commit: Commit,
      language: Language,
      force?: boolean
    ) =>
      invoke<AnalysisResult>('analysis:analyze', {
        path,
        commit,
        language,
        force
      }),
    cancel: (path: string, commitHash: string, language: Language) =>
      invoke<boolean>('analysis:cancel', { path, commitHash, language })
  },
  cache: {
    ensureDir: (path: string) => invoke<boolean>('cache:ensureDir', { path }),
    listHashes: (path: string) => invoke<string[]>('cache:listHashes', { path }),
    clear: (path: string) => invoke<boolean>('cache:clear', { path }),
    shouldAskGitignore: (path: string) =>
      invoke<{ ask: boolean }>('cache:shouldAskGitignore', { path }),
    addToGitignore: (path: string, decline?: boolean) =>
      invoke<{ added: boolean }>('cache:addToGitignore', { path, decline })
  },
  settings: {
    get: () => invoke<Settings>('settings:get'),
    set: (patch: Partial<Settings>) => invoke<Settings>('settings:set', patch)
  },
  keychain: {
    save: (provider: ProviderId, key: string) =>
      invoke<{ hasKey: boolean }>('keychain:save', { provider, key }),
    has: (provider: ProviderId) =>
      invoke<{ hasKey: boolean }>('keychain:has', { provider }),
    delete: (provider: ProviderId) =>
      invoke<{ hasKey: boolean }>('keychain:delete', { provider }),
    test: (provider: ProviderId) =>
      invoke<{ ok: boolean; error?: string }>('keychain:test', { provider }),
    getAllStatus: () =>
      invoke<Record<ProviderId, boolean>>('keychain:status-all')
  },
  app: {
    openExternal: (url: string) => invoke<boolean>('app:openExternal', { url }),
    readme: () => invoke<string>('app:readme')
  },
  chat: {
    send: (messages: { role: 'user' | 'assistant'; content: string }[], context?: string) =>
      invoke<{ text: string; tokensIn: number; tokensOut: number }>(
        'chat:send',
        { messages, context }
      )
  },
  webapp: {
    detect: (repoPath: string, commitHash: string) =>
      invoke<ProjectConfig>('webapp:detect', { repoPath, commitHash }),
    start: (repoPath: string, commitHash: string) =>
      invoke<WebAppSession>('webapp:start', { repoPath, commitHash }),
    stop: (sessionId: string) =>
      invoke<void>('webapp:stop', { sessionId }),
    getStatus: (sessionId: string) =>
      invoke<WebAppSession | null>('webapp:getStatus', { sessionId }),
    subscribeLogs: (
      sessionId: string,
      onLog: (log: any) => void,
      onWarning: (warning: any) => void,
      onStatusChange?: (status: string) => void
    ) => {
      // Subscribe to log events
      ipcRenderer.send('webapp:subscribeLogs', { sessionId })

      // Listen for logs
      const logListener = (_e: IpcRendererEvent, data: { sessionId: string; log: any }) => {
        if (data.sessionId === sessionId) {
          onLog(data.log)
        }
      }

      const warningListener = (_e: IpcRendererEvent, data: { sessionId: string; warning: any }) => {
        if (data.sessionId === sessionId) {
          onWarning(data.warning)
        }
      }

      const statusChangeListener = (_e: IpcRendererEvent, data: { sessionId: string; status: string }) => {
        if (data.sessionId === sessionId && onStatusChange) {
          onStatusChange(data.status)
        }
      }

      ipcRenderer.on('webapp:log', logListener)
      ipcRenderer.on('webapp:warning', warningListener)
      ipcRenderer.on('webapp:status-change', statusChangeListener)

      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('webapp:log', logListener)
        ipcRenderer.removeListener('webapp:warning', warningListener)
        ipcRenderer.removeListener('webapp:status-change', statusChangeListener)
      }
    }
  },
  on: (channel: string, cb: (...args: unknown[]) => void) => {
    const listener = (_e: IpcRendererEvent, ...args: unknown[]) => cb(...args)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
  send: (channel: string, ...args: unknown[]) => {
    ipcRenderer.send(channel, ...args)
  }
}

contextBridge.exposeInMainWorld('vibelens', api)

export type VibeLensAPI = typeof api

