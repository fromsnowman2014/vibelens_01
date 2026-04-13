import { useCallback, useEffect, useState } from 'react'
import { TitleBar } from './components/layout/TitleBar'
import { ThreePanelLayout } from './components/layout/ThreePanelLayout'
import { StatusBar } from './components/layout/StatusBar'
import { LeftPanel } from './components/left/LeftPanel'
import { CenterPanel } from './components/center/CenterPanel'
import { AIContextPanel } from './components/right/AIContextPanel'
import { WelcomeScreen } from './components/welcome/WelcomeScreen'
import { SettingsModal } from './components/modals/SettingsModal'
import { FirstRunConsentDialog } from './components/modals/FirstRunConsentDialog'
import { GitignoreConsentDialog } from './components/modals/GitignoreConsentDialog'
import { CloneRepoDialog } from './components/modals/CloneRepoDialog'
import { ToastHost, toast, useGlobalErrorToaster } from './components/primitives/Toast'
import { useSettingsStore } from './stores/settingsStore'
import { useRepoStore } from './stores/repoStore'
import { useAnalysisStore } from './stores/analysisStore'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { api, unwrap } from './api/client'

export function App() {
  useGlobalErrorToaster()

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [cloneOpen, setCloneOpen] = useState(false)
  const [gitignoreAsk, setGitignoreAsk] = useState<{ open: boolean; path: string | null }>({
    open: false,
    path: null
  })

  const { settings, loaded, load, acceptConsent, refreshKeyPresence } = useSettingsStore()
  const repoPath = useRepoStore((s) => s.path)
  const selectedHash = useRepoStore((s) => s.selectedCommitHash)
  const language = useSettingsStore((s) => s.settings?.language ?? 'en')
  const analyzeSelected = useAnalysisStore((s) => s.analyzeSelected)
  const prefetchCached = useAnalysisStore((s) => s.prefetchCached)

  const openSettings = useCallback(() => setSettingsOpen(true), [])
  useKeyboardShortcuts({ onOpenSettings: openSettings })

  // Initial load
  useEffect(() => {
    load().catch((e) => {
      toast({
        kind: 'error',
        title: 'Failed to load settings',
        description: e instanceof Error ? e.message : String(e)
      })
    })
  }, [load])

  // Listen for menu events from Electron main process
  useEffect(() => {
    const off1 = api.on('menu:openRepo', () => {
      useRepoStore.getState().openRepo()
    })
    const off2 = api.on('menu:openSettings', () => setSettingsOpen(true))
    const off3 = api.on('menu:toggleLanguage', () => {
      useSettingsStore.getState().toggleLanguage()
    })
    const off4 = api.on('menu:refreshAnalysis', async () => {
      // Refresh commits first, then analyze
      try {
        await useRepoStore.getState().refreshCommits()
        await useAnalysisStore.getState().analyzeSelected(true)
      } catch (e) {
        console.error('Failed to refresh:', e)
      }
    })
    const off5 = api.on('menu:cloneRepo', () => {
      setCloneOpen(true)
    })
    const off6 = api.on('menu:closeRepo', () => {
      useRepoStore.getState().closeRepo()
    })
    return () => {
      off1()
      off2()
      off3()
      off4()
      off5()
      off6()
    }
  }, [])

  // Listen for gitignore ask events from repoStore
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { path: string }
      setGitignoreAsk({ open: true, path: detail.path })
    }
    window.addEventListener('vibelens:ask-gitignore', handler)
    return () => window.removeEventListener('vibelens:ask-gitignore', handler)
  }, [])

  // When a commit is selected, auto-check the cache (and auto-analyze if on)
  useEffect(() => {
    if (!selectedHash) return
    const commit = useRepoStore.getState().commits.find((c) => c.hash === selectedHash)
    if (!commit) return

    // Always attempt to load cached first (cheap)
    prefetchCached(commit).then(() => {
      const key = `${selectedHash}:${language}`
      const st = useAnalysisStore.getState()
      if (st.cache[key]) return

      // Auto-analyze only if consent accepted and auto-analyze enabled and key set
      const s = useSettingsStore.getState()
      if (
        s.settings?.autoAnalyze &&
        s.settings.consentAccepted &&
        s.hasClaudeKey
      ) {
        analyzeSelected(false).catch(() => {})
      }
    })
  }, [selectedHash, language, analyzeSelected, prefetchCached])

  // Refresh key presence when settings modal closes
  useEffect(() => {
    if (!settingsOpen && loaded) {
      refreshKeyPresence().catch(() => {})
    }
  }, [settingsOpen, loaded, refreshKeyPresence])

  if (!loaded) {
    return (
      <div className="h-full flex items-center justify-center text-fg-secondary">
        Loading…
      </div>
    )
  }

  const showConsent = settings && !settings.consentAccepted

  return (
    <div className="flex flex-col h-full text-fg-primary">
      <TitleBar onOpenSettings={openSettings} onClone={() => setCloneOpen(true)} />

      {!repoPath ? (
        <WelcomeScreen
          onOpenSettings={openSettings}
          onOpenClone={() => setCloneOpen(true)}
        />
      ) : (
        <ThreePanelLayout
          left={<LeftPanel />}
          center={<CenterPanel />}
          right={<AIContextPanel onOpenSettings={openSettings} />}
        />
      )}

      <StatusBar />

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <FirstRunConsentDialog
        open={!!showConsent}
        onAccept={async () => {
          await acceptConsent()
          toast({
            kind: 'info',
            title: 'Welcome to VibeLens',
            description: 'Open a repository and set your Claude API key to get started.'
          })
        }}
        onDecline={() => {
          window.close()
        }}
      />

      <GitignoreConsentDialog
        open={gitignoreAsk.open}
        repoPath={gitignoreAsk.path}
        onYes={async () => {
          if (gitignoreAsk.path) {
            try {
              const r = await unwrap(api.cache.addToGitignore(gitignoreAsk.path, false))
              if (r.added) {
                toast({ kind: 'success', title: 'Added .vibelens/ to .gitignore' })
              }
            } catch (e) {
              toast({
                kind: 'error',
                title: 'Failed to update .gitignore',
                description: e instanceof Error ? e.message : String(e)
              })
            }
          }
          setGitignoreAsk({ open: false, path: null })
        }}
        onNo={async () => {
          if (gitignoreAsk.path) {
            try {
              await unwrap(api.cache.addToGitignore(gitignoreAsk.path, true))
            } catch {
              /* noop */
            }
          }
          setGitignoreAsk({ open: false, path: null })
        }}
      />

      <CloneRepoDialog
        open={cloneOpen}
        onClose={() => setCloneOpen(false)}
        onCloned={async (clonedPath) => {
          setCloneOpen(false)
          try {
            await useRepoStore.getState().openRepoByPath(clonedPath)
            toast({ kind: 'success', title: 'Repository cloned and opened', description: clonedPath })
          } catch (e) {
            toast({
              kind: 'error',
              title: 'Failed to open cloned repository',
              description: e instanceof Error ? e.message : String(e)
            })
          }
        }}
      />

      <ToastHost />
    </div>
  )
}
