import { Settings as SettingsIcon, FolderOpen, Download, Languages, Sparkles } from 'lucide-react'
import { useRepoStore } from '@renderer/stores/repoStore'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { Button } from '@renderer/components/primitives/Button'
import { Badge } from '@renderer/components/primitives/Badge'

interface Props {
  onOpenSettings: () => void
  onClone: () => void
}

export function TitleBar({ onOpenSettings, onClone }: Props) {
  const { name, path, branches, currentBranch, switchBranch } = useRepoStore()
  const { settings, toggleLanguage, hasClaudeKey } = useSettingsStore()
  const openRepo = useRepoStore((s) => s.openRepo)

  return (
    <div className="drag-region h-11 flex-shrink-0 flex items-center justify-between gap-3 px-2 pl-[84px] border-b border-border bg-bg-secondary/60 backdrop-blur">
      <div className="flex items-center gap-2 min-w-0">
        <Sparkles size={14} className="text-accent" />
        <span className="font-semibold text-fg-primary text-[13px]">VibeLens</span>
        <span className="text-fg-muted text-[12px]">—</span>
        <span className="text-fg-secondary text-[12px] truncate" title={path ?? ''}>
          {name ?? 'No repository opened'}
        </span>
        {branches && branches.all.length > 0 && (
          <div className="no-drag ml-2 flex items-center gap-1">
            <span className="text-fg-muted text-[11px]">branch:</span>
            <select
              value={currentBranch ?? branches.current}
              onChange={(e) => switchBranch(e.target.value)}
              className="bg-bg-tertiary text-fg-primary border border-border rounded px-1.5 py-0.5 text-[12px] focus:outline-none focus:border-accent"
            >
              {branches.all.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="no-drag flex items-center gap-1.5">
        {!hasClaudeKey && (
          <Badge tone="warning" title="API Key not set">
            No API Key
          </Badge>
        )}
        <Badge tone="info" title="Analysis language">
          {settings?.language?.toUpperCase() ?? 'EN'}
        </Badge>
        <Button size="sm" variant="ghost" onClick={toggleLanguage} title="⌘L">
          <Languages size={14} />
        </Button>
        <Button size="sm" variant="ghost" onClick={openRepo} title="⌘O">
          <FolderOpen size={14} />
          <span>Open</span>
        </Button>
        <Button size="sm" variant="ghost" onClick={onClone} title="Clone from URL">
          <Download size={14} />
          <span>Clone</span>
        </Button>
        <Button size="sm" variant="ghost" onClick={onOpenSettings} title="⌘,">
          <SettingsIcon size={14} />
        </Button>
      </div>
    </div>
  )
}
