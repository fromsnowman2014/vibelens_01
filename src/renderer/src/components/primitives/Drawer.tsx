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
        {/* Backdrop - lighter to keep background visible */}
        <Dialog.Overlay
          className={cx(
            'fixed inset-0 z-40',
            'bg-[rgba(30,30,46,0.4)]', // Reduced opacity from 0.8 to 0.4
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
          )}
        />

        {/* Drawer Content - centered with max-width for better readability */}
        <Dialog.Content
          className={cx(
            'fixed bottom-0 left-1/2 -translate-x-1/2 z-50',
            'w-full max-w-3xl', // Centered with max-width 768px
            'max-h-[70vh] overflow-y-auto', // Reduced from 85vh to 70vh
            'bg-bg-elevated border border-border-strong',
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
