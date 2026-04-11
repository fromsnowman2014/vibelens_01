import { cx } from '@renderer/lib/cx'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton', className)} />
}
