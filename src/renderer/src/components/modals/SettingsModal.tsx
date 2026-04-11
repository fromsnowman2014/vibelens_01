import { useState } from 'react'
import { Modal } from './Modal'
import { Button } from '@renderer/components/primitives/Button'
import { Badge } from '@renderer/components/primitives/Badge'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { useRepoStore } from '@renderer/stores/repoStore'
import { useAnalysisStore } from '@renderer/stores/analysisStore'
import { api, unwrap } from '@renderer/api/client'
import { toast } from '@renderer/components/primitives/Toast'
import { KeyRound, Trash2, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { DEFAULT_CLAUDE_MODEL } from '@shared/types'

interface Props {
  open: boolean
  onClose: () => void
}

type Tab = 'keys' | 'analysis' | 'cache' | 'about'

export function SettingsModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('keys')
  const { settings, hasClaudeKey, saveClaudeKey, deleteClaudeKey, setLanguage } =
    useSettingsStore()
  const { path, refreshCachedHashes } = useRepoStore()
  const clearAnalysisCache = useAnalysisStore((s) => s.clearForRepo)

  const [apiKey, setApiKey] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!apiKey.trim()) return
    setSaving(true)
    try {
      await saveClaudeKey(apiKey.trim())
      setApiKey('')
      toast({ kind: 'success', title: 'API key saved to Keychain' })
    } catch (e) {
      toast({
        kind: 'error',
        title: 'Failed to save key',
        description: e instanceof Error ? e.message : String(e)
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const r = await unwrap(api.keychain.test('claude'))
      setTestResult(r)
      if (r.ok) {
        toast({ kind: 'success', title: 'Claude API key works' })
      } else {
        toast({ kind: 'error', title: 'API key test failed', description: r.error })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setTestResult({ ok: false, error: msg })
      toast({ kind: 'error', title: 'API key test failed', description: msg })
    } finally {
      setTesting(false)
    }
  }

  async function handleDelete() {
    try {
      await deleteClaudeKey()
      setTestResult(null)
      toast({ kind: 'info', title: 'API key deleted' })
    } catch (e) {
      toast({
        kind: 'error',
        title: 'Failed to delete key',
        description: e instanceof Error ? e.message : String(e)
      })
    }
  }

  async function handleClearCache() {
    if (!path) return
    try {
      await unwrap(api.cache.clear(path))
      clearAnalysisCache()
      await refreshCachedHashes()
      toast({ kind: 'success', title: 'Cache cleared for this repo' })
    } catch (e) {
      toast({
        kind: 'error',
        title: 'Failed to clear cache',
        description: e instanceof Error ? e.message : String(e)
      })
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Settings" width="max-w-2xl">
      <div className="flex min-h-[420px]">
        <nav className="w-40 flex-shrink-0 border-r border-border p-2">
          {[
            { id: 'keys' as const, label: 'API Keys' },
            { id: 'analysis' as const, label: 'Analysis' },
            { id: 'cache' as const, label: 'Cache' },
            { id: 'about' as const, label: 'About' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`w-full text-left px-2.5 py-1.5 rounded text-[12.5px] ${
                tab === item.id
                  ? 'bg-accent/15 text-accent'
                  : 'text-fg-secondary hover:bg-bg-tertiary'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 p-5 space-y-4">
          {tab === 'keys' && (
            <>
              <div>
                <div className="text-[13px] font-semibold text-fg-primary mb-1 flex items-center gap-2">
                  <KeyRound size={14} /> Anthropic Claude
                </div>
                <div className="text-[12px] text-fg-secondary mb-3">
                  Your API key is stored in the macOS Keychain and never leaves your machine
                  except when making requests to Anthropic.
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11.5px] text-fg-muted">Status:</span>
                  {hasClaudeKey ? (
                    <Badge tone="success" dot>
                      Stored
                    </Badge>
                  ) : (
                    <Badge tone="warning" dot>
                      Not set
                    </Badge>
                  )}
                  {testResult?.ok && (
                    <Badge tone="success">
                      <CheckCircle2 size={10} className="mr-1" />
                      Verified
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    placeholder="sk-ant-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="flex-1 bg-bg-tertiary border border-border rounded px-2.5 py-1.5 text-[12.5px] font-mono text-fg-primary focus:outline-none focus:border-accent"
                  />
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handleSave}
                    loading={saving}
                    disabled={!apiKey.trim()}
                  >
                    Save
                  </Button>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleTest}
                    disabled={!hasClaudeKey}
                    loading={testing}
                  >
                    {testing ? 'Testing…' : 'Test Connection'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleDelete}
                    disabled={!hasClaudeKey}
                  >
                    <Trash2 size={13} /> Delete
                  </Button>
                </div>
                {testResult && !testResult.ok && (
                  <div className="mt-3 p-2.5 rounded bg-state-error/10 border border-state-error/30 text-[12px] text-state-error flex items-start gap-2">
                    <XCircle size={14} className="flex-shrink-0 mt-0.5" />
                    <span className="selectable">{testResult.error}</span>
                  </div>
                )}
                <div className="mt-4 text-[11.5px] text-fg-muted">
                  Get a key at{' '}
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      api.app.openExternal('https://console.anthropic.com/settings/keys')
                    }}
                    className="text-accent hover:text-accent-hover"
                  >
                    console.anthropic.com
                  </a>
                  .
                </div>
              </div>
            </>
          )}

          {tab === 'analysis' && (
            <>
              <div>
                <div className="text-[13px] font-semibold text-fg-primary mb-2">Language</div>
                <div className="flex gap-2">
                  {(['en', 'ko'] as const).map((l) => (
                    <Button
                      key={l}
                      size="sm"
                      variant={settings?.language === l ? 'primary' : 'secondary'}
                      onClick={() => setLanguage(l)}
                    >
                      {l === 'en' ? 'English' : '한국어'}
                    </Button>
                  ))}
                </div>
                <div className="text-[11.5px] text-fg-muted mt-2">
                  Cmd+L toggles the language on the fly.
                </div>
              </div>
              <div className="pt-3 border-t border-border">
                <div className="text-[13px] font-semibold text-fg-primary mb-1">Model</div>
                <div className="text-[12px] text-fg-secondary">
                  Current: <span className="font-mono">{DEFAULT_CLAUDE_MODEL}</span>
                </div>
              </div>
            </>
          )}

          {tab === 'cache' && (
            <>
              <div>
                <div className="text-[13px] font-semibold text-fg-primary mb-2">
                  Analysis cache
                </div>
                <div className="text-[12px] text-fg-secondary mb-3">
                  Analyses are cached per-repo in a <code className="font-mono">.vibelens/</code>{' '}
                  directory so subsequent opens are instant and free. Caches never leave your
                  machine.
                </div>
                {path ? (
                  <>
                    <div className="text-[12px] text-fg-muted mb-2 font-mono truncate">
                      {path}/.vibelens/
                    </div>
                    <Button variant="danger" size="sm" onClick={handleClearCache}>
                      <Trash2 size={13} /> Clear this repo's cache
                    </Button>
                  </>
                ) : (
                  <div className="text-[12px] text-fg-muted">Open a repository first.</div>
                )}
              </div>
            </>
          )}

          {tab === 'about' && (
            <>
              <div>
                <div className="text-[13px] font-semibold text-fg-primary mb-1">VibeLens</div>
                <div className="text-[12px] text-fg-secondary mb-3">
                  Reverse-Prompt Git Analyzer for Vibe Coders.
                </div>
                <div className="text-[11.5px] text-fg-muted space-y-1 selectable">
                  <div>Version 0.1.0 (MVP)</div>
                  <div>Built with Electron · React · Tailwind · Claude</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <footer className="flex justify-end gap-2 p-3 border-t border-border">
        <Button variant="secondary" onClick={onClose}>
          Done
        </Button>
      </footer>
    </Modal>
  )
}
