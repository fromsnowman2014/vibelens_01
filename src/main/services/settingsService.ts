import Store from 'electron-store'
import type { Settings } from '@shared/types'
import { DEFAULT_CLAUDE_MODEL } from '@shared/types'

const defaults: Settings = {
  theme: 'dark',
  language: 'en',
  consentAccepted: false,
  gitignoreAsked: {},
  recentRepos: [],
  claudeModel: DEFAULT_CLAUDE_MODEL,
  autoAnalyze: true
}

// electron-store v8 uses CJS default export
const store = new Store<Settings>({
  name: 'vibelens-settings',
  defaults
})

export function getSettings(): Settings {
  return { ...defaults, ...(store.store as Settings) }
}

export function setSettings(patch: Partial<Settings>): Settings {
  const next = { ...getSettings(), ...patch }
  store.store = next
  return next
}

export function addRecentRepo(path: string): void {
  const current = getSettings()
  const recent = [path, ...current.recentRepos.filter((p) => p !== path)].slice(0, 10)
  setSettings({ recentRepos: recent })
}

export function markGitignoreAsked(repoPath: string): void {
  const current = getSettings()
  setSettings({
    gitignoreAsked: { ...current.gitignoreAsked, [repoPath]: true }
  })
}
