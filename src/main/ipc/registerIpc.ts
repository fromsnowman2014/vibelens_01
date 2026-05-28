import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import { rebuildMenu } from '../index'
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
  getAllKeyStatus,
  hasKey,
  saveKey
} from '../services/keychainService'
import { claudeProvider } from '../services/llm/ClaudeProvider'
import { geminiProvider } from '../services/llm/GeminiProvider'
import type { LLMProvider } from '../services/llm/LLMProvider'
import { logger } from '../utils/logger'
import type { AnalysisResult, Language, ProviderId } from '@shared/types'
import * as webappService from '../services/webapp/webappService'
import * as buildManager from '../services/webapp/buildManager'

const activeAnalyses = new Map<string, AbortController>()

function getActiveProvider(): LLMProvider {
  const settings = getSettings()
  switch (settings.activeProvider) {
    case 'claude':
      return claudeProvider
    case 'gemini':
      return geminiProvider
    case 'openai':
      // TODO: Implement OpenAIProvider
      logger.warn('OpenAI provider not yet implemented, falling back to Claude')
      return claudeProvider
    default:
      logger.warn(`Unknown provider ${settings.activeProvider}, falling back to Claude`)
      return claudeProvider
  }
}

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
      const branches = await getBranches(p)
      addRecentRepo(p, branches.current)
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
        const branches = await getBranches(dest)
        addRecentRepo(dest, branches.current)
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
    async (_e, { provider, key }: { provider: ProviderId; key: string }) =>
      wrap(async () => {
        if (!key || key.length < 8) throw new Error('API key looks invalid.')
        await saveKey(provider, key.trim())
        return { hasKey: true }
      })
  )
  ipcMain.handle('keychain:has', async (_e, { provider }: { provider: ProviderId }) =>
    wrap(async () => ({ hasKey: await hasKey(provider) }))
  )
  ipcMain.handle('keychain:delete', async (_e, { provider }: { provider: ProviderId }) =>
    wrap(async () => {
      await deleteKey(provider)
      return { hasKey: false }
    })
  )
  ipcMain.handle('keychain:test', async (_e, { provider }: { provider: ProviderId }) =>
    wrap(async () => {
      // Get provider instance by provider ID
      let testProvider: LLMProvider
      switch (provider) {
        case 'claude':
          testProvider = claudeProvider
          break
        case 'gemini':
          testProvider = geminiProvider
          break
        case 'openai':
          throw new Error('OpenAI provider not yet implemented')
        default:
          throw new Error(`Unknown provider: ${provider}`)
      }
      return testProvider.ping()
    })
  )
  ipcMain.handle('keychain:status-all', async () =>
    wrap(async () => getAllKeyStatus())
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
          const provider = getActiveProvider()
          const result: AnalysisResult = await provider.analyzeCommit({
            commit,
            diffText,
            language,
            model: getSettings().activeModel,
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

  // -------- chat --------
  ipcMain.handle(
    'chat:send',
    async (
      _e,
      {
        messages,
        context
      }: {
        messages: { role: 'user' | 'assistant'; content: string }[]
        context?: string
      }
    ) =>
      wrap(async () => {
        const provider = getActiveProvider()
        return provider.chatWithContext(messages, context, getSettings().activeModel)
      })
  )

  // -------- menu --------
  // Rebuild menu whenever a repo is opened/closed (to refresh Open Recent)
  ipcMain.on('menu:rebuildNeeded', () => {
    rebuildMenu()
  })

  // -------- webapp --------
  ipcMain.handle(
    'webapp:detect',
    async (_e, { repoPath, commitHash }: { repoPath: string; commitHash: string }) =>
      wrap(async () => webappService.detectProject(repoPath, commitHash))
  )

  ipcMain.handle(
    'webapp:start',
    async (_e, { repoPath, commitHash }: { repoPath: string; commitHash: string }) =>
      wrap(async () => webappService.startWebApp(repoPath, commitHash))
  )

  ipcMain.handle('webapp:stop', async (_e, { sessionId }: { sessionId: string }) =>
    wrap(async () => webappService.stopWebApp(sessionId))
  )

  ipcMain.handle('webapp:getStatus', async (_e, { sessionId }: { sessionId: string }) =>
    wrap(async () => webappService.getStatus(sessionId))
  )

  // Webapp log streaming (event-based)
  ipcMain.on('webapp:subscribeLogs', (event, { sessionId }: { sessionId: string }) => {
    const emitter = buildManager.getSessionEmitter(sessionId)
    if (!emitter) {
      logger.warn(`No emitter found for session ${sessionId}`)
      return
    }

    const logHandler = (log: any) => {
      event.sender.send('webapp:log', { sessionId, log })
    }

    const warningHandler = (warning: any) => {
      event.sender.send('webapp:warning', { sessionId, warning })
    }

    const statusChangeHandler = (data: any) => {
      event.sender.send('webapp:status-change', { sessionId, status: data.status })
    }

    emitter.on('log', logHandler)
    emitter.on('warning', warningHandler)
    emitter.on('status-change', statusChangeHandler)

    // Cleanup on disconnect
    event.sender.once('destroyed', () => {
      emitter.off('log', logHandler)
      emitter.off('warning', warningHandler)
      emitter.off('status-change', statusChangeHandler)
    })
  })

  logger.info('IPC handlers registered')
}
