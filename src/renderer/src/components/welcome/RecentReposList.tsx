import { cx } from '@renderer/lib/cx'
import type { RecentRepo } from '@shared/types'

interface RecentReposListProps {
  repos: RecentRepo[]
  onSelectRepo: (path: string) => void
  onViewAll?: () => void
}

/** Format a timestamp into a human-friendly relative string */
function formatRelativeTime(timestamp?: number): string {
  if (!timestamp) return ''
  const now = Date.now()
  const diffMs = now - timestamp
  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return new Date(timestamp).toLocaleDateString()
}

/** Shorten paths by replacing home directory with ~ */
function shortenPath(fullPath: string): string {
  const home = navigator.platform.toUpperCase().includes('MAC')
    ? `/Users/${fullPath.split('/')[2] ?? ''}`
    : fullPath.split('/').slice(0, 3).join('/')
  if (fullPath.startsWith(home)) {
    return '~' + fullPath.slice(home.length)
  }
  return fullPath
}

export function RecentReposList({ repos, onSelectRepo, onViewAll }: RecentReposListProps) {
  if (repos.length === 0) {
    return null
  }

  // Sort by lastOpened descending (most recent first)
  const sorted = [...repos].sort((a, b) => (b.lastOpened ?? 0) - (a.lastOpened ?? 0))
  const displayRepos = sorted.slice(0, 5)

  return (
    <div className="w-full max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-[13px] font-medium text-fg-secondary">Recent Repositories</h3>
        {repos.length > 5 && onViewAll && (
          <button
            onClick={onViewAll}
            className="text-[12px] text-accent hover:text-accent-hover transition-colors"
          >
            View all ({repos.length}) →
          </button>
        )}
      </div>

      {/* List */}
      <div className="space-y-1">
        {displayRepos.map((repo) => (
          <button
            key={repo.path}
            onClick={() => onSelectRepo(repo.path)}
            className={cx(
              'w-full flex items-center gap-3 px-4 py-2.5',
              'bg-bg-secondary hover:bg-bg-elevated border border-border rounded-card',
              'transition-all duration-150',
              'hover:border-accent/30',
              'group'
            )}
          >
            {/* Folder Icon */}
            <div className="flex-shrink-0 text-fg-muted group-hover:text-accent transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
            </div>

            {/* Repo Info */}
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-fg-primary group-hover:text-accent transition-colors">
                  {repo.name}
                </span>
                {repo.branch && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-bg-tertiary text-fg-muted rounded-chip border border-border font-mono">
                    {repo.branch}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-fg-muted truncate mt-0.5">
                {shortenPath(repo.path)}
              </div>
            </div>

            {/* Relative Time */}
            {repo.lastOpened && (
              <div className="flex-shrink-0 text-[11px] text-fg-muted group-hover:text-fg-secondary transition-colors">
                {formatRelativeTime(repo.lastOpened)}
              </div>
            )}

            {/* Arrow Icon */}
            <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-accent">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
