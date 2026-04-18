import React, { ReactNode, useState, useCallback, useRef } from 'react'

interface Props {
  left: ReactNode
  center: ReactNode
  right: ReactNode
}

// VS Code style Custom SplitView hook
function usePanelResize(
  initialWidth: number,
  minWidth: number,
  maxWidth: number,
  side: 'left' | 'right'
) {
  // Read initial size from localStorage
  const getInitialWidth = () => {
    try {
      const saved = localStorage.getItem(`vibelens:panel:${side}`)
      if (saved) return parseInt(saved, 10)
    } catch {
      // ignore security exceptions
    }
    return initialWidth
  }

  const [width, setWidth] = useState<number>(getInitialWidth)
  const isDragging = useRef(false)

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault() // Prevent text selection highlight during drag
      isDragging.current = true
      const startX = e.clientX
      const startWidth = width

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!isDragging.current) return
        const deltaX = moveEvent.clientX - startX
        
        // Left handle: sliding right (positive delta) makes panel wider.
        // Right handle: sliding right (positive delta) makes panel narrower.
        const newWidth = side === 'left' ? startWidth + deltaX : startWidth - deltaX
        
        setWidth(Math.min(Math.max(newWidth, minWidth), maxWidth))
      }

      const onMouseUp = () => {
        isDragging.current = false
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        
        // Save the new width to localStorage using a functional state update
        setWidth((currentWidth) => {
          try {
            localStorage.setItem(`vibelens:panel:${side}`, currentWidth.toString())
          } catch {
            // ignore
          }
          return currentWidth
        })
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [width, minWidth, maxWidth, side]
  )

  return { width, startResize }
}

function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="group relative flex items-center justify-center w-2 -mx-1 cursor-col-resize z-10 select-none"
    >
      {/* Thin border line (idle visibility) -> turns accent color on hover */}
      <div className="absolute inset-y-0 w-px bg-border/50 group-hover:bg-accent transition-colors duration-150 delay-75" />
      
      {/* Active dragging indicator (thicker colored bar) */}
      <div className="absolute inset-y-0 w-[3px] bg-transparent active:bg-accent-primary transition-colors opacity-0 active:opacity-100" />
    </div>
  )
}

export function ThreePanelLayout({ left, center, right }: Props) {
  // Left Panel parameters
  const leftPanel = usePanelResize(280, 200, 600, 'left')
  // Right Panel parameters
  const rightPanel = usePanelResize(360, 250, 800, 'right')

  return (
    <div className="flex flex-1 w-full min-h-0 p-2 overflow-hidden bg-bg-primary">
      
      {/* Left Panel */}
      <div 
        style={{ flexBasis: `${leftPanel.width}px` }} 
        className="flex-shrink-0 flex flex-col min-h-0 pr-1 overflow-hidden"
      >
        {left}
      </div>

      {/* Separator 1 (Left Sash) */}
      <ResizeHandle onMouseDown={leftPanel.startResize} />

      {/* Center Panel (Dynamic flex-1) */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 px-1 relative overflow-hidden">
        {center}
      </div>

      {/* Separator 2 (Right Sash) */}
      <ResizeHandle onMouseDown={rightPanel.startResize} />

      {/* Right Panel */}
      <div 
        style={{ flexBasis: `${rightPanel.width}px` }} 
        className="flex-shrink-0 flex flex-col min-h-0 pl-1 overflow-hidden"
      >
        {right}
      </div>
      
    </div>
  )
}

