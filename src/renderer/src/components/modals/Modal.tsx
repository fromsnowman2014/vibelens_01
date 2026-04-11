import { PropsWithChildren, ReactNode, useEffect } from 'react'
import { cx } from '@renderer/lib/cx'
import { X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  title?: ReactNode
  width?: string
  closeOnBackdrop?: boolean
  closeOnEscape?: boolean
  className?: string
}

export function Modal({
  open,
  onClose,
  title,
  width = 'max-w-lg',
  closeOnBackdrop = true,
  closeOnEscape = true,
  className,
  children
}: PropsWithChildren<Props>) {
  useEffect(() => {
    if (!open || !closeOnEscape) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, closeOnEscape, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-6 bg-black/50 animate-fadeIn"
      onClick={() => closeOnBackdrop && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cx(
          'w-full rounded-panel border border-border bg-bg-panel shadow-modal flex flex-col max-h-[85vh] animate-scaleIn',
          width,
          className
        )}
      >
        {title && (
          <header className="flex items-center justify-between px-4 h-11 border-b border-border">
            <div className="text-[13px] font-semibold text-fg-primary">{title}</div>
            <button
              onClick={onClose}
              className="text-fg-muted hover:text-fg-primary no-drag"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </header>
        )}
        <div className="flex-1 min-h-0 overflow-auto">{children}</div>
      </div>
    </div>
  )
}
