import { useRef, useState, type DragEvent } from 'react'
import type { CreateTabPlacement, TabInfo } from '../../../shared/ipc'
import { Favicon } from './Favicon'

type Props = {
  tabs: TabInfo[]
  onCreate: () => void
  onActivate: (id: string) => void
  onClose: (id: string) => void
  onReorder: (fromId: string, toId: string, position: 'before' | 'after') => void
  onOpenLink: (url: string, placement?: CreateTabPlacement) => void
  onSplitDragStart: (id: string) => void
  onSplitDragEnd: () => void
  onSearchTabs?: () => void
  searchTabsOpen?: boolean
}

type DropTarget = {
  id: string
  position: 'before' | 'after'
}

const TAB_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isLinkDragEvent(event: DragEvent<HTMLElement>): boolean {
  const types = Array.from(event.dataTransfer?.types ?? [])
  return types.includes('text/uri-list') || types.includes('URL') || types.includes('text/plain')
}

function readLinkUrl(dataTransfer: DataTransfer): string | null {
  const uriList = dataTransfer.getData('text/uri-list')
  if (uriList) {
    const line = uriList.split(/\r?\n/).find((entry) => entry && !entry.startsWith('#'))
    if (line) {
      const url = line.trim()
      if (url && !TAB_ID_RE.test(url)) return url
    }
  }

  const plain = dataTransfer.getData('text/plain').trim()
  if (!plain || TAB_ID_RE.test(plain)) return null
  if (plain.includes('://') || plain.startsWith('lockin:')) return plain
  return null
}

