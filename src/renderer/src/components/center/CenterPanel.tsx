import { Panel } from '@renderer/components/primitives/Panel'
import { useRepoStore } from '@renderer/stores/repoStore'
import { DiffViewer } from './DiffViewer'
import { Skeleton } from '@renderer/components/primitives/Skeleton'
import { EmptyState } from '@renderer/components/primitives/EmptyState'
import { FileDiff, File, Plus, Minus, RefreshCw } from 'lucide-react'
import { cx } from '@renderer/lib/cx'
import type { DiffFile } from '@shared/types'

function StatusIcon({ status }: { status: DiffFile['status'] }) {
  const cls = {
    added: 'text-state-success',
    deleted: 'text-state-error',
    modified: 'text-state-warning',
    renamed: 'text-accent',
    copied: 'text-accent',
    'type-changed': 'text-fg-muted',
    unknown: 'text-fg-muted'
  }[status]
  const letter = {
    added: 'A',
    deleted: 'D',
    modified: 'M',
    renamed: 'R',
    copied: 'C',
    'type-changed': 'T',
    unknown: '?'
  }[status]
  return (
    <span className={cx('font-mono font-bold text-[10px] w-3 text-center', cls)}>
      {letter}
    </span>
  )
}

function Tabs() {
  const { diff, selectedFileIdx, selectFile } = useRepoStore()
  if (!diff || diff.files.length === 0) return null
  return (
    <div className="flex items-center overflow-x-auto border-b border-border bg-bg-secondary/60">
      {diff.files.map((f, i) => (
        <button
          key={f.path + i}
          onClick={() => selectFile(i)}
          className={cx(
            'flex-shrink-0 flex items-center gap-1.5 px-3 h-8 text-[12px] border-r border-border',
            i === selectedFileIdx
              ? 'bg-bg-panel text-fg-primary'
              : 'text-fg-secondary hover:text-fg-primary hover:bg-bg-tertiary'
          )}
          title={f.path}
        >
          <StatusIcon status={f.status} />
          <span className="max-w-[180px] truncate">{f.path.split('/').pop()}</span>
        </button>
      ))}
    </div>
  )
}

function FileMetaRow({ file }: { file: DiffFile }) {
  return (
    <div className="px-3 py-1.5 border-b border-border bg-bg-secondary/40 text-[11.5px] font-mono text-fg-secondary flex items-center gap-3 truncate">
      <span className="truncate">
        {file.oldPath && file.oldPath !== file.path ? `${file.oldPath} → ${file.path}` : file.path}
      </span>
      <span className="flex items-center gap-2 ml-auto flex-shrink-0">
        <span className="flex items-center gap-0.5 text-state-success">
          <Plus size={10} /> {file.additions}
        </span>
        <span className="flex items-center gap-0.5 text-state-error">
          <Minus size={10} /> {file.deletions}
        </span>
      </span>
    </div>
  )
}

export function CenterPanel() {
  const { diff, diffLoading, selectedFileIdx, selectedCommitHash, path } = useRepoStore()

  const currentFile = diff?.files[selectedFileIdx]

  return (
    <Panel
      title={
        <>
          <FileDiff size={13} />
          <span>Diff</span>
          {diff && (
            <span className="text-fg-muted">
              {diff.files.length} file{diff.files.length !== 1 ? 's' : ''}
            </span>
          )}
        </>
      }
      bodyClassName="p-0"
    >
      {!path ? (
        <EmptyState
          icon={<FileDiff size={32} />}
          title="Open a repository to view diffs"
        />
      ) : !selectedCommitHash ? (
        <EmptyState icon={<File size={32} />} title="Select a commit" description="Pick a commit from the left to see the diff." />
      ) : diffLoading ? (
        <div className="p-4 space-y-2">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-full" />
        </div>
      ) : !diff || diff.files.length === 0 ? (
        <EmptyState
          icon={<RefreshCw size={32} />}
          title="Empty diff"
          description="This commit has no file changes detected (possibly a merge commit)."
        />
      ) : (
        <div className="flex flex-col h-full min-h-0">
          <Tabs />
          {currentFile && (
            <>
              <FileMetaRow file={currentFile} />
              <div className="flex-1 min-h-0 overflow-auto">
                <DiffViewer file={currentFile} />
              </div>
            </>
          )}
        </div>
      )}
    </Panel>
  )
}
