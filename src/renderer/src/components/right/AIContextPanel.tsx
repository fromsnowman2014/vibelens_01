import { useState, useEffect, useRef } from 'react'
import { Panel } from '@renderer/components/primitives/Panel'
import { useRepoStore } from '@renderer/stores/repoStore'
import { useAnalysisStore } from '@renderer/stores/analysisStore'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { useWebAppStore } from '@renderer/stores/webappStore'
import { Button } from '@renderer/components/primitives/Button'
import { Badge } from '@renderer/components/primitives/Badge'
import { Skeleton } from '@renderer/components/primitives/Skeleton'
import { EmptyState } from '@renderer/components/primitives/EmptyState'
import { AIChatbox } from './AIChatbox'
import { WebAppStatus } from './WebAppStatus'
import { WebAppLog } from './WebAppLog'
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
  MessageSquare,
  Lock,
  Check,
  CheckCircle2,
  Settings,
  ChevronDown,
  Monitor,
  ScrollText
} from 'lucide-react'
import { toast } from '@renderer/components/primitives/Toast'
import { LLM_MODELS } from '@shared/types'
import type { ProviderId } from '@shared/types'

interface Props {
  onOpenSettings: () => void
}

type PanelTab = 'analysis' | 'chat' | 'status' | 'log'

