import { Panel } from '@renderer/components/primitives/Panel'
import { useRepoStore } from '@renderer/stores/repoStore'
import { useAnalysisStore } from '@renderer/stores/analysisStore'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { Button } from '@renderer/components/primitives/Button'
import { Badge } from '@renderer/components/primitives/Badge'
import { Skeleton } from '@renderer/components/primitives/Skeleton'
import { EmptyState } from '@renderer/components/primitives/EmptyState'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Brain,
  RefreshCw,
  Copy,
  Languages,
  KeyRound,
  AlertCircle,
  Sparkles
} from 'lucide-react'
import { toast } from '@renderer/components/primitives/Toast'

interface Props {
  onOpenSettings: () => void
}

export function AIContextPanel({ onOpenSettings }: Props) {
  const selectedHash = useRepoStore((s) => s.selectedCommitHash)
  const commits = useRepoStore((s) => s.commits)
  const path = useRepoStore((s) => s.path)
  const language = useSettingsStore((s) => s.settings?.language ?? 'en')
  const autoAnalyze = useSettingsStore((s) => s.settings?.autoAnalyze ?? false)
  const hasKey = useSettingsStore((s) => s.hasClaudeKey)
  const toggleLanguage = useSettingsStore((s) => s.toggleLanguage)
  const toggleAutoAnalyze = useSettingsStore((s) => s.toggleAutoAnalyze)
  const { cache, status, errors, analyzeSelected } = useAnalysisStore()

  const commit = commits.find((c) => c.hash === selectedHash)
  const key = selectedHash ? `${selectedHash}:${language}` : ''
  const st = key ? status[key] : undefined
  const result = key ? cache[key] : undefined
  const err = key ? errors[key] : undefined

  const header = (
    <>
      <Brain size={13} />
      <span>AI Analysis</span>
      {result?.unparsed && (
        <Badge tone="warning" title="Model returned unstructured output">
          unparsed
        </Badge>
      )}
      {result && !result.unparsed && (
        <Badge tone="success" dot>
          cached
        </Badge>
      )}
    </>
  )

  const actions = (
    <>
      <label className="flex items-center gap-1.5 text-xs text-fg-secondary cursor-pointer mr-1" title="Auto-analyze on commit select">
        <input
          type="checkbox"
          checked={autoAnalyze}
          onChange={() => toggleAutoAnalyze()}
          className="accent-accent-primary w-3.5 h-3.5 cursor-pointer"
        />
        Auto
      </label>
      <Button
        size="sm"
        variant="ghost"
        disabled={!commit || !hasKey}
        onClick={() => analyzeSelected(true)}
        title="Re-analyze (⌘R)"
      >
        <RefreshCw size={13} />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={!result}
        onClick={() => {
          if (result) {
            navigator.clipboard.writeText(result.rawMarkdown)
            toast({ kind: 'success', title: 'Copied analysis to clipboard' })
          }
        }}
        title="Copy markdown"
      >
        <Copy size={13} />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={toggleLanguage}
        title="Toggle language (⌘L)"
      >
        <Languages size={13} />
      </Button>
    </>
  )

  let body: React.ReactNode

  if (!path || !commit) {
    body = (
      <EmptyState
        icon={<Sparkles size={28} />}
        title="No commit selected"
        description="Open a repository and select a commit to reverse-engineer its prompt."
      />
    )
  } else if (!hasKey) {
    body = (
      <EmptyState
        icon={<KeyRound size={28} />}
        title="Claude API key required"
        description="VibeLens uses the Anthropic Claude API to reverse-prompt each commit. Your key is stored securely in the macOS Keychain."
        action={
          <Button variant="primary" size="sm" onClick={onOpenSettings}>
            Open Settings
          </Button>
        }
      />
    )
  } else if (st === 'loading') {
    body = (
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
        <div className="pt-2">
          <Skeleton className="h-4 w-32" />
          <div className="mt-2 space-y-1.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      </div>
    )
  } else if (st === 'error' && err) {
    body = (
      <EmptyState
        icon={<AlertCircle size={28} className="text-state-error" />}
        title="Analysis failed"
        description={err}
        action={
          <Button variant="primary" size="sm" onClick={() => analyzeSelected(true)}>
            Try again
          </Button>
        }
      />
    )
  } else if (result) {
    body = (
      <div className="p-4 ai-prose selectable">
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <Badge tone="info">{result.model}</Badge>
          <Badge tone="neutral">{result.language.toUpperCase()}</Badge>
          <Badge tone="neutral">
            {result.tokensIn + result.tokensOut} tokens
          </Badge>
        </div>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.rawMarkdown}</ReactMarkdown>
      </div>
    )
  } else {
    body = (
      <EmptyState
        icon={<Brain size={28} />}
        title="Ready to analyze"
        description={
          <>
            Click <span className="text-fg-primary font-medium">Analyze</span> to have Claude
            reverse-engineer the prompt that likely produced this commit.
          </>
        }
        action={
          <Button variant="primary" size="sm" onClick={() => analyzeSelected(false)}>
            Analyze commit
          </Button>
        }
      />
    )
  }

  return (
    <Panel title={header} rightSlot={actions} bodyClassName="p-0">
      {body}
    </Panel>
  )
}
