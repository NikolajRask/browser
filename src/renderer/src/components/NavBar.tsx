import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ChangeEvent
} from 'react'
import type { DownloadEntry, HistoryEntry } from '../../../shared/ipc'

type Props = {
  url: string
  canGoBack: boolean
  canGoForward: boolean
  onBack: () => void
  onForward: () => void
  onReload: () => void
  onNavigate: (url: string) => void
}

const SUGGEST_LIMIT = 10
const BUBBLE_LIMIT = 8

type InlineCompletion = {
  /** Full text shown in the omnibox (typed prefix + selected suffix). */
  value: string
  /** Index where the selected completion suffix starts. */
  selectFrom: number
  /** URL to open if the user accepts this inline completion. */
  navigateUrl: string
}

function completionCandidates(entryUrl: string): string[] {
  const candidates: string[] = []
  const push = (value: string): void => {
    const trimmed = value.trim()
    if (!trimmed) return
    if (!candidates.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
      candidates.push(trimmed)
    }
  }

  try {
    const parsed = new URL(entryUrl)
    const host = parsed.hostname.replace(/^www\./i, '')
    const path = `${parsed.pathname === '/' ? '' : parsed.pathname}${parsed.search}${parsed.hash}`
    push(host)
    if (path) push(`${host}${path}`)
    push(`${parsed.host}${path}`)
    push(entryUrl.replace(/^[a-z]+:\/\//i, ''))
  } catch {
    // Fall through to raw URL candidates.
  }

  push(entryUrl)
  return candidates
}

function buildInlineCompletion(typed: string, entry: HistoryEntry): InlineCompletion | null {
  if (!typed) return null

  for (const candidate of completionCandidates(entry.url)) {
    if (
      candidate.length > typed.length &&
      candidate.toLowerCase().startsWith(typed.toLowerCase())
    ) {
      return {
        value: typed + candidate.slice(typed.length),
        selectFrom: typed.length,
        navigateUrl: entry.url
      }
    }
  }

  return null
}

/**
 * When inline completion is applied, React often leaves the caret collapsed at
 * selectFrom instead of selecting the suffix. The next keystroke then inserts
 * into the middle ("go" + "o" + "ogle.com" → "googleogle.com"). Recover the
 * real typed query when that happens.
 */
function recoverTypedFromInlineEdit(inline: InlineCompletion, next: string): string {
  const before = inline.value.slice(0, inline.selectFrom)
  const after = inline.value.slice(inline.selectFrom)

  if (
    next.startsWith(before) &&
    next.endsWith(after) &&
    next.length >= inline.value.length
  ) {
    const inserted = next.slice(before.length, next.length - after.length)
    return before + inserted
  }

  return next
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return ''
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  const digits = unit === 0 ? 0 : value >= 10 ? 0 : 1
  return `${value.toFixed(digits)} ${units[unit]}`
}

function progressPercent(entry: DownloadEntry): number {
  if (entry.totalBytes <= 0) return 0
  return Math.min(100, Math.round((entry.receivedBytes / entry.totalBytes) * 100))
}

function downloadStatusText(entry: DownloadEntry): string {
  if (entry.state === 'progressing') {
    if (entry.paused) return `Paused · ${formatBytes(entry.receivedBytes)}`
    const received = formatBytes(entry.receivedBytes)
    const total = formatBytes(entry.totalBytes)
    if (entry.totalBytes > 0) {
      return `${received} of ${total} · ${progressPercent(entry)}%`
    }
    return received ? `${received} downloaded` : 'Downloading…'
  }
  if (entry.state === 'completed') {
    const size = formatBytes(entry.totalBytes || entry.receivedBytes)
    return size ? `Completed · ${size}` : 'Completed'
  }
  if (entry.state === 'cancelled') return 'Cancelled'
  return 'Interrupted'
}

export function NavBar({
  url,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  onReload,
  onNavigate
}: Props): React.JSX.Element {
  const [draft, setDraft] = useState(url)
  const [menuOpen, setMenuOpen] = useState(false)
  const [downloadsOpen, setDownloadsOpen] = useState(false)
  const [downloads, setDownloads] = useState<DownloadEntry[]>([])
  const [suggestions, setSuggestions] = useState<HistoryEntry[]>([])
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const downloadsRef = useRef<HTMLDivElement>(null)
  const knownIdsRef = useRef<Set<string> | null>(null)
  const suggestSeq = useRef(0)
  const typedQueryRef = useRef('')
  const inlineRef = useRef<InlineCompletion | null>(null)
  const overlayOpen = menuOpen || suggestOpen || downloadsOpen
  const activeCount = downloads.filter((entry) => entry.state === 'progressing').length
  const showDownloadsButton = downloads.length > 0

  useEffect(() => {
    setDraft(url)
    setSuggestions([])
    setSuggestOpen(false)
    setActiveIndex(-1)
    typedQueryRef.current = ''
    inlineRef.current = null
  }, [url])

  // Select the inline suffix before paint so the next keystroke replaces it
  // instead of inserting in the middle of the completed value.
  useLayoutEffect(() => {
    const input = inputRef.current
    const inline = inlineRef.current
    if (!input || !inline || draft !== inline.value) return
    if (document.activeElement !== input) return
    input.setSelectionRange(inline.selectFrom, inline.value.length)
  }, [draft])

  useEffect(() => {
    return window.lockin.onFocusOmnibox(() => {
      const input = inputRef.current
      if (!input) return
      input.focus()
      input.select()
    })
  }, [])

  useEffect(() => {
    void window.lockin.listDownloads().then((entries) => {
      knownIdsRef.current = new Set(entries.map((entry) => entry.id))
      setDownloads(entries)
    })

    return window.lockin.onDownloadsUpdated(({ entries, changedId }) => {
      const known = knownIdsRef.current
      const isNew =
        changedId !== null &&
        entries.some((entry) => entry.id === changedId && entry.state === 'progressing') &&
        (!known || !known.has(changedId))

      knownIdsRef.current = new Set(entries.map((entry) => entry.id))
      setDownloads(entries)

      if (isNew) {
        setMenuOpen(false)
        setSuggestOpen(false)
        setDownloadsOpen(true)
      }
    })
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('app-menu-open', overlayOpen)
    const passwordPromptOpen = document.documentElement.classList.contains('password-save-open')
    void window.lockin.setAppMenuOpen(overlayOpen || passwordPromptOpen)

    if (!overlayOpen) return

    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        setDownloadsOpen(false)
        setSuggestOpen(false)
        setActiveIndex(-1)
        inlineRef.current = null
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [overlayOpen])

  useEffect(() => {
    return () => {
      document.documentElement.classList.remove('app-menu-open')
      void window.lockin.setAppMenuOpen(false)
    }
  }, [])

  const closeSuggestions = (): void => {
    setSuggestions([])
    setSuggestOpen(false)
    setActiveIndex(-1)
    inlineRef.current = null
  }

  const applyInlineFromResults = (typed: string, results: HistoryEntry[]): void => {
    // Bail if the user kept typing while suggestions were in flight.
    if (typedQueryRef.current !== typed) return

    const top = results[0]
    const inline = top ? buildInlineCompletion(typed, top) : null
    inlineRef.current = inline

    if (!inline) {
      setDraft(typed)
      return
    }

    setDraft(inline.value)
  }

  const fetchSuggestions = (query: string, opts?: { allowInline?: boolean }): void => {
    const trimmed = query.trim()
    // Keep trailing spaces so "you " does not match "youtube.com".
    const matchQuery = query.trimStart()
    const allowInline = opts?.allowInline ?? true

    if (!trimmed || trimmed === url) {
      closeSuggestions()
      setDraft(query)
      return
    }

    const seq = ++suggestSeq.current
    void window.lockin.suggestHistory(matchQuery, SUGGEST_LIMIT).then((results) => {
      if (seq !== suggestSeq.current) return
      if (typedQueryRef.current !== query) return

      setSuggestions(results)
      setSuggestOpen(results.length > 0)

      if (allowInline) {
        applyInlineFromResults(query, results)
        setActiveIndex(results.length > 0 ? 0 : -1)
      } else {
        inlineRef.current = null
        setDraft(query)
        setActiveIndex(-1)
      }
    })
  }

  const submit = (event?: FormEvent): void => {
    event?.preventDefault()
    const selected = activeIndex >= 0 ? suggestions[activeIndex] : undefined
    const inline = inlineRef.current
    const next = (selected?.url ?? inline?.navigateUrl ?? draft).trim()
    closeSuggestions()
    typedQueryRef.current = ''
    if (next) onNavigate(next)
  }

  const pickSuggestion = (entry: HistoryEntry): void => {
    closeSuggestions()
    typedQueryRef.current = ''
    setDraft(entry.url)
    onNavigate(entry.url)
  }

  const onDraftChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const input = event.currentTarget
    const inline = inlineRef.current
    const inputType = (event.nativeEvent as InputEvent).inputType ?? ''

    let next = input.value
    if (inline && draft === inline.value) {
      next = recoverTypedFromInlineEdit(inline, next)
    }

    const isDeleting =
      inputType.startsWith('delete') || next.length < typedQueryRef.current.length

    setMenuOpen(false)
    setDownloadsOpen(false)

    if (isDeleting) {
      typedQueryRef.current = next
      inlineRef.current = null
      setDraft(next)
      fetchSuggestions(next, { allowInline: false })
      return
    }

    typedQueryRef.current = next
    inlineRef.current = null
    setDraft(next)
    fetchSuggestions(next, { allowInline: true })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    const input = event.currentTarget
    const inline = inlineRef.current
    const hasInlineSelection =
      !!inline &&
      input.selectionStart === inline.selectFrom &&
      input.selectionEnd === inline.value.length &&
      draft === inline.value

    if (event.key === 'Escape') {
      if (suggestOpen || inline) {
        event.preventDefault()
        const typed = typedQueryRef.current
        inlineRef.current = null
        setDraft(typed)
        closeSuggestions()
        return
      }
      setDraft(url)
      event.currentTarget.blur()
      return
    }

    if (
      hasInlineSelection &&
      (event.key === 'ArrowRight' || event.key === 'Tab') &&
      !event.shiftKey
    ) {
      event.preventDefault()
      inlineRef.current = null
      typedQueryRef.current = draft
      input.setSelectionRange(draft.length, draft.length)
      return
    }

    if (!suggestOpen || suggestions.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      inlineRef.current = null
      setDraft(typedQueryRef.current || draft)
      setActiveIndex((index) => (index + 1) % suggestions.length)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      inlineRef.current = null
      setDraft(typedQueryRef.current || draft)
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1))
      return
    }

    if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault()
      const entry = suggestions[activeIndex]
      if (entry) pickSuggestion(entry)
    }
  }

  const closeMenu = (): void => setMenuOpen(false)
  const closeDownloads = (): void => setDownloadsOpen(false)
  const bubbleEntries = downloads.slice(0, BUBBLE_LIMIT)

  return (
    <>
      <form className="nav-bar" onSubmit={submit}>
        <div className="nav-controls">
          <button type="button" disabled={!canGoBack} onClick={onBack} aria-label="Back">
            ←
          </button>
          <button type="button" disabled={!canGoForward} onClick={onForward} aria-label="Forward">
            →
          </button>
          <button type="button" onClick={onReload} aria-label="Reload">
            ↻
          </button>
        </div>
        <div className="omnibox">
          <input
            ref={inputRef}
            className="url-bar"
            type="text"
            value={draft}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            placeholder="Search or enter address"
            role="combobox"
            aria-autocomplete="both"
            aria-expanded={suggestOpen}
            aria-controls="omnibox-suggestions"
            onChange={onDraftChange}
            onKeyDown={onKeyDown}
            onFocus={(event) => event.currentTarget.select()}
            onBlur={() => {
              window.setTimeout(() => closeSuggestions(), 120)
            }}
          />
          {suggestOpen ? (
            <ul id="omnibox-suggestions" className="omnibox-suggestions" role="listbox">
              {suggestions.map((entry, index) => (
                <li key={entry.id} role="option" aria-selected={index === activeIndex}>
                  <button
                    type="button"
                    className={`omnibox-suggestion${index === activeIndex ? ' is-active' : ''}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => pickSuggestion(entry)}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    {entry.favicon ? (
                      <img className="omnibox-favicon" src={entry.favicon} alt="" />
                    ) : (
                      <span className="omnibox-favicon-fallback" aria-hidden="true">
                        {(entry.title || entry.url).trim().charAt(0).toUpperCase() || '?'}
                      </span>
                    )}
                    <span className="omnibox-meta">
                      <span className="omnibox-title">{entry.title || entry.url}</span>
                      <span className="omnibox-url">{entry.url}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {showDownloadsButton ? (
          <div className="downloads-menu" ref={downloadsRef}>
            <button
              type="button"
              className={`downloads-button${downloadsOpen ? ' is-open' : ''}${activeCount > 0 ? ' is-active' : ''}`}
              aria-label="Downloads"
              aria-haspopup="dialog"
              aria-expanded={downloadsOpen}
              onClick={() => {
                closeSuggestions()
                closeMenu()
                setDownloadsOpen((open) => !open)
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path
                  d="M8 2.5v7.2M5.2 7.3 8 10.1l2.8-2.8M3.5 12.5h9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {activeCount > 0 ? <span className="downloads-badge">{activeCount}</span> : null}
            </button>
            {downloadsOpen ? (
              <div className="downloads-dropdown" role="dialog" aria-label="Downloads">
                {bubbleEntries.length === 0 ? (
                  <div className="downloads-empty">No downloads yet</div>
                ) : (
                  <ul className="downloads-list">
                    {bubbleEntries.map((entry) => (
                      <li key={entry.id} className="downloads-item">
                        <div className="downloads-meta">
                          <div className="downloads-title">{entry.filename}</div>
                          <div className="downloads-status">{downloadStatusText(entry)}</div>
                          {entry.state === 'progressing' ? (
                            <div className="downloads-progress" aria-hidden="true">
                              <span style={{ width: `${progressPercent(entry)}%` }} />
                            </div>
                          ) : null}
                        </div>
                        <div className="downloads-actions">
                          {entry.state === 'progressing' ? (
                            <>
                              {entry.paused && entry.canResume ? (
                                <button
                                  type="button"
                                  onClick={() => void window.lockin.resumeDownload(entry.id)}
                                >
                                  Resume
                                </button>
                              ) : !entry.paused ? (
                                <button
                                  type="button"
                                  onClick={() => void window.lockin.pauseDownload(entry.id)}
                                >
                                  Pause
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="danger"
                                onClick={() => void window.lockin.cancelDownload(entry.id)}
                              >
                                Cancel
                              </button>
                            </>
                          ) : null}
                          {entry.state === 'completed' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void window.lockin.openDownload(entry.id)}
                              >
                                Open
                              </button>
                              <button
                                type="button"
                                onClick={() => void window.lockin.showDownloadInFolder(entry.id)}
                              >
                                Show
                              </button>
                            </>
                          ) : null}
                          <button
                            type="button"
                            className="danger"
                            aria-label="Remove"
                            onClick={() => void window.lockin.removeDownload(entry.id)}
                          >
                            ×
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  className="downloads-footer"
                  onClick={() => {
                    closeDownloads()
                    void window.lockin.createTab('lockin://downloads')
                  }}
                >
                  Show all downloads
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="app-menu" ref={menuRef}>
          <button
            type="button"
            className={`app-menu-button${menuOpen ? ' is-open' : ''}`}
            aria-label="Menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => {
              closeSuggestions()
              closeDownloads()
              setMenuOpen((open) => !open)
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="3.5" r="1.35" fill="currentColor" />
              <circle cx="8" cy="8" r="1.35" fill="currentColor" />
              <circle cx="8" cy="12.5" r="1.35" fill="currentColor" />
            </svg>
          </button>
          {menuOpen ? (
            <div className="app-menu-dropdown" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  closeMenu()
                  onNavigate('lockin://downloads')
                }}
              >
                Downloads
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  closeMenu()
                  onNavigate('lockin://history')
                }}
              >
                Browser history
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  closeMenu()
                  onNavigate('lockin://passwords')
                }}
              >
                Passwords
              </button>
            </div>
          ) : null}
        </div>
      </form>
      {overlayOpen ? (
        <button
          type="button"
          className="app-menu-backdrop"
          aria-label="Close menu"
          onClick={() => {
            closeMenu()
            closeDownloads()
            closeSuggestions()
          }}
        />
      ) : null}
    </>
  )
}