// ModelSelector: Custom dropdown for selecting LLM models with API key status
function ModelSelector({
  activeModel,
  providerKeyStatus,
  onModelChange,
  onOpenSettings
}: {
  activeModel: string
  providerKeyStatus: Record<ProviderId, boolean>
  onModelChange: (modelId: string) => void
  onOpenSettings: (provider?: ProviderId) => void
}) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const allModels = Object.entries(LLM_MODELS).flatMap(([provider, models]) =>
    models.map((m) => ({ ...m, provider: provider as ProviderId }))
  )

  const currentModel = allModels.find(m => m.id === activeModel)
  const hasKey = (provider: ProviderId) => providerKeyStatus[provider]

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return

    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="bg-bg-tertiary border border-border rounded px-1.5 py-0.5 text-[10.5px] text-fg-secondary font-mono cursor-pointer hover:border-accent transition-colors max-w-[150px] truncate flex items-center gap-1"
        title={`Current model: ${currentModel?.name}`}
      >
        <span className="truncate">{currentModel?.name}</span>
        {currentModel && hasKey(currentModel.provider) ? (
          <CheckCircle2 size={10} className="text-state-success flex-shrink-0" />
        ) : (
          <Lock size={10} className="text-state-warning flex-shrink-0" />
        )}
        <ChevronDown size={10} className="flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 bg-bg-elevated border border-border-strong rounded shadow-lg py-1 z-50 min-w-[200px] max-h-[300px] overflow-y-auto">
          {Object.entries(LLM_MODELS).map(([provider, models]) => (
            <div key={provider}>
              <div className="px-2 py-1 text-[10px] text-fg-muted uppercase font-semibold tracking-wide">
                {provider}
              </div>
              {models.map((m) => {
                const available = hasKey(provider as ProviderId)
                const isActive = m.id === activeModel

                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      if (available) {
                        onModelChange(m.id)
                        setOpen(false)
                      } else {
                        // Unavailable model clicked: Open settings with toast
                        onOpenSettings(provider as ProviderId)
                        setOpen(false)
                        toast({
                          kind: 'info',
                          title: `${provider.charAt(0).toUpperCase() + provider.slice(1)} API key required`,
                          description: `Please add your ${provider.charAt(0).toUpperCase() + provider.slice(1)} API key to use ${m.name}`
                        })
                      }
                    }}
                    className={`w-full text-left px-3 py-1.5 text-[11.5px] flex items-center justify-between transition-colors ${
                      isActive
                        ? 'bg-accent/15 text-accent'
                        : available
                        ? 'text-fg-primary hover:bg-bg-tertiary cursor-pointer'
                        : 'text-fg-muted opacity-70 hover:opacity-100 hover:bg-bg-tertiary/50 cursor-pointer'
                    }`}
                    title={
                      !available
                        ? `Click to setup ${provider.charAt(0).toUpperCase() + provider.slice(1)} API key`
                        : undefined
                    }
                  >
                    <span className="flex items-center gap-1.5">
                      {!available && <Lock size={11} className="flex-shrink-0" />}
                      {m.name}
                    </span>

                    <div className="flex items-center gap-2">
                      {!available && (
                        <span className="text-accent text-[10px] px-1.5 py-0.5 rounded bg-bg-tertiary flex items-center gap-0.5">
                          <Settings size={10} /> Setup
                        </span>
                      )}
                      {isActive && <Check size={12} className="text-accent flex-shrink-0" />}
                    </div>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function AIContextPanel({ onOpenSettings }: Props) {
  const [tab, setTab] = useState<PanelTab>('analysis')
  const selectedHash = useRepoStore((s) => s.selectedCommitHash)
  const commits = useRepoStore((s) => s.commits)
  const path = useRepoStore((s) => s.path)
  const language = useSettingsStore((s) => s.settings?.language ?? 'en')
  const autoAnalyze = useSettingsStore((s) => s.settings?.autoAnalyze ?? false)
  const hasKey = useSettingsStore((s) => s.hasClaudeKey)
  const providerKeyStatus = useSettingsStore((s) => s.providerKeyStatus)
  const toggleLanguage = useSettingsStore((s) => s.toggleLanguage)
  const toggleAutoAnalyze = useSettingsStore((s) => s.toggleAutoAnalyze)
  const activeProvider = useSettingsStore((s) => s.settings?.activeProvider ?? 'claude')
  const activeModel = useSettingsStore((s) => s.settings?.activeModel ?? 'claude-sonnet-4-5')
  const { cache, status, errors, analyzeSelected } = useAnalysisStore()
  const { shouldAutoSwitchToLog, resetAutoSwitchFlags } = useWebAppStore()

  // Auto-switch to log tab when webapp starts
  useEffect(() => {
    if (shouldAutoSwitchToLog) {
      setTab('log')
      resetAutoSwitchFlags()
    }
  }, [shouldAutoSwitchToLog, resetAutoSwitchFlags])

  const commit = commits.find((c) => c.hash === selectedHash)
  const key = selectedHash ? `${selectedHash}:${language}` : ''
  const st = key ? status[key] : undefined
  const result = key ? cache[key] : undefined
  const err = key ? errors[key] : undefined

  const handleModelChange = async (modelId: string) => {
    const allModels = Object.entries(LLM_MODELS).flatMap(([provider, models]) =>
      models.map((m) => ({ ...m, provider: provider as ProviderId }))
    )
    const model = allModels.find((m) => m.id === modelId)
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
        <button
          onClick={() => setTab('status')}
          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 ${tab === 'status'
              ? 'bg-bg-primary text-fg-primary shadow-sm'
              : 'text-fg-muted hover:text-fg-secondary'
            }`}
        >
          <Monitor size={10} />
          Status
        </button>
        <button
          onClick={() => setTab('log')}
          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 ${tab === 'log'
              ? 'bg-bg-primary text-fg-primary shadow-sm'
              : 'text-fg-muted hover:text-fg-secondary'
            }`}
        >
          <ScrollText size={10} />
          Log
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
      <ModelSelector
        activeModel={activeModel}
        providerKeyStatus={providerKeyStatus}
        onModelChange={handleModelChange}
        onOpenSettings={onOpenSettings}
      />

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

  // Status tab body
  if (tab === 'status') {
    return (
      <Panel title={header} rightSlot={actions} bodyClassName="p-0">
        <WebAppStatus />
      </Panel>
    )
  }

  // Log tab body
  if (tab === 'log') {
    return (
      <Panel title={header} rightSlot={actions} bodyClassName="p-0">
        <WebAppLog />
      </Panel>
    )
  }

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
