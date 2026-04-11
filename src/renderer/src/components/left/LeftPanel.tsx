import { Panel } from '@renderer/components/primitives/Panel'
import { CommitTimeline } from './CommitTimeline'
import { useRepoStore } from '@renderer/stores/repoStore'
import { GitBranch } from 'lucide-react'

export function LeftPanel() {
  const { commits, commitsHasMore } = useRepoStore()
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
      bodyClassName="p-0"
    >
      <CommitTimeline />
    </Panel>
  )
}
