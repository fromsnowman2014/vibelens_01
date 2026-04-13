import { create } from 'zustand'
import type { BranchInfo, Commit, DiffResult } from '@shared/types'
import { api, unwrap } from '../api/client'

const PAGE_SIZE = 80

interface RepoState {
  path: string | null
  name: string | null
  invalidReason: string | null
  branches: BranchInfo | null
  currentBranch: string | null

  commits: Commit[]
  commitsLoading: boolean
  commitsHasMore: boolean

  selectedCommitHash: string | null
  diff: DiffResult | null
  diffLoading: boolean
  selectedFileIdx: number

  cachedHashes: Set<string>

  // actions
  openRepo: () => Promise<void>
  openRepoByPath: (repoPath: string) => Promise<void>
  closeRepo: () => void
  switchBranch: (branch: string) => Promise<void>
  loadCommits: (reset?: boolean) => Promise<void>
  refreshCommits: () => Promise<void>
  selectCommit: (hash: string) => Promise<void>
  selectFile: (idx: number) => void
  refreshCachedHashes: () => Promise<void>
  markCached: (hash: string) => void
}

function basename(p: string): string {
  const parts = p.split('/').filter(Boolean)
  return parts[parts.length - 1] || p
}

export const useRepoStore = create<RepoState>((set, get) => ({
  path: null,
  name: null,
  invalidReason: null,
  branches: null,
  currentBranch: null,

  commits: [],
  commitsLoading: false,
  commitsHasMore: false,

  selectedCommitHash: null,
  diff: null,
  diffLoading: false,
  selectedFileIdx: 0,

  cachedHashes: new Set(),

  openRepo: async () => {
    const result = await unwrap(api.repo.open())
    if (!result) return
    if (!result.valid) {
      set({
        path: null,
        invalidReason: result.reason ?? 'Invalid repository',
        commits: [],
        diff: null,
        selectedCommitHash: null
      })
      return
    }
    await unwrap(api.cache.ensureDir(result.path))
    const branches = await unwrap(api.repo.getBranches(result.path))
    set({
      path: result.path,
      name: basename(result.path),
      invalidReason: null,
      branches,
      currentBranch: branches.current,
      commits: [],
      selectedCommitHash: null,
      diff: null,
      selectedFileIdx: 0,
      cachedHashes: new Set()
    })
    await get().loadCommits(true)
    await get().refreshCachedHashes()

    // Offer to add .vibelens/ to gitignore
    const check = await unwrap(api.cache.shouldAskGitignore(result.path))
    if (check.ask) {
      window.dispatchEvent(
        new CustomEvent('vibelens:ask-gitignore', { detail: { path: result.path } })
      )
    }
  },

  openRepoByPath: async (repoPath: string) => {
    await unwrap(api.cache.ensureDir(repoPath))
    const branches = await unwrap(api.repo.getBranches(repoPath))
    set({
      path: repoPath,
      name: basename(repoPath),
      invalidReason: null,
      branches,
      currentBranch: branches.current,
      commits: [],
      selectedCommitHash: null,
      diff: null,
      selectedFileIdx: 0,
      cachedHashes: new Set()
    })
    await get().loadCommits(true)
    await get().refreshCachedHashes()

    const check = await unwrap(api.cache.shouldAskGitignore(repoPath))
    if (check.ask) {
      window.dispatchEvent(
        new CustomEvent('vibelens:ask-gitignore', { detail: { path: repoPath } })
      )
    }
  },

  closeRepo: () => {
    set({
      path: null,
      name: null,
      invalidReason: null,
      branches: null,
      currentBranch: null,
      commits: [],
      commitsLoading: false,
      commitsHasMore: false,
      selectedCommitHash: null,
      diff: null,
      diffLoading: false,
      selectedFileIdx: 0,
      cachedHashes: new Set()
    })
  },

  switchBranch: async (branch) => {
    set({ currentBranch: branch, commits: [], selectedCommitHash: null, diff: null })
    await get().loadCommits(true)
  },

  loadCommits: async (reset = false) => {
    const { path, currentBranch, commits, commitsLoading } = get()
    if (!path || !currentBranch) return
    if (commitsLoading) return
    set({ commitsLoading: true })
    try {
      const offset = reset ? 0 : commits.length
      const batch = await unwrap(
        api.git.listCommits(path, currentBranch, PAGE_SIZE, offset)
      )
      const next = reset ? batch : [...commits, ...batch]
      set({
        commits: next,
        commitsHasMore: batch.length === PAGE_SIZE,
        commitsLoading: false
      })
      // Auto-select first commit for instant demo feedback
      if (reset && batch.length > 0 && !get().selectedCommitHash) {
        await get().selectCommit(batch[0].hash)
      }
    } catch (e) {
      set({ commitsLoading: false })
      throw e
    }
  },

  selectCommit: async (hash) => {
    const { path } = get()
    if (!path) return
    set({ selectedCommitHash: hash, diff: null, diffLoading: true, selectedFileIdx: 0 })
    try {
      const diff = await unwrap(api.git.getDiff(path, hash))
      // Only apply if still the current selection
      if (get().selectedCommitHash === hash) {
        set({ diff, diffLoading: false })
      }
    } catch (e) {
      set({ diffLoading: false })
      throw e
    }
  },

  selectFile: (idx) => set({ selectedFileIdx: idx }),

  refreshCommits: async () => {
    const { path, currentBranch, commits, commitsLoading } = get()
    if (!path || !currentBranch) return
    if (commitsLoading) return

    set({ commitsLoading: true })
    try {
      // Fetch latest commits (same count as currently loaded)
      const currentCount = commits.length || PAGE_SIZE
      const batch = await unwrap(
        api.git.listCommits(path, currentBranch, currentCount, 0)
      )

      // Check if there are new commits
      const existingHashes = new Set(commits.map((c) => c.hash))
      const newCommits = batch.filter((c) => !existingHashes.has(c.hash))

      if (newCommits.length > 0) {
        // Prepend new commits to the list
        const updatedCommits = [...newCommits, ...commits]
        set({
          commits: updatedCommits,
          commitsHasMore: batch.length === currentCount,
          commitsLoading: false
        })
      } else {
        // Just update hasMore flag
        set({
          commitsHasMore: batch.length === currentCount,
          commitsLoading: false
        })
      }
    } catch (e) {
      set({ commitsLoading: false })
      throw e
    }
  },

  refreshCachedHashes: async () => {
    const { path } = get()
    if (!path) return
    const hashes = await unwrap(api.cache.listHashes(path))
    set({ cachedHashes: new Set(hashes) })
  },

  markCached: (hash) => {
    const next = new Set(get().cachedHashes)
    next.add(hash)
    set({ cachedHashes: next })
  }
}))
