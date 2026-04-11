import { useRepoStore } from '@renderer/stores/repoStore'
import { useAnalysisStore } from '@renderer/stores/analysisStore'
import { DEFAULT_CLAUDE_MODEL } from '@shared/types'

export function StatusBar() {
  const commits = useRepoStore((s) => s.commits)
  const cached = useRepoStore((s) => s.cachedHashes)
  const { totalTokensIn, totalTokensOut } = useAnalysisStore()

  return (
    <div className="h-6 flex-shrink-0 flex items-center justify-between px-3 border-t border-border bg-bg-secondary/80 text-[11px] text-fg-muted">
      <div className="flex items-center gap-3">
        <span>{commits.length} commits loaded</span>
        <span>{cached.size} analyzed</span>
      </div>
      <div className="flex items-center gap-3">
        <span>model: {DEFAULT_CLAUDE_MODEL}</span>
        <span>
          tokens · in {totalTokensIn.toLocaleString()} / out {totalTokensOut.toLocaleString()}
        </span>
      </div>
    </div>
  )
}
