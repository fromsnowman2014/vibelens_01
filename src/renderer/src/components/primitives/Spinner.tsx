import { cx } from '@renderer/lib/cx'

export function Spinner({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cx(
        'inline-block border-2 border-current border-t-transparent rounded-full animate-spin',
        className
      )}
      style={{ width: size, height: size }}
    />
  )
}
