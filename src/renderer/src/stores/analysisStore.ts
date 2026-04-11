import { create } from 'zustand'
import type { AnalysisResult, Commit, Language } from '@shared/types'
import { api, unwrap } from '../api/client'
import { useRepoStore } from './repoStore'
import { useSettingsStore } from './settingsStore'

type Status = 'idle' | 'loading' | 'done' | 'error'

interface AnalysisState {
  cache: Record<string, AnalysisResult> // key = `${hash}:${lang}`
  status: Record<string, Status>
  errors: Record<string, string>
  totalTokensIn: number
  totalTokensOut: number

  analyzeSelected: (force?: boolean) => Promise<void>
  prefetchCached: (commit: Commit) => Promise<void>
  cancelSelected: () => Promise<void>
  clearForRepo: () => void
}

function keyFor(hash: string, lang: Language): string {
  return `${hash}:${lang}`
}

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  cache: {},
  status: {},
  errors: {},
  totalTokensIn: 0,
  totalTokensOut: 0,

  analyzeSelected: async (force = false) => {
    const repo = useRepoStore.getState()
    const settings = useSettingsStore.getState()
    const { path, selectedCommitHash, commits } = repo
    const commit = commits.find((c) => c.hash === selectedCommitHash)
    const language = settings.settings?.language ?? 'en'
    if (!path || !commit) return
    if (!settings.hasClaudeKey) {
      const k = keyFor(commit.hash, language)
      set((s) => ({
        status: { ...s.status, [k]: 'error' },
        errors: {
          ...s.errors,
          [k]: 'Claude API key is not set. Open Settings (⌘,) to add it.'
        }
      }))
      return
    }

    const k = keyFor(commit.hash, language)

    // Try cache unless force
    if (!force) {
      const cached = get().cache[k]
      if (cached) {
        set((s) => ({ status: { ...s.status, [k]: 'done' } }))
        return
      }
      try {
        const fromDisk = await unwrap(
          api.analysis.getCached(path, commit.hash, language)
        )
        if (fromDisk) {
          set((s) => ({
            cache: { ...s.cache, [k]: fromDisk },
            status: { ...s.status, [k]: 'done' }
          }))
          repo.markCached(commit.hash)
          return
        }
      } catch (e) {
        // fall through to analyze
      }
    }

    set((s) => ({ status: { ...s.status, [k]: 'loading' } }))

    try {
      const result = await unwrap(
        api.analysis.analyze(path, commit, language, force)
      )
      set((s) => ({
        cache: { ...s.cache, [k]: result },
        status: { ...s.status, [k]: 'done' },
        totalTokensIn: s.totalTokensIn + (result.tokensIn || 0),
        totalTokensOut: s.totalTokensOut + (result.tokensOut || 0)
      }))
      repo.markCached(commit.hash)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      set((s) => ({
        status: { ...s.status, [k]: 'error' },
        errors: { ...s.errors, [k]: msg }
      }))
    }
  },

  prefetchCached: async (commit) => {
    const repo = useRepoStore.getState()
    const settings = useSettingsStore.getState()
    const { path } = repo
    const language = settings.settings?.language ?? 'en'
    if (!path) return
    const k = keyFor(commit.hash, language)
    if (get().cache[k]) return
    try {
      const fromDisk = await unwrap(
        api.analysis.getCached(path, commit.hash, language)
      )
      if (fromDisk) {
        set((s) => ({
          cache: { ...s.cache, [k]: fromDisk },
          status: { ...s.status, [k]: 'done' }
        }))
      }
    } catch {
      /* noop */
    }
  },

  cancelSelected: async () => {
    const repo = useRepoStore.getState()
    const settings = useSettingsStore.getState()
    const { path, selectedCommitHash } = repo
    const language = settings.settings?.language ?? 'en'
    if (!path || !selectedCommitHash) return
    try {
      await unwrap(api.analysis.cancel(path, selectedCommitHash, language))
    } catch {
      /* noop */
    }
  },

  clearForRepo: () =>
    set({ cache: {}, status: {}, errors: {}, totalTokensIn: 0, totalTokensOut: 0 })
}))
