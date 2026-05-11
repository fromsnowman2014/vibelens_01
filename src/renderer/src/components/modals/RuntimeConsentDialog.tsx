import { useEffect, useState } from 'react'
import { Modal } from './Modal'
import { Button } from '@renderer/components/primitives/Button'
import { Download } from 'lucide-react'

interface PendingRequest {
  id: string
  kind: string
  version: string
  approxSizeMB?: number
}

export function RuntimeConsentDialog() {
  const [pending, setPending] = useState<PendingRequest | null>(null)
  const [remember, setRemember] = useState(true)

  useEffect(() => {
    const off = window.vibelens.runtimeConsent.onRequest((req) => {
      setRemember(true)
      setPending(req)
    })
    return () => {
      off()
    }
  }, [])

  if (!pending) return null

  const respond = (granted: boolean) => {
    window.vibelens.runtimeConsent.respond(pending.id, granted, remember)
    setPending(null)
  }

  const sizeStr =
    typeof pending.approxSizeMB === 'number' ? `~${pending.approxSizeMB} MB` : 'a few tens of MB'

  return (
    <Modal
      open
      onClose={() => respond(false)}
      closeOnBackdrop={false}
      closeOnEscape={false}
      title={
        <span className="flex items-center gap-2">
          <Download size={15} className="text-accent" />
          Download {pending.kind} v{pending.version}?
        </span>
      }
    >
      <div className="p-5 space-y-3 text-[13px] text-fg-primary leading-relaxed">
        <p>
          This repo pins {pending.kind} v<strong>{pending.version}</strong>. VibeLens can download
          it into its own cache so the build runs against the version the repo expects, without
          touching your system {pending.kind}.
        </p>
        <ul className="list-disc pl-5 space-y-1 text-fg-secondary text-[12.5px]">
          <li>
            Downloaded from <code className="font-mono">nodejs.org</code> over HTTPS and verified
            against <code className="font-mono">SHASUMS256.txt</code>.
          </li>
          <li>Stored in VibeLens' user-data directory; removed when you uninstall the app.</li>
          <li>Approximate size: {sizeStr}.</li>
          <li>
            If you decline, VibeLens uses whatever <code className="font-mono">{pending.kind}</code>{' '}
            is on your <code>$PATH</code>, which may produce different results.
          </li>
        </ul>
        <label className="flex items-center gap-2 text-[12px] text-fg-secondary pt-2">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          Remember this decision for future {pending.kind} downloads
        </label>
      </div>
      <footer className="flex justify-between gap-2 p-3 border-t border-border">
        <Button variant="ghost" onClick={() => respond(false)}>
          Decline (use system {pending.kind})
        </Button>
        <Button variant="primary" onClick={() => respond(true)}>
          Download
        </Button>
      </footer>
    </Modal>
  )
}
