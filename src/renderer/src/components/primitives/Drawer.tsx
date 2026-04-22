import { ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { cx } from '@renderer/lib/cx'
import { X } from 'lucide-react'

interface DrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
}

export function Drawer({ open, onOpenChange, title, children }: DrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Backdrop */}
        <Dialog.Overlay
          className={cx(
            'fixed inset-0 z-40',
            'bg-[rgba(30,30,46,0.8)]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
          )}
        />

        {/* Drawer Content */}
        <Dialog.Content
          className={cx(
            'fixed bottom-0 left-0 right-0 z-50',
            'max-h-[85vh] overflow-y-auto',
            'bg-bg-elevated border-t border-border-strong',
            'rounded-t-xl shadow-2xl',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
            'duration-300'
          )}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-bg-elevated border-b border-border px-6 py-4 flex items-center justify-between">
            <Dialog.Title className="text-sm font-semibold text-accent">
              {title}
            </Dialog.Title>
            <Dialog.Close
              className={cx(
                'w-8 h-8 rounded-md flex items-center justify-center',
                'text-fg-muted hover:text-fg-primary hover:bg-bg-tertiary',
                'transition-colors'
              )}
              aria-label="Close"
            >
              <X size={16} />
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="px-6 py-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
