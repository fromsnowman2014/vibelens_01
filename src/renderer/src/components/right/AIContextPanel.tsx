import { useState } from 'react'
import { Panel } from '@renderer/components/primitives/Panel'
import { useRepoStore } from '@renderer/stores/repoStore'
import { useAnalysisStore } from '@renderer/stores/analysisStore'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { Button } from '@renderer/components/primitives/Button'
import { Badge } from '@renderer/components/primitives/Badge'
import { Skeleton } from '@renderer/components/primitives/Skeleton'
import { EmptyState } from '@renderer/components/primitives/EmptyState'
import { AIChatbox } from './AIChatbox'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Brain,
  RefreshCw,
  Copy,
  Languages,
  KeyRound,
  AlertCircle,
  Sparkles,
  MessageSquare
} from 'lucide-react'
import { toast } from '@renderer/components/primitives/Toast'
import { LLM_MODELS } from '@shared/types'
import type { ProviderId } from '@shared/types'

interface Props {
  onOpenSettings: () => void
}

type PanelTab = 'analysis' | 'chat'

export function AIContextPanel({ onOpenSettings }: Props) {
  const [tab, setTab] = useState<PanelTab>('analysis')
  const selectedHash = useRepoStore((s) => s.selectedCommitHash)
  const commits = useRepoStore((s) => s.commits)
  const path = useRepoStore((s) => s.path)
  const language = useSettingsStore((s) => s.settings?.language ?? 'en')
  const autoAnalyze = useSettingsStore((s) => s.settings?.autoAnalyze ?? false)
  const hasKey = useSettingsStore((s) => s.hasClaudeKey)
  const toggleLanguage = useSettingsStore((s) => s.toggleLanguage)
  const toggleAutoAnalyze = useSettingsStore((s) => s.toggleAutoAnalyze)
  const activeProvider = useSettingsStore((s) => s.settings?.activeProvider ?? 'claude')
  const activeModel = useSettingsStore((s) => s.settings?.activeModel ?? 'claude-sonnet-4-5')
  const { cache, status, errors, analyzeSelected } = useAnalysisStore()

  const commit = commits.find((c) => c.hash === selectedHash)
  const key = selectedHash ? `${selectedHash}:${language}` : ''
  const st = key ? status[key] : undefined
  const result = key ? cache[key] : undefined
  const err = key ? errors[key] : undefined

  // Build flat model list for dropdown
  const allModels = Object.entries(LLM_MODELS).flatMap(([provider, models]) =>
    models.map((m) => ({ ...m, provider: provider as ProviderId }))
  )

  const handleModelChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value
    const model = allModels.find((m) => m.id === selectedId)
    if (model) {
      const { api } = await import('@renderer/api/client')
      const { unwrap } = await import('@renderer/api/client')
      await unwrap(
        api.settings.set({
          activeProvider: model.provider,
          activeModel: model.id
        })
      )
      useSettingsStore.getState().load()
    }
  }

  const header = (
    <>
      <Brain size={13} />
      {/* Tab Switcher */}
      <div className="flex gap-0.5 bg-bg-tertiary rounded p-0.5">
        <button
          onClick={() => setTab('analysis')}
          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${tab === 'analysis'
              ? 'bg-bg-primary text-fg-primary shadow-sm'
              : 'text-fg-muted hover:text-fg-secondary'
            }`}
        >
          Analysis
        </button>
        <button
          onClick={() => setTab('chat')}
          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 ${tab === 'chat'
              ? 'bg-bg-primary text-fg-primary shadow-sm'
              : 'text-fg-muted hover:text-fg-secondary'
            }`}
        >
          <MessageSquare size={10} />
          Chat
        </button>
      </div>
      {tab === 'analysis' && result?.unparsed && (
        <Badge tone="warning" title="Model returned unstructured output">
          unparsed
        </Badge>
      )}
      {tab === 'analysis' && result && !result.unparsed && (
        <Badge tone="success" dot>
          cached
        </Badge>
      )}
    </>
  )

  const actions = (
    <>
      {/* Model Selector Dropdown */}
      <select
        value={activeModel}
        onChange={handleModelChange}
        className="bg-bg-tertiary border border-border rounded px-1.5 py-0.5 text-[10.5px] text-fg-secondary font-mono cursor-pointer focus:outline-none focus:border-accent transition-colors max-w-[130px] truncate"
        title="Select AI model"
      >
        {Object.entries(LLM_MODELS).map(([provider, models]) => (
          <optgroup key={provider} label={provider.charAt(0).toUpperCase() + provider.slice(1)}>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {tab === 'analysis' && (
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
        </>
      )}
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

  // Chat tab body
  if (tab === 'chat') {
    if (!hasKey) {
      return (
        <Panel title={header} rightSlot={actions} bodyClassName="p-0">
          <EmptyState
            icon={<KeyRound size={28} />}
            title="API key required"
            description="Set your Claude API key to use AI Chat."
            action={
              <Button variant="primary" size="sm" onClick={onOpenSettings}>
                Open Settings
              </Button>
            }
          />
        </Panel>
      )
    }

    return (
      <Panel title={header} rightSlot={actions} bodyClassName="p-0">
        <AIChatbox />
      </Panel>
    )
  }

  // Analysis tab body
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
      <div className="p-4 space-y-4">
        {/* Metadata Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="info">{result.model}</Badge>
          <Badge tone="neutral">{result.language.toUpperCase()}</Badge>
          <Badge tone="neutral">
            {result.tokensIn + result.tokensOut} tokens
          </Badge>
        </div>

        {/* 🆕 Estimated Prompt Card - Highest Priority */}
        {result.estimatedPrompt && (
          <div className="bg-gradient-to-r from-accent/10 to-bg-tertiary border-l-4 border-accent p-4 rounded-lg shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={16} className="text-accent" />
              <h3 className="text-sm font-bold text-fg-primary">
                Estimated Prompt
              </h3>
            </div>
            <blockquote className="text-base italic text-fg-primary border-l-2 border-accent pl-3 mb-3">
              "{result.estimatedPrompt.primary}"
            </blockquote>
            <p className="text-xs text-fg-muted leading-relaxed">
              {result.estimatedPrompt.reasoning}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => {
                navigator.clipboard.writeText(result.estimatedPrompt!.primary)
                toast({ kind: 'success', title: 'Prompt copied!' })
              }}
            >
              <Copy size={12} className="mr-1" />
              Copy Prompt
            </Button>
          </div>
        )}

        {/* Main Analysis Content */}
        <div className="ai-prose selectable">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.rawMarkdown}</ReactMarkdown>
        </div>
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
