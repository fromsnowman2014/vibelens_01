import { useState, useMemo, useEffect } from 'react'
import { Panel } from '@renderer/components/primitives/Panel'
import { CommitTimeline } from './CommitTimeline'
import { useRepoStore } from '@renderer/stores/repoStore'
import { GitBranch, RefreshCw, Search, X } from 'lucide-react'
import { toast } from '@renderer/components/primitives/Toast'

export function LeftPanel() {
  const { commits, commitsHasMore, commitsLoading, refreshCommits } = useRepoStore()
  const [searchInput, setSearchInput] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // Debounce search query by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchInput)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const filteredCommits = useMemo(() => {
    if (!debouncedQuery.trim()) return commits
    const q = debouncedQuery.toLowerCase().trim()
    return commits.filter(
      (c) =>
        c.message.toLowerCase().includes(q) ||
        c.subject.toLowerCase().includes(q) ||
        c.shortHash.toLowerCase().includes(q) ||
        c.hash.toLowerCase().includes(q) ||
        c.author.toLowerCase().includes(q)
    )
  }, [commits, debouncedQuery])

  const handleRefresh = async () => {
    try {
      await refreshCommits()
      toast({ kind: 'success', title: 'Commits refreshed' })
    } catch (e) {
      toast({
        kind: 'error',
        title: 'Failed to refresh commits',
        description: e instanceof Error ? e.message : String(e)
      })
    }
  }

  const isFiltered = debouncedQuery.trim().length > 0

  return (
    <Panel
      title={
        <>
          <GitBranch size={13} />
          <span>Commits</span>
          <span className="text-fg-muted">
            {isFiltered
              ? `(${filteredCommits.length}/${commits.length})`
              : `(${commits.length}${commitsHasMore ? '+' : ''})`}
          </span>
        </>
      }
      rightSlot={
        <button
          onClick={handleRefresh}
          disabled={commitsLoading}
          className="p-1 rounded hover:bg-bg-elevated disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Refresh commits"
        >
          <RefreshCw size={12} className={commitsLoading ? 'animate-spin' : ''} />
        </button>
      }
      bodyClassName="p-0"
    >
      {/* Search Input */}
      <div className="px-2 py-1.5 border-b border-border">
        <div className="relative flex items-center">
          <Search
            size={13}
            className="absolute left-2.5 text-fg-muted pointer-events-none"
          />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search commits…"
            className="w-full pl-8 pr-7 py-1.5 bg-bg-tertiary border border-border rounded text-[12px] text-fg-primary placeholder:text-fg-muted/60 focus:outline-none focus:border-accent transition-colors"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              className="absolute right-2 text-fg-muted hover:text-fg-primary transition-colors"
              title="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      <CommitTimeline filteredCommits={isFiltered ? filteredCommits : undefined} />
    </Panel>
  )
}

