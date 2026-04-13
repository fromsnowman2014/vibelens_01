import { useEffect, useRef, useCallback } from 'react'
import { useRepoStore } from '@renderer/stores/repoStore'
import { useAnalysisStore } from '@renderer/stores/analysisStore'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { cx } from '@renderer/lib/cx'
import { Skeleton } from '@renderer/components/primitives/Skeleton'
import { EmptyState } from '@renderer/components/primitives/EmptyState'
import { FolderOpen, GitCommit, Search } from 'lucide-react'
import { Button } from '@renderer/components/primitives/Button'
import type { Commit } from '@shared/types'

interface Props {
  onArrowNav?: (dir: -1 | 1) => void
  filteredCommits?: Commit[]
}

function CacheDot({ hash }: { hash: string }) {
  const cachedHashes = useRepoStore((s) => s.cachedHashes)
  const status = useAnalysisStore((s) => s.status)
  const language = useSettingsStore((s) => s.settings?.language ?? 'en')
  const isCached = cachedHashes.has(hash)
  const key = `${hash}:${language}`
  const st = status[key]
  let tone: 'success' | 'info' | 'error' | 'neutral' = 'neutral'
  if (st === 'loading') tone = 'info'
  else if (st === 'error') tone = 'error'
  else if (isCached || st === 'done') tone = 'success'

  const dotClass = {
    neutral: 'bg-fg-muted',
    success: 'bg-state-success',
    info: 'bg-accent animate-pulse',
    error: 'bg-state-error'
  }[tone]

  return (
    <span
      className={cx('flex-shrink-0 w-2 h-2 rounded-full', dotClass)}
      title={
        st === 'loading'
          ? 'Analyzing…'
          : st === 'error'
            ? 'Error'
            : isCached
              ? 'Cached'
              : 'Not analyzed'
      }
    />
  )
}

function CommitRow({ commit, selected, onClick }: { commit: Commit; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'w-full text-left px-3 py-2 border-l-2 flex items-start gap-2.5 transition-colors',
        selected
          ? 'bg-accent/10 border-accent'
          : 'border-transparent hover:bg-bg-elevated hover:border-border-strong'
      )}
    >
      <CacheDot hash={commit.hash} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <code className="text-[11px] text-fg-muted font-mono">{commit.shortHash}</code>
          <span className="text-[11px] text-fg-muted">{commit.relativeDate}</span>
        </div>
        <div className="text-[12.5px] text-fg-primary truncate mt-0.5">
          {commit.subject}
        </div>
        <div className="text-[11px] text-fg-muted truncate mt-0.5">
          {commit.author}
        </div>
      </div>
    </button>
  )
}

export function CommitTimeline({ onArrowNav, filteredCommits }: Props) {
  const { commits, commitsLoading, commitsHasMore, selectedCommitHash, selectCommit, loadCommits, path } =
    useRepoStore()
  const openRepo = useRepoStore((s) => s.openRepo)
  const scrollRef = useRef<HTMLDivElement>(null)
  const displayCommits = filteredCommits ?? commits

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    if (commitsLoading || !commitsHasMore) return
    if (el.scrollTop + el.clientHeight > el.scrollHeight - 200) {
      loadCommits(false).catch(() => {})
    }
  }, [commitsLoading, commitsHasMore, loadCommits])

  // Arrow nav listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!path || commits.length === 0) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const idx = commits.findIndex((c) => c.hash === selectedCommitHash)
        const nextIdx =
          e.key === 'ArrowDown'
            ? Math.min(commits.length - 1, idx + 1)
            : Math.max(0, idx - 1)
        if (nextIdx !== idx && commits[nextIdx]) {
          selectCommit(commits[nextIdx].hash).catch(() => {})
          onArrowNav?.(e.key === 'ArrowDown' ? 1 : -1)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [commits, selectedCommitHash, selectCommit, onArrowNav, path])

  if (!path) {
    return (
      <EmptyState
        icon={<FolderOpen size={32} />}
        title="No repository opened"
        description="Open a Git repository to browse its commit history and reverse-engineer the prompts behind each commit."
        action={
          <Button variant="primary" size="sm" onClick={openRepo}>
            Open Repository
          </Button>
        }
      />
    )
  }

  if (commitsLoading && commits.length === 0) {
    return (
      <div className="p-3 space-y-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex items-start gap-2">
            <Skeleton className="w-2 h-2 mt-2 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (commits.length === 0) {
    return (
      <EmptyState
        icon={<GitCommit size={28} />}
        title="No commits on this branch"
        description="This branch has no commits yet. Try switching to another branch."
      />
    )
  }

  return (
    <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-auto">
      {filteredCommits !== undefined && filteredCommits.length === 0 ? (
        <EmptyState
          icon={<Search size={24} />}
          title="No matching commits"
          description="Try a different search query."
        />
      ) : (
        <>
          <div className="divide-y divide-border/60">
            {displayCommits.map((c) => (
              <CommitRow
                key={c.hash}
                commit={c}
                selected={c.hash === selectedCommitHash}
                onClick={() => selectCommit(c.hash).catch(() => {})}
              />
            ))}
          </div>
          {commitsHasMore && !filteredCommits && (
            <div className="p-3 text-center text-[11px] text-fg-muted">
              {commitsLoading ? 'Loading more…' : 'Scroll for more'}
            </div>
          )}
        </>
      )}
    </div>
  )
}
