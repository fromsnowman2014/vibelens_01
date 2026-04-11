import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import type {
  AnalysisResult,
  BranchInfo,
  Commit,
  DiffResult,
  Language,
  Settings
} from '@shared/types'

type Result<T> = { ok: true; data: T } | { ok: false; error: string }

function invoke<T>(channel: string, args?: unknown): Promise<Result<T>> {
  return ipcRenderer.invoke(channel, args) as Promise<Result<T>>
}

const api = {
  repo: {
    open: () =>
      invoke<{ path: string; valid: boolean; reason?: string } | null>('repo:open'),
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
    save: (provider: 'claude', key: string) =>
      invoke<{ hasKey: boolean }>('keychain:save', { provider, key }),
    has: (provider: 'claude') =>
      invoke<{ hasKey: boolean }>('keychain:has', { provider }),
    delete: (provider: 'claude') =>
      invoke<{ hasKey: boolean }>('keychain:delete', { provider }),
    test: (provider: 'claude') =>
      invoke<{ ok: boolean; error?: string }>('keychain:test', { provider })
  },
  app: {
    openExternal: (url: string) => invoke<boolean>('app:openExternal', { url }),
    readme: () => invoke<string>('app:readme')
  },
  on: (channel: string, cb: (...args: unknown[]) => void) => {
    const listener = (_e: IpcRendererEvent, ...args: unknown[]) => cb(...args)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}

contextBridge.exposeInMainWorld('vibelens', api)

export type VibeLensAPI = typeof api
