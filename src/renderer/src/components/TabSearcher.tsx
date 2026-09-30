import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { ClosedTabInfo, TabInfo } from '../../../shared/ipc'
import { Favicon } from './Favicon'

type Props = {
  open: boolean
  focusKey: number
  tabs: TabInfo[]
  onClose: () => void
}

type FlatItem =
  | { kind: 'open'; tab: TabInfo }
  | { kind: 'closed'; tab: ClosedTabInfo; index: number }

function hostnameOf(url: string): string {
  if (!url) return ''
  try {
    return new URL(url).hostname || url
  } catch {
    return url
  }
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(timestamp).toLocaleDateString()
}

function matchesQuery(title: string, url: string, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return title.toLowerCase().includes(q) || url.toLowerCase().includes(q)
}

export function TabSearcher({ open, focusKey, tabs, onClose }: Props): React.JSX.Element | null {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [closedTabs, setClosedTabs] = useState<ClosedTabInfo[]>([])
  const [closedExpanded, setClosedExpanded] = useState(true)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const shortcutHint = window.lockin.platform === 'darwin' ? '⌘E' : 'Ctrl+E'

  useEffect(() => {
    if (!open) return
    void window.lockin.setTabSearchOpen(true)
    void window.lockin.getClosedTabs().then(setClosedTabs)
    setQuery('')
    setSelectedIndex(0)
    setClosedExpanded(true)
    const input = inputRef.current
    if (input) {
      input.focus()
      input.select()
    }
  }, [open, focusKey])

  useEffect(() => {
    if (!open) return
    return window.lockin.onClosedTabsUpdated(setClosedTabs)
  }, [open])

  const openTabs = useMemo(() => {
    const filtered = tabs.filter((tab) => matchesQuery(tab.title, tab.url, query))
    return filtered.sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1
      return b.lastAccessed - a.lastAccessed
    })
  }, [tabs, query])

  const filteredClosed = useMemo(() => {
    return closedTabs
      .map((tab, index) => ({ tab, index }))
      .filter(({ tab }) => matchesQuery(tab.title, tab.url, query))
  }, [closedTabs, query])

  const flatItems = useMemo((): FlatItem[] => {
    const items: FlatItem[] = openTabs.map((tab) => ({ kind: 'open', tab }))
    if (closedExpanded) {
      for (const entry of filteredClosed) {
        items.push({ kind: 'closed', tab: entry.tab, index: entry.index })
      }
    }
    return items
  }, [openTabs, filteredClosed, closedExpanded])

  useEffect(() => {
    setSelectedIndex((current) => {
      if (flatItems.length === 0) return 0
      return Math.min(current, flatItems.length - 1)
    })
  }, [flatItems])

  if (!open) return null

  const close = (): void => {
    void window.lockin.setTabSearchOpen(false)
    onClose()
  }

  const activateSelected = (): void => {
    const item = flatItems[selectedIndex]
    if (!item) return
    if (item.kind === 'open') {
      void window.lockin.activateTab(item.tab.id)
      close()
      return
    }
    void window.lockin.reopenClosedTab(item.index)
    close()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (flatItems.length === 0) return
      setSelectedIndex((current) => (current + 1) % flatItems.length)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (flatItems.length === 0) return
      setSelectedIndex((current) => (current - 1 + flatItems.length) % flatItems.length)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      activateSelected()
    }
  }

  return (
    <>
      <button type="button" className="tab-searcher-backdrop" aria-label="Close tab search" onClick={close} />
      <div className="tab-searcher" role="dialog" aria-label="Search tabs">
        <div className="tab-searcher-header">
          <span className="tab-searcher-search-icon" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="14" height="14">
              <circle cx="6.5" cy="6.5" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M10 10l3.5 3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <input
            ref={inputRef}
            className="tab-searcher-input"
            type="text"
            value={query}
            placeholder="Search tabs"
            aria-label="Search tabs"
            onChange={(event) => {
              setQuery(event.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={onKeyDown}
          />
          <span className="tab-searcher-shortcut">{shortcutHint}</span>
        </div>

        <div className="tab-searcher-body">
          {openTabs.length > 0 ? (
            <section className="tab-searcher-section">
              <div className="tab-searcher-section-label">Open tabs</div>
              <ul className="tab-searcher-list" role="listbox">
                {openTabs.map((tab) => {
                  const flatIndex = flatItems.findIndex(
                    (item) => item.kind === 'open' && item.tab.id === tab.id
                  )
                  const selected = flatIndex === selectedIndex
                  return (
                    <li key={tab.id}>
                      <div
                        role="option"
                        aria-selected={selected}
                        className={['tab-searcher-item', selected ? 'is-selected' : '']
                          .filter(Boolean)
                          .join(' ')}
                        onMouseEnter={() => setSelectedIndex(flatIndex)}
                        onClick={() => {
                          void window.lockin.activateTab(tab.id)
                          close()
                        }}
                      >
                        <Favicon src={tab.favicon} className="tab-searcher-favicon" size={16} />
                        <span className="tab-searcher-text">
                          <span className="tab-searcher-title">{tab.title || 'New Tab'}</span>
                          <span className="tab-searcher-meta">
                            {[hostnameOf(tab.url), formatRelativeTime(tab.lastAccessed)]
                              .filter(Boolean)
                              .join(' • ')}
                          </span>
                        </span>
                        <button
                          type="button"
                          className="tab-searcher-close"
                          aria-label={`Close ${tab.title || 'tab'}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            void window.lockin.closeTab(tab.id)
                          }}
                          onMouseDown={(event) => event.preventDefault()}
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
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null}

          {filteredClosed.length > 0 ? (
            <section className="tab-searcher-section">
              <button
                type="button"
                className="tab-searcher-section-toggle"
                onClick={() => setClosedExpanded((value) => !value)}
                aria-expanded={closedExpanded}
              >
                <span className="tab-searcher-section-label">Recently closed</span>
                <svg
                  className={['tab-searcher-chevron', closedExpanded ? 'is-open' : '']
                    .filter(Boolean)
                    .join(' ')}
                  viewBox="0 0 16 16"
                  width="12"
                  height="12"
                  aria-hidden="true"
                >
                  <path
                    d="M4 6l4 4 4-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              {closedExpanded ? (
                <ul className="tab-searcher-list" role="listbox">
                  {filteredClosed.map(({ tab, index }) => {
                    const flatIndex = flatItems.findIndex(
                      (item) => item.kind === 'closed' && item.index === index
                    )
                    const selected = flatIndex === selectedIndex
                    return (
                      <li key={`closed-${index}-${tab.url}`}>
                        <div
                          role="option"
                          aria-selected={selected}
                          className={['tab-searcher-item', selected ? 'is-selected' : '']
                            .filter(Boolean)
                            .join(' ')}
                          onMouseEnter={() => setSelectedIndex(flatIndex)}
                          onClick={() => {
                            void window.lockin.reopenClosedTab(index)
                            close()
                          }}
                        >
                          <Favicon src={tab.favicon} className="tab-searcher-favicon" size={16} />
                          <span className="tab-searcher-text">
                            <span className="tab-searcher-title">{tab.title || 'New Tab'}</span>
                            <span className="tab-searcher-meta">
                              {[hostnameOf(tab.url), formatRelativeTime(tab.closedAt)]
                                .filter(Boolean)
                                .join(' • ')}
                            </span>
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </section>
          ) : null}

          {openTabs.length === 0 && filteredClosed.length === 0 ? (
            <div className="tab-searcher-empty">No matching tabs</div>
          ) : null}
        </div>
      </div>
    </>
  )
}
