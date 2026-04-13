import Store from 'electron-store'
import type { Settings, RecentRepo } from '@shared/types'
import { DEFAULT_CLAUDE_MODEL } from '@shared/types'
import { basename } from 'path'

const defaults: Settings = {
  theme: 'dark',
  language: 'en',
  consentAccepted: false,
  gitignoreAsked: {},
  recentRepos: [],
  claudeModel: DEFAULT_CLAUDE_MODEL,
  autoAnalyze: false
}

// electron-store v8 uses CJS default export
const store = new Store<Settings>({
  name: 'vibelens-settings',
  defaults
})

export function getSettings(): Settings {
  const raw = store.store as Settings
  const settings = { ...defaults, ...raw }

  // Migration: Convert old string[] recentRepos to RecentRepo[]
  if (settings.recentRepos.length > 0 && typeof settings.recentRepos[0] === 'string') {
    settings.recentRepos = (settings.recentRepos as unknown as string[]).map((path) => ({
      path,
      name: basename(path)
    }))
    // Save migrated data
    store.store = settings
  }

  return settings
}

export function setSettings(patch: Partial<Settings>): Settings {
  const next = { ...getSettings(), ...patch }
  store.store = next
  return next
}

export function addRecentRepo(path: string): void {
  const current = getSettings()
  const newRepo: RecentRepo = {
    path,
    name: basename(path),
    lastOpened: Date.now()
  }
  const recent = [
    newRepo,
    ...current.recentRepos.filter((r) => r.path !== path)
  ].slice(0, 10)
  setSettings({ recentRepos: recent })
}

export function markGitignoreAsked(repoPath: string): void {
  const current = getSettings()
  setSettings({
    gitignoreAsked: { ...current.gitignoreAsked, [repoPath]: true }
  })
}
