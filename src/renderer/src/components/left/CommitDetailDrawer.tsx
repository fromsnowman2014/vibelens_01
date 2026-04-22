import { useMemo } from 'react'
import { useRepoStore } from '@renderer/stores/repoStore'
import { useUIStore } from '@renderer/stores/uiStore'
import { Drawer } from '@renderer/components/primitives/Drawer'
import { Button } from '@renderer/components/primitives/Button'
import { parseCommitMessage } from '@renderer/lib/parseCommitMessage'
import { Copy, Check } from 'lucide-react'
import { useState } from 'react'

export function CommitDetailDrawer() {
  const { commitDetailDrawer, closeCommitDetail } = useUIStore()
  const commits = useRepoStore((s) => s.commits)
  const [copiedHash, setCopiedHash] = useState(false)
  const [copiedMessage, setCopiedMessage] = useState(false)

  const commit = useMemo(
    () => commits.find((c) => c.hash === commitDetailDrawer.commitHash),
    [commits, commitDetailDrawer.commitHash]
  )

  const { subject, body, hasBody } = useMemo(
    () => parseCommitMessage(commit?.message || ''),
    [commit?.message]
  )

  const copyToClipboard = async (text: string, type: 'hash' | 'message') => {
    try {
      await navigator.clipboard.writeText(text)
      if (type === 'hash') {
        setCopiedHash(true)
        setTimeout(() => setCopiedHash(false), 2000)
      } else {
        setCopiedMessage(true)
        setTimeout(() => setCopiedMessage(false), 2000)
      }
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)

      if (type === 'hash') {
        setCopiedHash(true)
        setTimeout(() => setCopiedHash(false), 2000)
      } else {
        setCopiedMessage(true)
        setTimeout(() => setCopiedMessage(false), 2000)
      }
    }
  }

  if (!commit) return null

  return (
    <Drawer
      open={commitDetailDrawer.isOpen}
      onOpenChange={(open) => {
        if (!open) closeCommitDetail()
      }}
      title="Commit Details"
    >
      <div className="space-y-6">
        {/* Title Section */}
        <section>
          <h3 className="text-xs font-medium text-fg-muted mb-2 flex items-center gap-1.5">
            <span>📝</span> Title
          </h3>
          <p className="text-sm text-fg-primary leading-relaxed">{subject}</p>
        </section>

        {/* Metadata Section */}
        <section>
          <h3 className="text-xs font-medium text-fg-muted mb-2 flex items-center gap-1.5">
            <span>ℹ️</span> Metadata
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-3">
              <dt className="text-fg-muted w-16 flex-shrink-0">Hash</dt>
              <dd className="text-fg-primary font-mono text-xs flex items-center gap-2">
                <code className="bg-bg-tertiary px-1.5 py-0.5 rounded">{commit.hash}</code>
              </dd>
            </div>
            <div className="flex gap-3">
              <dt className="text-fg-muted w-16 flex-shrink-0">Author</dt>
              <dd className="text-fg-primary">
                {commit.author} <span className="text-fg-muted text-xs">({commit.email})</span>
              </dd>
            </div>
            <div className="flex gap-3">
              <dt className="text-fg-muted w-16 flex-shrink-0">Date</dt>
              <dd className="text-fg-primary">
                {commit.relativeDate}
                <span className="text-fg-muted text-xs ml-2">({new Date(commit.date).toLocaleString()})</span>
              </dd>
            </div>
          </dl>
        </section>

        {/* Message Body Section */}
        {hasBody && (
          <section>
            <h3 className="text-xs font-medium text-fg-muted mb-2 flex items-center gap-1.5">
              <span>📄</span> Message
            </h3>
            <pre className="text-sm text-fg-primary whitespace-pre-wrap leading-relaxed bg-bg-tertiary/50 p-3 rounded-lg border border-border">
              {body}
            </pre>
          </section>
        )}

        {!hasBody && (
          <section>
            <h3 className="text-xs font-medium text-fg-muted mb-2 flex items-center gap-1.5">
              <span>📄</span> Message
            </h3>
            <p className="text-sm text-fg-muted italic">(No additional message)</p>
          </section>
        )}

        {/* Actions Section */}
        <section className="flex gap-2 pt-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => copyToClipboard(commit.hash, 'hash')}
            className="flex items-center gap-1.5"
          >
            {copiedHash ? <Check size={14} /> : <Copy size={14} />}
            {copiedHash ? 'Copied!' : 'Copy Hash'}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => copyToClipboard(commit.message, 'message')}
            className="flex items-center gap-1.5"
          >
            {copiedMessage ? <Check size={14} /> : <Copy size={14} />}
            {copiedMessage ? 'Copied!' : 'Copy Message'}
          </Button>
        </section>
      </div>
    </Drawer>
  )
}
