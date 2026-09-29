import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

type FindBarProps = {
  open: boolean
  focusKey: number
  onClose: () => void
}

export function FindBar({ open, focusKey, onClose }: FindBarProps): React.JSX.Element | null {
  const inputRef = useRef<HTMLInputElement>(null)
  const queryRef = useRef('')
  const [query, setQuery] = useState('')
  const [matchLabel, setMatchLabel] = useState('')
  const [hasMatches, setHasMatches] = useState(true)

  useEffect(() => {
    queryRef.current = query
  }, [query])

  useEffect(() => {
    if (!open) return

    const input = inputRef.current
    if (input) {
      input.focus()
      input.select()
    }

    void window.lockin.setFindOpen(true)
    if (queryRef.current) void window.lockin.findInPage(queryRef.current)
  }, [open, focusKey])

  useEffect(() => {
    if (!open) return

    return window.lockin.onFindResult((result) => {
      if (!result.finalUpdate) return
      if (!queryRef.current) {
        setMatchLabel('')
        setHasMatches(true)
        return
      }
      if (result.matches === 0) {
        setMatchLabel('No results')
        setHasMatches(false)
        return
      }
      setMatchLabel(`${result.activeMatchOrdinal} of ${result.matches}`)
      setHasMatches(true)
    })
  }, [open])

  if (!open) return null

  const close = (): void => {
    setMatchLabel('')
    setHasMatches(true)
    void window.lockin.setFindOpen(false)
    onClose()
  }

  const onChange = (value: string): void => {
    setQuery(value)
    void window.lockin.findInPage(value)
    if (!value) {
      setMatchLabel('')
      setHasMatches(true)
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      if (event.shiftKey) void window.lockin.findPrevious()
      else void window.lockin.findNext()
    }
  }

  return (
    <div className="find-bar" role="search">
      <input
        ref={inputRef}
        className={`find-bar-input${!hasMatches && query ? ' find-bar-input--empty' : ''}`}
        type="text"
        value={query}
        placeholder="Find in page"
        aria-label="Find in page"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <span className={`find-bar-count${!hasMatches && query ? ' find-bar-count--empty' : ''}`}>
        {matchLabel}
      </span>
      <div className="find-bar-actions">
        <button
          type="button"
          className="find-bar-btn"
          aria-label="Previous match"
          disabled={!query || !hasMatches}
          onClick={() => void window.lockin.findPrevious()}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path
              d="M4.5 10.5 8 7l3.5 3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          className="find-bar-btn"
          aria-label="Next match"
          disabled={!query || !hasMatches}
          onClick={() => void window.lockin.findNext()}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path
              d="M4.5 5.5 8 9l3.5-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button type="button" className="find-bar-btn" aria-label="Close find" onClick={close}>
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path
              d="M4 4l8 8M12 4l-8 8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}
