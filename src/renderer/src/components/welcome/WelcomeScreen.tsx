import { FolderOpen, Download, Settings, Lightbulb } from 'lucide-react'
import { useRepoStore } from '@renderer/stores/repoStore'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { Badge } from '../primitives/Badge'
import { ActionCard } from './ActionCard'
import { RecentReposList } from './RecentReposList'

interface WelcomeScreenProps {
  onOpenSettings: () => void
  onOpenClone: () => void
}

export function WelcomeScreen({ onOpenSettings, onOpenClone }: WelcomeScreenProps) {
  const openRepo = useRepoStore((s) => s.openRepo)
  const openRepoByPath = useRepoStore((s) => s.openRepoByPath)
  const hasClaudeKey = useSettingsStore((s) => s.hasClaudeKey)
  const recentRepos = useSettingsStore((s) => s.settings?.recentRepos ?? [])

  // Platform-specific keyboard shortcut
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const modKey = isMac ? '⌘' : 'Ctrl'

  const handleOpenRepo = () => {
    openRepo()
  }

  const handleCloneRepo = () => {
    onOpenClone()
  }

  const handleSetupApiKey = () => {
    onOpenSettings()
  }

  const handleSelectRepo = (path: string) => {
    openRepoByPath(path)
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-12 py-8 bg-bg-primary overflow-auto">
      <div className="w-full max-w-4xl flex flex-col items-center gap-12 animate-fadeIn">
        {/* Logo and Tagline */}
        <div className="flex flex-col items-center gap-3">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-16 h-16 bg-gradient-to-br from-accent/20 to-accent/5 rounded-2xl flex items-center justify-center border border-accent/30">
              <svg
                className="w-9 h-9 text-accent"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-[32px] font-semibold text-fg-primary tracking-tight">
            VibeLens
          </h1>

          {/* Tagline */}
          <p className="text-[14px] text-fg-secondary text-center max-w-md">
            AI-Powered Git Commit Analysis Tool
          </p>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-3 gap-4 w-full max-w-2xl">
          {/* Open Repository */}
          <ActionCard
            icon={<FolderOpen size={28} strokeWidth={1.5} />}
            title="Open Repository"
            description="Browse and select a local Git repository"
            onClick={handleOpenRepo}
          />

          {/* Clone Repository */}
          <ActionCard
            icon={<Download size={28} strokeWidth={1.5} />}
            title="Clone Repository"
            description="Clone a repository from a remote URL"
            onClick={handleCloneRepo}
          />

          {/* Setup API Key */}
          <ActionCard
            icon={<Settings size={28} strokeWidth={1.5} />}
            title="Setup API Key"
            description="Configure your Claude API key"
            badge={
              hasClaudeKey ? (
                <Badge tone="success" dot>
                  Saved
                </Badge>
              ) : (
                <Badge tone="warning" dot>
                  Required
                </Badge>
              )
            }
            onClick={handleSetupApiKey}
          />
        </div>

        {/* Recent Repositories */}
        <RecentReposList
          repos={recentRepos}
          onSelectRepo={handleSelectRepo}
        />

        {/* Tips */}
        <div className="flex items-center gap-2 text-[12px] text-fg-muted mt-4">
          <Lightbulb size={14} className="opacity-60" />
          <span>
            Tip: Press <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded text-[11px] border border-border">{modKey}+O</kbd> to open a repository
          </span>
        </div>
      </div>
    </div>
  )
}