export function TabBar({
  tabs,
  onCreate,
  onActivate,
  onClose,
  onReorder,
  onOpenLink,
  onSplitDragStart,
  onSplitDragEnd,
  onSearchTabs,
  searchTabsOpen = false
}: Props): React.JSX.Element {
  const dragIdRef = useRef<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [linkDragging, setLinkDragging] = useState(false)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)

  const lastTab = tabs.at(-1) ?? null
  const activeTab = tabs.find((tab) => tab.active) ?? null

  const clearDragState = (): void => {
    dragIdRef.current = null
    setDraggingId(null)
    setLinkDragging(false)
    setDropTarget(null)
    onSplitDragEnd()
  }

  const setTarget = (id: string, position: 'before' | 'after'): void => {
    setDropTarget((current) =>
      current?.id === id && current.position === position ? current : { id, position }
    )
  }

  const dropPositionForTab = (
    event: DragEvent<HTMLElement>,
    id: string
  ): 'before' | 'after' => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const isLast = lastTab?.id === id
    const threshold = isLast ? bounds.left + bounds.width * 0.25 : bounds.left + bounds.width / 2
    return event.clientX < threshold ? 'before' : 'after'
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

    const fromId = dragIdRef.current
    if (fromId) {
      event.dataTransfer.dropEffect = 'move'
      if (fromId === id) {
        setDropTarget(null)
        return
      }
      setTarget(id, dropPositionForTab(event, id))
      return
    }

    if (!isLinkDragEvent(event)) {
      setDropTarget(null)
      return
    }

    event.dataTransfer.dropEffect = 'copy'
    setLinkDragging(true)
    setTarget(id, dropPositionForTab(event, id))
  }

  const onDropOnTab = (event: DragEvent<HTMLDivElement>, id: string): void => {
    event.preventDefault()
    event.stopPropagation()

    const fromId = dragIdRef.current ?? event.dataTransfer.getData('text/plain')
    if (fromId && TAB_ID_RE.test(fromId)) {
      if (fromId !== id) {
        onReorder(fromId, id, dropPositionForTab(event, id))
      }
      clearDragState()
      return
    }

    const url = readLinkUrl(event.dataTransfer)
    if (!url) {
      clearDragState()
      return
    }

    onOpenLink(url, { tabId: id, position: dropPositionForTab(event, id) })
    clearDragState()
  }

  const onDragOverEnd = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    event.stopPropagation()

    const fromId = dragIdRef.current
    if (fromId) {
      event.dataTransfer.dropEffect = 'move'
      if (!lastTab || fromId === lastTab.id) {
        setDropTarget(null)
        return
      }
      setTarget(lastTab.id, 'after')
      return
    }

    if (!isLinkDragEvent(event)) {
      setDropTarget(null)
      return
    }

    event.dataTransfer.dropEffect = 'copy'
    setLinkDragging(true)
    if (lastTab) {
      setTarget(lastTab.id, 'after')
    }
  }

  const onDropOnEnd = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    event.stopPropagation()

    const fromId = dragIdRef.current ?? event.dataTransfer.getData('text/plain')
    if (fromId && TAB_ID_RE.test(fromId) && lastTab && fromId !== lastTab.id) {
      onReorder(fromId, lastTab.id, 'after')
      clearDragState()
      return
    }

    const url = readLinkUrl(event.dataTransfer)
    if (!url) {
      clearDragState()
      return
    }

    if (lastTab) {
      onOpenLink(url, { tabId: lastTab.id, position: 'after' })
    } else {
      onOpenLink(url)
    }
    clearDragState()
  }

  const onDragOverBar = (event: DragEvent<HTMLDivElement>): void => {
    if (dragIdRef.current || !isLinkDragEvent(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setLinkDragging(true)
    if (lastTab) {
      setTarget(lastTab.id, 'after')
    }
  }

  const onDropOnBar = (event: DragEvent<HTMLDivElement>): void => {
    if (dragIdRef.current) return
    const url = readLinkUrl(event.dataTransfer)
    if (!url) return
    event.preventDefault()
    event.stopPropagation()
    if (lastTab && dropTarget) {
      onOpenLink(url, { tabId: dropTarget.id, position: dropTarget.position })
    } else {
      onOpenLink(url)
    }
    clearDragState()
  }

  return (
    <div
      className={[
        'tab-bar',
        draggingId || linkDragging ? 'tab-bar--reordering' : '',
        activeTab?.isIncognito ? 'tab-bar--incognito' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      role="tablist"
      onDragOver={onDragOverBar}
      onDrop={onDropOnBar}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
        setLinkDragging(false)
        setDropTarget(null)
      }}
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
              aria-label={tab.isIncognito ? `${tab.title || 'New Tab'} (Incognito)` : undefined}
              draggable
              className={[
                'tab',
                tab.active ? 'tab--active' : '',
                tab.splitSide ? 'tab--split' : '',
                tab.isIncognito ? 'tab--incognito' : '',
                draggingId === tab.id ? 'tab--dragging' : '',
                isDropBefore ? 'tab--drop-before' : '',
                isDropAfter ? 'tab--drop-after' : ''
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onActivate(tab.id)}
              onContextMenu={(event) => {
                event.preventDefault()
                event.stopPropagation()
                void window.lockin.showTabContextMenu(tab.id)
              }}
              onDragStart={(event) => onDragStart(event, tab.id)}
              onDragOver={(event) => onDragOverTab(event, tab.id)}
              onDragLeave={() => {
                setDropTarget((current) => (current?.id === tab.id ? null : current))
              }}
              onDrop={(event) => onDropOnTab(event, tab.id)}
              onDragEnd={clearDragState}
            >
              {tab.isIncognito ? (
                <span className="tab-incognito-icon" aria-hidden="true" title="Incognito">
                  <svg viewBox="0 0 16 16" width="14" height="14">
                    <path
                      d="M8 2.2c1.6 0 2.9 1.1 3.2 2.6h.9c.7 0 1.2.6 1.1 1.3l-.4 2.2c-.3 1.5-1.6 2.6-3.1 2.6H6.3c-1.5 0-2.8-1.1-3.1-2.6L2.8 6.1c-.1-.7.4-1.3 1.1-1.3h.9C5.1 3.3 6.4 2.2 8 2.2Z"
                      fill="currentColor"
                      opacity="0.9"
                    />
                    <circle cx="5.6" cy="7.4" r="1.15" fill="#fff" />
                    <circle cx="10.4" cy="7.4" r="1.15" fill="#fff" />
                    <path
                      d="M4.2 12.2c1.1.9 2.4 1.4 3.8 1.4s2.7-.5 3.8-1.4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              ) : (
                <Favicon src={tab.favicon} />
              )}
              <span className="tab-title" title={tab.title}>
                {tab.title || 'New Tab'}
              </span>
              {tab.isMuted ? (
                <button
                  type="button"
                  className="tab-mute"
                  aria-label={`Unmute ${tab.title || 'tab'}`}
                  title="Unmute tab"
                  onClick={(event) => {
                    event.stopPropagation()
                    void window.lockin.toggleMuteTab(tab.id)
                  }}
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                    <path d="M3 6.5v3h2.2L8.5 12V4L5.2 6.5H3Z" fill="currentColor" />
                    <path
                      d="M3.5 3.5l9 9"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              ) : null}
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
