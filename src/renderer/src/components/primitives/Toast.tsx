import { create } from 'zustand'
import { cx } from '@renderer/lib/cx'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'
import { useEffect } from 'react'

type Kind = 'info' | 'success' | 'error'
interface ToastItem {
  id: number
  kind: Kind
  title: string
  description?: string
}

interface ToastState {
  items: ToastItem[]
  push: (t: Omit<ToastItem, 'id'>) => void
  dismiss: (id: number) => void
}

export const useToasts = create<ToastState>((set) => ({
  items: [],
  push: (t) => {
    const id = Date.now() + Math.random()
    set((s) => ({ items: [...s.items, { ...t, id }] }))
    setTimeout(() => set((s) => ({ items: s.items.filter((i) => i.id !== id) })), 5000)
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) }))
}))

export function toast(t: Omit<ToastItem, 'id'>) {
  useToasts.getState().push(t)
}

export function ToastHost() {
  const { items, dismiss } = useToasts()
  return (
    <div className="pointer-events-none fixed top-12 right-4 z-50 flex flex-col gap-2 w-[320px]">
      {items.map((t) => (
        <div
          key={t.id}
          className={cx(
            'pointer-events-auto rounded-card border bg-bg-panel shadow-panel p-3 flex gap-2 animate-fadeIn',
            t.kind === 'success' && 'border-state-success/40',
            t.kind === 'error' && 'border-state-error/40',
            t.kind === 'info' && 'border-accent/40'
          )}
        >
          <div className="mt-0.5">
            {t.kind === 'success' && <CheckCircle2 size={16} className="text-state-success" />}
            {t.kind === 'error' && <XCircle size={16} className="text-state-error" />}
            {t.kind === 'info' && <Info size={16} className="text-accent" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-medium text-fg-primary">{t.title}</div>
            {t.description && (
              <div className="text-[11.5px] text-fg-secondary mt-0.5 break-words selectable">
                {t.description}
              </div>
            )}
          </div>
          <button
            className="text-fg-muted hover:text-fg-primary"
            onClick={() => dismiss(t.id)}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

export function useGlobalErrorToaster() {
  useEffect(() => {
    const onErr = (e: ErrorEvent) => {
      toast({ kind: 'error', title: 'Unexpected error', description: e.message })
    }
    const onRej = (e: PromiseRejectionEvent) => {
      const msg = e.reason instanceof Error ? e.reason.message : String(e.reason)
      toast({ kind: 'error', title: 'Unhandled rejection', description: msg })
    }
    window.addEventListener('error', onErr)
    window.addEventListener('unhandledrejection', onRej)
    return () => {
      window.removeEventListener('error', onErr)
      window.removeEventListener('unhandledrejection', onRej)
    }
  }, [])
}
