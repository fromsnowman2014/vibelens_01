import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import {
  checkIsRepo,
  cloneRepo,
  getBranches,
  getDiff,
  getFileAtCommit,
  getUnifiedDiffText,
  listCommits
} from '../services/gitService'
import {
  addVibelensToGitignore,
  clearCache,
  ensureCacheDir,
  isGitignoreMissingEntry,
  listCachedHashes,
  readCache,
  writeCache
} from '../services/cacheService'
import {
  addRecentRepo,
  getSettings,
  markGitignoreAsked,
  setSettings
} from '../services/settingsService'
import {
  deleteKey,
  hasKey,
  saveKey
} from '../services/keychainService'
import { claudeProvider } from '../services/llm/ClaudeProvider'
import { logger } from '../utils/logger'
import type { AnalysisResult, Language } from '@shared/types'

const activeAnalyses = new Map<string, AbortController>()

function analysisKey(repoPath: string, hash: string, lang: Language): string {
  return `${repoPath}::${hash}::${lang}`
}

async function wrap<T>(
  fn: () => Promise<T>
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const data = await fn()
    return { ok: true, data }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.error('IPC handler error:', msg)
    return { ok: false, error: msg }
  }
}

export function registerIpc(): void {
  // -------- repo --------
  ipcMain.handle('repo:open', async () =>
    wrap(async () => {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      const result = await dialog.showOpenDialog(win!, {
        title: 'Open Git Repository',
        properties: ['openDirectory'],
        buttonLabel: 'Open'
      })
      if (result.canceled || result.filePaths.length === 0) {
        return null
      }
      const p = result.filePaths[0]
      const valid = await checkIsRepo(p)
      if (!valid) {
        return { path: p, valid: false, reason: 'Not a Git repository (no .git directory).' }
      }
      addRecentRepo(p)
      return { path: p, valid: true }
    })
  )

  ipcMain.handle(
    'repo:clone',
    async (
      _e,
      { url, dest }: { url: string; dest: string }
    ) =>
      wrap(async () => {
        await cloneRepo(url, dest)
        const valid = await checkIsRepo(dest)
        if (!valid) throw new Error('Clone completed but directory is not a valid git repo.')
        addRecentRepo(dest)
        return { path: dest, valid: true }
      })
  )

  ipcMain.handle('repo:selectDirectory', async () =>
    wrap(async () => {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      const result = await dialog.showOpenDialog(win!, {
        title: 'Select Clone Destination',
        properties: ['openDirectory', 'createDirectory'],
        buttonLabel: 'Select'
      })
      if (result.canceled || result.filePaths.length === 0) return null
      return result.filePaths[0]
    })
  )

  ipcMain.handle('repo:validate', async (_e, { path: p }: { path: string }) =>
    wrap(async () => ({ valid: await checkIsRepo(p) }))
  )

  ipcMain.handle('repo:getBranches', async (_e, { path: p }: { path: string }) =>
    wrap(async () => getBranches(p))
  )

  ipcMain.handle(
    'repo:openInFinder',
    async (_e, { path: p }: { path: string }) =>
      wrap(async () => {
        shell.openPath(p)
        return true
      })
  )

  // -------- git --------
  ipcMain.handle(
    'git:listCommits',
    async (
      _e,
      {
        path: p,
        branch,
        limit,
        offset
      }: { path: string; branch: string; limit: number; offset: number }
    ) => wrap(async () => listCommits(p, branch, limit, offset))
  )

  ipcMain.handle(
    'git:getDiff',
    async (_e, { path: p, commitHash }: { path: string; commitHash: string }) =>
      wrap(async () => getDiff(p, commitHash))
  )

  ipcMain.handle(
    'git:getFileAtCommit',
    async (
      _e,
      { path: p, commitHash, filePath }: { path: string; commitHash: string; filePath: string }
    ) => wrap(async () => getFileAtCommit(p, commitHash, filePath))
  )

  // -------- settings --------
  ipcMain.handle('settings:get', async () => wrap(async () => getSettings()))
  ipcMain.handle('settings:set', async (_e, patch: Partial<ReturnType<typeof getSettings>>) =>
    wrap(async () => setSettings(patch))
  )

  // -------- keychain --------
  ipcMain.handle(
    'keychain:save',
    async (_e, { provider, key }: { provider: 'claude'; key: string }) =>
      wrap(async () => {
        if (!key || key.length < 8) throw new Error('API key looks invalid.')
        await saveKey(provider, key.trim())
        return { hasKey: true }
      })
  )
  ipcMain.handle('keychain:has', async (_e, { provider }: { provider: 'claude' }) =>
    wrap(async () => ({ hasKey: await hasKey(provider) }))
  )
  ipcMain.handle('keychain:delete', async (_e, { provider }: { provider: 'claude' }) =>
    wrap(async () => {
      await deleteKey(provider)
      return { hasKey: false }
    })
  )
  ipcMain.handle('keychain:test', async (_e, { provider }: { provider: 'claude' }) =>
    wrap(async () => {
      if (provider !== 'claude') throw new Error('Unsupported provider')
      return claudeProvider.ping()
    })
  )

  // -------- cache --------
  ipcMain.handle('cache:ensureDir', async (_e, { path: p }: { path: string }) =>
    wrap(async () => {
      await ensureCacheDir(p)
      return true
    })
  )
  ipcMain.handle('cache:listHashes', async (_e, { path: p }: { path: string }) =>
    wrap(async () => listCachedHashes(p))
  )
  ipcMain.handle('cache:clear', async (_e, { path: p }: { path: string }) =>
    wrap(async () => {
      await clearCache(p)
      return true
    })
  )
  ipcMain.handle(
    'cache:shouldAskGitignore',
    async (_e, { path: p }: { path: string }) =>
      wrap(async () => {
        const settings = getSettings()
        if (settings.gitignoreAsked[p]) return { ask: false }
        const missing = await isGitignoreMissingEntry(p)
        return { ask: missing }
      })
  )
  ipcMain.handle(
    'cache:addToGitignore',
    async (_e, { path: p, decline }: { path: string; decline?: boolean }) =>
      wrap(async () => {
        markGitignoreAsked(p)
        if (decline) return { added: false }
        const added = await addVibelensToGitignore(p)
        return { added }
      })
  )

  // -------- analysis --------
  ipcMain.handle(
    'analysis:getCached',
    async (
      _e,
      { path: p, commitHash, language }: { path: string; commitHash: string; language: Language }
    ) => wrap(async () => readCache(p, commitHash, language))
  )

  ipcMain.handle(
    'analysis:analyze',
    async (
      _e,
      {
        path: p,
        commit,
        language,
        force
      }: {
        path: string
        commit: import('@shared/types').Commit
        language: Language
        force?: boolean
      }
    ) =>
      wrap(async () => {
        if (!force) {
          const cached = await readCache(p, commit.hash, language)
          if (cached) return cached
        }
        const diffText = await getUnifiedDiffText(p, commit.hash)
        const key = analysisKey(p, commit.hash, language)
        const ac = new AbortController()
        activeAnalyses.set(key, ac)
        try {
          const result: AnalysisResult = await claudeProvider.analyzeCommit({
            commit,
            diffText,
            language,
            signal: ac.signal
          })
          await writeCache(p, result)
          return result
        } finally {
          activeAnalyses.delete(key)
        }
      })
  )

  ipcMain.handle(
    'analysis:cancel',
    async (
      _e,
      { path: p, commitHash, language }: { path: string; commitHash: string; language: Language }
    ) =>
      wrap(async () => {
        const key = analysisKey(p, commitHash, language)
        const ac = activeAnalyses.get(key)
        if (ac) {
          ac.abort()
          activeAnalyses.delete(key)
        }
        return true
      })
  )

  // -------- app --------
  ipcMain.handle('app:openExternal', async (_e, { url }: { url: string }) =>
    wrap(async () => {
      await shell.openExternal(url)
      return true
    })
  )
  ipcMain.handle('app:readme', async () =>
    wrap(async () => {
      try {
        return await fs.readFile(path.join(process.cwd(), 'README.md'), 'utf8')
      } catch {
        return ''
      }
    })
  )

  logger.info('IPC handlers registered')
}
