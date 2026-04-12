import { create } from 'zustand'
import type { Language, Settings } from '@shared/types'
import { api, unwrap } from '../api/client'

interface SettingsState {
  settings: Settings | null
  hasClaudeKey: boolean
  loaded: boolean
  load: () => Promise<void>
  acceptConsent: () => Promise<void>
  setLanguage: (lang: Language) => Promise<void>
  toggleLanguage: () => Promise<Language>
  saveClaudeKey: (key: string) => Promise<void>
  deleteClaudeKey: () => Promise<void>
  toggleAutoAnalyze: () => Promise<void>
  refreshKeyPresence: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  hasClaudeKey: false,
  loaded: false,

  load: async () => {
    const settings = await unwrap(api.settings.get())
    const { hasKey } = await unwrap(api.keychain.has('claude'))
    set({ settings, hasClaudeKey: hasKey, loaded: true })
  },

  acceptConsent: async () => {
    const settings = await unwrap(api.settings.set({ consentAccepted: true }))
    set({ settings })
  },

  setLanguage: async (lang) => {
    const settings = await unwrap(api.settings.set({ language: lang }))
    set({ settings })
  },

  toggleLanguage: async () => {
    const current = get().settings?.language ?? 'en'
    const next: Language = current === 'ko' ? 'en' : 'ko'
    await get().setLanguage(next)
    return next
  },

  saveClaudeKey: async (key: string) => {
    await unwrap(api.keychain.save('claude', key))
    set({ hasClaudeKey: true })
  },

  deleteClaudeKey: async () => {
    await unwrap(api.keychain.delete('claude'))
    set({ hasClaudeKey: false })
  },

  toggleAutoAnalyze: async () => {
    const cur = get().settings?.autoAnalyze ?? false
    const next = !cur
    const updated = await unwrap(api.settings.set({ autoAnalyze: next }))
    set({ settings: updated })
  },

  refreshKeyPresence: async () => {
    const { hasKey } = await unwrap(api.keychain.has('claude'))
    set({ hasClaudeKey: hasKey })
  }
}))
