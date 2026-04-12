import { Panel } from '@renderer/components/primitives/Panel'
import { CommitTimeline } from './CommitTimeline'
import { useRepoStore } from '@renderer/stores/repoStore'
import { GitBranch, RefreshCw } from 'lucide-react'
import { toast } from '@renderer/components/primitives/Toast'

export function LeftPanel() {
  const { commits, commitsHasMore, commitsLoading, refreshCommits } = useRepoStore()

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

  return (
    <Panel
      title={
        <>
          <GitBranch size={13} />
          <span>Commits</span>
          <span className="text-fg-muted">
            ({commits.length}
            {commitsHasMore ? '+' : ''})
          </span>
        </>
      }
      rightSlot={
        <button
          onClick={handleRefresh}
          disabled={commitsLoading}
          className="p-1 rounded hover:bg-bg-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Refresh commits"
        >
          <RefreshCw size={12} className={commitsLoading ? 'animate-spin' : ''} />
        </button>
      }
      bodyClassName="p-0"
    >
      <CommitTimeline />
    </Panel>
  )
}
