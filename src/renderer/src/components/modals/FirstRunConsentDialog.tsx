import { Modal } from './Modal'
import { Button } from '@renderer/components/primitives/Button'
import { ShieldAlert } from 'lucide-react'

interface Props {
  open: boolean
  onAccept: () => void
  onDecline: () => void
}

export function FirstRunConsentDialog({ open, onAccept, onDecline }: Props) {
  return (
    <Modal
      open={open}
      onClose={onDecline}
      closeOnBackdrop={false}
      closeOnEscape={false}
      title={
        <span className="flex items-center gap-2">
          <ShieldAlert size={15} className="text-state-warning" />
          Privacy notice
        </span>
      }
    >
      <div className="p-5 space-y-3 text-[13px] text-fg-primary leading-relaxed">
        <p>
          VibeLens analyzes your git commits by sending the{' '}
          <strong>diff</strong>, <strong>commit message</strong>, and <strong>file paths</strong>
          {' '}to an LLM provider (Anthropic Claude) using the API key you provide.
        </p>
        <ul className="list-disc pl-5 space-y-1 text-fg-secondary text-[12.5px]">
          <li>
            <strong className="text-fg-primary">Sent to Anthropic:</strong> diff, commit
            metadata, file paths
          </li>
          <li>
            <strong className="text-fg-primary">Never sent:</strong> files outside the diff,
            your <code>.env</code>, your API key's plaintext beyond the request itself
          </li>
          <li>
            <strong className="text-fg-primary">Stored locally:</strong> analyses are cached in{' '}
            <code className="font-mono">.vibelens/</code> in each repository
          </li>
          <li>
            <strong className="text-fg-primary">Your key:</strong> stored in the macOS Keychain
          </li>
        </ul>
        <p className="text-[12px] text-fg-muted">
          Be mindful when analyzing repositories that may contain proprietary or sensitive code.
          Check your organization's policy before proceeding.
        </p>
      </div>
      <footer className="flex justify-between gap-2 p-3 border-t border-border">
        <Button variant="ghost" onClick={onDecline}>
          Decline and quit
        </Button>
        <Button variant="primary" onClick={onAccept}>
          Accept and continue
        </Button>
      </footer>
    </Modal>
  )
}
