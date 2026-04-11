import { useEffect } from 'react'
import { useRepoStore } from '@renderer/stores/repoStore'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { useAnalysisStore } from '@renderer/stores/analysisStore'

interface Args {
  onOpenSettings: () => void
}

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true
  return false
}

export function useKeyboardShortcuts({ onOpenSettings }: Args) {
  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      const cmd = e.metaKey || e.ctrlKey
      if (!cmd) return
      // ⌘O — open repo
      if (e.key === 'o' || e.key === 'O') {
        e.preventDefault()
        await useRepoStore.getState().openRepo()
        return
      }
      // ⌘, — settings
      if (e.key === ',') {
        e.preventDefault()
        onOpenSettings()
        return
      }
      // ⌘L — toggle language
      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault()
        await useSettingsStore.getState().toggleLanguage()
        return
      }
      // ⌘R — refresh analysis
      if ((e.key === 'r' || e.key === 'R') && !isEditable(e.target)) {
        e.preventDefault()
        await useAnalysisStore.getState().analyzeSelected(true)
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onOpenSettings])
}
