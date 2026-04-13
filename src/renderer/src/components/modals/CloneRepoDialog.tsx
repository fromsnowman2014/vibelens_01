import { useState, useCallback, useEffect } from 'react'
import { Modal } from './Modal'
import { Button } from '@renderer/components/primitives/Button'
import { Spinner } from '@renderer/components/primitives/Spinner'
import { api, unwrap } from '@renderer/api/client'
import { FolderOpen, Download } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  onCloned: (path: string) => void
}

function extractRepoName(url: string): string {
  try {
    const cleaned = url.trim().replace(/\.git$/, '').replace(/\/$/, '')
    const parts = cleaned.split('/')
    return parts[parts.length - 1] || ''
  } catch {
    return ''
  }
}

function validateGitUrl(url: string): { valid: boolean; error?: string } {
  const trimmed = url.trim()

  if (!trimmed) {
    return { valid: false, error: 'URL cannot be empty' }
  }

  // GitHub HTTPS
  if (/^https:\/\/github\.com\/[\w-]+\/[\w.-]+(?:\.git)?$/.test(trimmed)) {
    return { valid: true }
  }

  // GitHub SSH
  if (/^git@github\.com:[\w-]+\/[\w.-]+(?:\.git)?$/.test(trimmed)) {
    return { valid: true }
  }

  // GitLab HTTPS
  if (/^https:\/\/gitlab\.com\/[\w-]+\/[\w.-]+(?:\.git)?$/.test(trimmed)) {
    return { valid: true }
  }

  // GitLab SSH
  if (/^git@gitlab\.com:[\w-]+\/[\w.-]+(?:\.git)?$/.test(trimmed)) {
    return { valid: true }
  }

  // Generic Git HTTPS
  if (/^https:\/\/[\w.-]+\/[\w-]+\/[\w.-]+(?:\.git)?$/.test(trimmed)) {
    return { valid: true }
  }

  // Generic Git SSH
  if (/^git@[\w.-]+:[\w-]+\/[\w.-]+(?:\.git)?$/.test(trimmed)) {
    return { valid: true }
  }

  return {
    valid: false,
    error: 'Invalid Git URL. Use HTTPS (https://...) or SSH (git@...) format.'
  }
}

export function CloneRepoDialog({ open, onClose, onCloned }: Props) {
  const [url, setUrl] = useState('')
  const [destDir, setDestDir] = useState('')
  const [cloning, setCloning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setUrl('')
      setDestDir('')
      setCloning(false)
      setError(null)
    }
  }, [open])

  const repoName = extractRepoName(url)
  const fullDest = destDir && repoName ? `${destDir}/${repoName}` : destDir

  const handleBrowse = useCallback(async () => {
    try {
      const selected = await unwrap(api.repo.selectDirectory())
      if (selected) {
        setDestDir(selected)
        setError(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  const handleClone = useCallback(async () => {
    if (!url.trim() || !fullDest) return

    // Validate URL first
    const validation = validateGitUrl(url)
    if (!validation.valid) {
      setError(validation.error || 'Invalid URL')
      return
    }

    setCloning(true)
    setError(null)
    try {
      const result = await unwrap(api.repo.clone(url.trim(), fullDest))
      onCloned(result.path)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // Provide more user-friendly error messages
      if (msg.includes('ENOENT') || msg.includes('not found')) {
        setError('Repository not found. Check the URL and try again.')
      } else if (msg.includes('EACCES') || msg.includes('permission')) {
        setError('Permission denied. Check your access rights or try using SSH.')
      } else if (msg.includes('already exists')) {
        setError('Directory already exists. Choose a different location.')
      } else if (msg.includes('Authentication') || msg.includes('credentials')) {
        setError('Authentication required. Try using SSH or check your credentials.')
      } else {
        setError(msg)
      }
    } finally {
      setCloning(false)
    }
  }, [url, fullDest, onCloned])

  const validation = validateGitUrl(url)
  const canClone = validation.valid && fullDest.length > 0 && !cloning

  return (
    <Modal open={open} onClose={cloning ? () => {} : onClose} title="Clone Repository">
      <div className="space-y-4 min-w-[440px]">
        {/* URL Input */}
        <div>
          <label className="block text-xs text-fg-secondary mb-1.5">Repository URL</label>
          <input
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setError(null)
            }}
            placeholder="https://github.com/user/repo.git"
            className={`w-full px-3 py-2 rounded-md bg-bg-secondary border text-fg-primary text-sm placeholder:text-fg-muted focus:outline-none focus:border-accent-primary ${
              url && !validation.valid
                ? 'border-state-warning'
                : 'border-border'
            }`}
            disabled={cloning}
            autoFocus
          />
          {url && !validation.valid && (
            <p className="text-xs text-state-warning mt-1">{validation.error}</p>
          )}
        </div>

        {/* Destination Directory */}
        <div>
          <label className="block text-xs text-fg-secondary mb-1.5">Clone to</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={fullDest || destDir}
              readOnly
              placeholder="Select a directory..."
              className="flex-1 px-3 py-2 rounded-md bg-bg-secondary border border-border text-fg-primary text-sm placeholder:text-fg-muted focus:outline-none cursor-default"
            />
            <Button size="sm" variant="secondary" onClick={handleBrowse} disabled={cloning}>
              <FolderOpen size={14} />
              Browse
            </Button>
          </div>
          {repoName && destDir && (
            <p className="text-xs text-fg-muted mt-1">
              Will clone into: <span className="text-fg-secondary">{fullDest}</span>
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-3 py-2 rounded-md bg-state-error/10 border border-state-error/30 text-state-error text-xs">
            {error}
          </div>
        )}

        {/* Progress */}
        {cloning && (
          <div className="flex items-center gap-2 text-xs text-fg-secondary">
            <Spinner size={14} />
            <span>Cloning repository... this may take a moment.</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="ghost" onClick={onClose} disabled={cloning}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" onClick={handleClone} disabled={!canClone}>
            <Download size={14} />
            {cloning ? 'Cloning...' : 'Clone'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
