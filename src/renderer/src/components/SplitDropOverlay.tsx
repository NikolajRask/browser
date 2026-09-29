import { useState, type DragEvent } from 'react'
import type { SplitSide } from '../../../shared/ipc'

type Props = {
  onDropSide: (side: SplitSide) => void
}

export function SplitDropOverlay({ onDropSide }: Props): React.JSX.Element {
  const [hoverSide, setHoverSide] = useState<SplitSide | null>(null)

  const allowDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  const drop = (event: DragEvent<HTMLDivElement>, side: SplitSide): void => {
    event.preventDefault()
    event.stopPropagation()
    setHoverSide(null)
    onDropSide(side)
  }

  return (
    <div className="split-overlay" aria-hidden="true">
      <div
        className={`split-zone split-zone--left${hoverSide === 'left' ? ' split-zone--hot' : ''}`}
        onDragEnter={() => setHoverSide('left')}
        onDragOver={allowDrop}
        onDragLeave={() => setHoverSide((side) => (side === 'left' ? null : side))}
        onDrop={(event) => drop(event, 'left')}
      >
        <div className="split-zone-card">
          <span className="split-zone-title">Split left</span>
          <span className="split-zone-hint">Drop tab here</span>
        </div>
      </div>
      <div
        className={`split-zone split-zone--right${hoverSide === 'right' ? ' split-zone--hot' : ''}`}
        onDragEnter={() => setHoverSide('right')}
        onDragOver={allowDrop}
        onDragLeave={() => setHoverSide((side) => (side === 'right' ? null : side))}
        onDrop={(event) => drop(event, 'right')}
      >
        <div className="split-zone-card">
          <span className="split-zone-title">Split right</span>
          <span className="split-zone-hint">Drop tab here</span>
        </div>
      </div>
    </div>
  )
}
