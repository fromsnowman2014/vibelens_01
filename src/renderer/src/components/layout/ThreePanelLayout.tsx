import { ReactNode } from 'react'

interface Props {
  left: ReactNode
  center: ReactNode
  right: ReactNode
}

export function ThreePanelLayout({ left, center, right }: Props) {
  return (
    <div className="flex-1 min-h-0 grid grid-cols-[280px_minmax(0,1fr)_360px] gap-2 p-2">
      <div className="min-h-0">{left}</div>
      <div className="min-h-0">{center}</div>
      <div className="min-h-0">{right}</div>
    </div>
  )
}
