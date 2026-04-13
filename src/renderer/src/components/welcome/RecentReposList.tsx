import { cx } from '@renderer/lib/cx'

interface RecentRepo {
  path: string
  name: string
}

interface RecentReposListProps {
  repos: RecentRepo[]
  onSelectRepo: (path: string) => void
  onViewAll?: () => void
}

export function RecentReposList({ repos, onSelectRepo, onViewAll }: RecentReposListProps) {
  if (repos.length === 0) {
    return null
  }

  const displayRepos = repos.slice(0, 5)

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
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
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
              <div className="text-[13px] font-medium text-fg-primary group-hover:text-accent transition-colors">
                {repo.name}
              </div>
              <div className="text-[11px] text-fg-muted truncate mt-0.5">
                {repo.path}
              </div>
            </div>

            {/* Arrow Icon */}
            <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-accent">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
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
