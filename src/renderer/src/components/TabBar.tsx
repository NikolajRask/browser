import { useRef, useState, type DragEvent } from 'react'
import type { TabInfo } from '../../../shared/ipc'
import { Favicon } from './Favicon'

type Props = {
  tabs: TabInfo[]
  onCreate: () => void
  onActivate: (id: string) => void
  onClose: (id: string) => void
  onReorder: (fromId: string, toId: string, position: 'before' | 'after') => void
  onSplitDragStart: (id: string) => void
  onSplitDragEnd: () => void
  onSearchTabs?: () => void
  searchTabsOpen?: boolean
}

type DropTarget = {
  id: string
  position: 'before' | 'after'
}

export function TabBar({
  tabs,
  onCreate,
  onActivate,
  onClose,
  onReorder,
  onSplitDragStart,
  onSplitDragEnd,
  onSearchTabs,
  searchTabsOpen = false
}: Props): React.JSX.Element {
  const dragIdRef = useRef<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)

  const lastTab = tabs.at(-1) ?? null
  const activeTab = tabs.find((tab) => tab.active) ?? null

  const clearDragState = (): void => {
    dragIdRef.current = null
    setDraggingId(null)
    setDropTarget(null)
    onSplitDragEnd()
  }

  const setTarget = (id: string, position: 'before' | 'after'): void => {
    setDropTarget((current) =>
      current?.id === id && current.position === position ? current : { id, position }
    )
  }

  const onDragStart = (event: DragEvent<HTMLDivElement>, id: string): void => {
    dragIdRef.current = id
    setDraggingId(id)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', id)

    // Only offer split when dragging a tab that isn't the focused one
    if (activeTab && id !== activeTab.id) {
      onSplitDragStart(id)
    }
  }

  const onDragOverTab = (event: DragEvent<HTMLDivElement>, id: string): void => {
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'move'

    const fromId = dragIdRef.current
    if (!fromId || fromId === id) {
      setDropTarget(null)
      return
    }

    const bounds = event.currentTarget.getBoundingClientRect()
    const isLast = lastTab?.id === id
    const threshold = isLast ? bounds.left + bounds.width * 0.25 : bounds.left + bounds.width / 2
    const position = event.clientX < threshold ? 'before' : 'after'
    setTarget(id, position)
  }

  const onDropOnTab = (event: DragEvent<HTMLDivElement>, id: string): void => {
    event.preventDefault()
    event.stopPropagation()
    const fromId = dragIdRef.current ?? event.dataTransfer.getData('text/plain')
    if (!fromId || fromId === id) {
      clearDragState()
      return
    }

    const bounds = event.currentTarget.getBoundingClientRect()
    const isLast = lastTab?.id === id
    const threshold = isLast ? bounds.left + bounds.width * 0.25 : bounds.left + bounds.width / 2
    const position = event.clientX < threshold ? 'before' : 'after'
    onReorder(fromId, id, position)
    clearDragState()
  }

  const onDragOverEnd = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'move'

    const fromId = dragIdRef.current
    if (!fromId || !lastTab || fromId === lastTab.id) {
      setDropTarget(null)
      return
    }

    setTarget(lastTab.id, 'after')
  }

  const onDropOnEnd = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    event.stopPropagation()
    const fromId = dragIdRef.current ?? event.dataTransfer.getData('text/plain')
    if (!fromId || !lastTab || fromId === lastTab.id) {
      clearDragState()
      return
    }

    onReorder(fromId, lastTab.id, 'after')
    clearDragState()
  }

  return (
    <div
      className={['tab-bar', draggingId ? 'tab-bar--reordering' : ''].filter(Boolean).join(' ')}
      role="tablist"
    >
      <div className="tabs">
        {tabs.map((tab) => {
          const isDropBefore = dropTarget?.id === tab.id && dropTarget.position === 'before'
          const isDropAfter = dropTarget?.id === tab.id && dropTarget.position === 'after'

          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={tab.active}
              draggable
              className={[
                'tab',
                tab.active ? 'tab--active' : '',
                tab.splitSide ? 'tab--split' : '',
                draggingId === tab.id ? 'tab--dragging' : '',
                isDropBefore ? 'tab--drop-before' : '',
                isDropAfter ? 'tab--drop-after' : ''
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onActivate(tab.id)}
              onDragStart={(event) => onDragStart(event, tab.id)}
              onDragOver={(event) => onDragOverTab(event, tab.id)}
              onDragLeave={() => {
                setDropTarget((current) => (current?.id === tab.id ? null : current))
              }}
              onDrop={(event) => onDropOnTab(event, tab.id)}
              onDragEnd={clearDragState}
            >
              <Favicon src={tab.favicon} />
              <span className="tab-title" title={tab.title}>
                {tab.title || 'New Tab'}
              </span>
              <button
                type="button"
                className="tab-close"
                aria-label={`Close ${tab.title || 'tab'}`}
                onClick={(event) => {
                  event.stopPropagation()
                  onClose(tab.id)
                }}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <svg viewBox="0 0 16 16" width="10" height="10" aria-hidden="true">
                  <path
                    d="M3.5 3.5l9 9m0-9l-9 9"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          )
        })}
        <div
          className={`tabs-end-drop${
            dropTarget?.id === lastTab?.id && dropTarget?.position === 'after'
              ? ' tabs-end-drop--active'
              : ''
          }`}
          onDragOver={onDragOverEnd}
          onDrop={onDropOnEnd}
          onDragLeave={() => {
            if (dropTarget?.position === 'after' && dropTarget.id === lastTab?.id) {
              setDropTarget(null)
            }
          }}
        />
      </div>
      <button type="button" className="tab-new" aria-label="New tab" onClick={onCreate}>
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <path
            d="M8 3v10M3 8h10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {onSearchTabs ? (
        <button
          type="button"
          className={['tab-search', searchTabsOpen ? 'is-open' : ''].filter(Boolean).join(' ')}
          aria-label="Search tabs"
          aria-pressed={searchTabsOpen}
          onClick={onSearchTabs}
        >
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
            <circle cx="6.5" cy="6.5" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M10 10l3.5 3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      ) : null}
    </div>
  )
}
