import { Modal } from './Modal'
import { Button } from '@renderer/components/primitives/Button'
import { FileCog } from 'lucide-react'

interface Props {
  open: boolean
  repoPath: string | null
  onYes: () => void
  onNo: () => void
}

export function GitignoreConsentDialog({ open, repoPath, onYes, onNo }: Props) {
  return (
    <Modal
      open={open}
      onClose={onNo}
      title={
        <span className="flex items-center gap-2">
          <FileCog size={15} className="text-accent" /> Add .vibelens/ to .gitignore?
        </span>
      }
      width="max-w-md"
    >
      <div className="p-5 space-y-3 text-[12.5px] text-fg-primary leading-relaxed">
        <p>
          VibeLens stores analysis caches in{' '}
          <code className="font-mono">.vibelens/</code> inside this repository. Would you like
          to add it to this repo's <code className="font-mono">.gitignore</code> so it's not
          accidentally committed?
        </p>
        {repoPath && (
          <div className="text-[11.5px] text-fg-muted font-mono truncate">{repoPath}</div>
        )}
      </div>
      <footer className="flex justify-end gap-2 p-3 border-t border-border">
        <Button variant="ghost" onClick={onNo}>
          No thanks
        </Button>
        <Button variant="primary" onClick={onYes}>
          Yes, add it
        </Button>
      </footer>
    </Modal>
  )
}
