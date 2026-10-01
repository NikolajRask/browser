import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent
} from 'react'
import {
  AI_SIDEBAR_WIDTH,
  type AiChatMessage,
  type AiChatScreenshot,
  type AiChatSessionSummary,
  type AiChatStoredMessage
} from '../../../shared/ipc'
import { AiMarkdown } from './AiMarkdown'

type Props = {
  onClose: () => void
  onOpenSettings: () => void
}

type DisplayMessage =
  | {
      id: string
      kind: 'chat'
      role: 'user' | 'assistant'
      content: string
      screenshots?: AiChatScreenshot[]
    }
  | { id: string; kind: 'error'; content: string }

type HistoryGroup = {
  label: string
  items: AiChatSessionSummary[]
}

const MAX_ATTACHMENTS = 6

function nextId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `ai-msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function toStoredMessages(messages: DisplayMessage[]): AiChatStoredMessage[] {
  return messages.map((message) => {
    if (message.kind === 'error') {
      return { id: message.id, role: 'error', content: message.content }
    }
    const stored: AiChatStoredMessage = {
      id: message.id,
      role: message.role,
      content: message.content
    }
    if (message.role === 'user' && message.screenshots && message.screenshots.length > 0) {
      stored.screenshots = message.screenshots
    }
    return stored
  })
}

function fromStoredMessages(messages: AiChatStoredMessage[]): DisplayMessage[] {
  return messages.map((message) => {
    if (message.role === 'error') {
      return { id: message.id, kind: 'error', content: message.content }
    }
    return {
      id: message.id,
      kind: 'chat',
      role: message.role,
      content: message.content,
      screenshots: message.screenshots
    }
  })
}

function isPersistable(message: AiChatStoredMessage): boolean {
  if (message.content.trim()) return true
  return Boolean(message.screenshots && message.screenshots.length > 0)
}

function screenshotSrc(shot: AiChatScreenshot): string {
  return `data:${shot.mediaType};base64,${shot.imageBase64}`
}

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function groupSessions(sessions: AiChatSessionSummary[], query: string): HistoryGroup[] {
  const needle = query.trim().toLowerCase()
  const filtered = needle
    ? sessions.filter((session) => session.title.toLowerCase().includes(needle))
    : sessions

  const pinned = filtered.filter((session) => session.pinned)
  const unpinned = filtered.filter((session) => !session.pinned)

  const groups: HistoryGroup[] = []
  if (pinned.length > 0) {
    groups.push({ label: 'Pinned', items: pinned })
  }

  const today = startOfDay(Date.now())
  const yesterday = today - 24 * 60 * 60 * 1000
  const weekAgo = today - 7 * 24 * 60 * 60 * 1000

  const buckets: HistoryGroup[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Previous 7 days', items: [] },
    { label: 'Older', items: [] }
  ]

  for (const session of unpinned) {
    const day = startOfDay(session.updatedAt)
    if (day >= today) buckets[0].items.push(session)
    else if (day >= yesterday) buckets[1].items.push(session)
    else if (day >= weekAgo) buckets[2].items.push(session)
    else buckets[3].items.push(session)
  }

  for (const bucket of buckets) {
    if (bucket.items.length > 0) groups.push(bucket)
  }
  return groups
}

export function AiSidebar({ onClose, onOpenSettings }: Props): React.JSX.Element {
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [streamingId, setStreamingId] = useState<string | null>(null)
  const [width, setWidth] = useState(AI_SIDEBAR_WIDTH)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyQuery, setHistoryQuery] = useState('')
  const [sessions, setSessions] = useState<AiChatSessionSummary[]>([])
  const [attachments, setAttachments] = useState<AiChatScreenshot[]>([])
  const [capturing, setCapturing] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const streamingIdRef = useRef<string | null>(null)
  const historyRef = useRef<HTMLDivElement>(null)
  const sessionIdRef = useRef<string | null>(null)

  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  useEffect(() => {
    void window.lockin.aiHasKey().then(setHasKey)
    void window.lockin.getAiSidebarWidth().then(setWidth)
    return window.lockin.onAiSidebarWidthChanged(setWidth)
  }, [])

  useEffect(() => {
    return window.lockin.onAiChatChunk((chunk) => {
      const id = streamingIdRef.current
      if (!id || !chunk.text) return
      setMessages((prev) =>
        prev.map((message) =>
          message.id === id && message.kind === 'chat'
            ? { ...message, content: message.content + chunk.text }
            : message
        )
      )
    })
  }, [])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, sending, streamingId])

  useEffect(() => {
    if (hasKey) inputRef.current?.focus()
  }, [hasKey])

  useEffect(() => {
    if (!historyOpen) return
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node | null
      if (historyRef.current && target && !historyRef.current.contains(target)) {
        setHistoryOpen(false)
      }
    }
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') setHistoryOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [historyOpen])

  const historyGroups = useMemo(
    () => groupSessions(sessions, historyQuery),
    [sessions, historyQuery]
  )

  const refreshSessions = async (): Promise<void> => {
    const list = await window.lockin.listAiChats()
    setSessions(list)
  }

  const persistMessages = async (nextMessages: DisplayMessage[]): Promise<void> => {
    const stored = toStoredMessages(nextMessages).filter(isPersistable)
    if (stored.length === 0) return
    const saved = await window.lockin.saveAiChat({
      id: sessionIdRef.current ?? undefined,
      messages: stored
    })
    if (!saved) return
    setSessionId(saved.id)
    sessionIdRef.current = saved.id
    if (historyOpen) void refreshSessions()
  }

  const openHistory = async (): Promise<void> => {
    if (historyOpen) {
      setHistoryOpen(false)
      return
    }
    await refreshSessions()
    setHistoryQuery('')
    setHistoryOpen(true)
  }

  const startNewChat = (): void => {
    if (sending) return
    setSessionId(null)
    sessionIdRef.current = null
    setMessages([])
    setDraft('')
    setAttachments([])
    setHistoryOpen(false)
    inputRef.current?.focus()
  }

  const addScreenshot = async (): Promise<void> => {
    if (sending || capturing || hasKey === false) return
    if (attachments.length >= MAX_ATTACHMENTS) return
    setCapturing(true)
    try {
      const shot = await window.lockin.captureAiScreenshot()
      if (!shot) {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            kind: 'error',
            content: 'Could not capture a screenshot of the current tab.'
          }
        ])
        return
      }
      setAttachments((prev) => {
        if (prev.length >= MAX_ATTACHMENTS) return prev
        return [...prev, { ...shot, id: nextId() }]
      })
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          kind: 'error',
          content: 'Could not capture a screenshot of the current tab.'
        }
      ])
    } finally {
      setCapturing(false)
      inputRef.current?.focus()
    }
  }

  const removeAttachment = (id: string): void => {
    setAttachments((prev) => prev.filter((shot) => shot.id !== id))
  }

  const loadSession = async (id: string): Promise<void> => {
    if (sending) return
    const session = await window.lockin.getAiChat(id)
    if (!session) return
    setSessionId(session.id)
    sessionIdRef.current = session.id
    setMessages(fromStoredMessages(session.messages))
    setAttachments([])
    setDraft('')
    setHistoryOpen(false)
    inputRef.current?.focus()
  }

  const togglePin = async (id: string, pinned: boolean, event: React.MouseEvent): Promise<void> => {
    event.stopPropagation()
    await window.lockin.setAiChatPinned(id, !pinned)
    await refreshSessions()
  }

  const deleteSession = async (id: string, event: React.MouseEvent): Promise<void> => {
    event.stopPropagation()
    await window.lockin.removeAiChat(id)
    if (sessionIdRef.current === id) {
      setSessionId(null)
      sessionIdRef.current = null
      setMessages([])
    }
    await refreshSessions()
  }

  const onResizePointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    event.preventDefault()
    event.stopPropagation()
    const target = event.currentTarget
    try {
      target.setPointerCapture(event.pointerId)
    } catch {
      // Ignore — overlay still tracks the drag.
    }

    window.lockin.startAiSidebarResize()
    window.lockin.moveAiSidebarResize(event.screenX)

    const onMove = (moveEvent: PointerEvent): void => {
      window.lockin.moveAiSidebarResize(moveEvent.screenX)
    }
    const onUp = (upEvent: PointerEvent): void => {
      try {
        if (target.hasPointerCapture(upEvent.pointerId)) {
          target.releasePointerCapture(upEvent.pointerId)
        }
      } catch {
        // Ignore.
      }
      window.lockin.endAiSidebarResize()
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
    }

    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onUp)
  }

  const send = async (): Promise<void> => {
    const content = draft.trim()
    const pendingShots = attachments
    if ((!content && pendingShots.length === 0) || sending) return

    const keyReady = hasKey ?? (await window.lockin.aiHasKey())
    setHasKey(keyReady)
    if (!keyReady) {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          kind: 'error',
          content: 'Add your Claude API key in Settings to use the AI assistant.'
        }
      ])
      return
    }

    const apiContent =
      content ||
      (pendingShots.length > 1
        ? 'Please review the attached screenshots.'
        : 'Please review the attached screenshot.')

    const userMessage: DisplayMessage = {
      id: nextId(),
      kind: 'chat',
      role: 'user',
      content,
      screenshots: pendingShots.length > 0 ? pendingShots : undefined
    }
    const assistantId = nextId()
    const assistantMessage: DisplayMessage = {
      id: assistantId,
      kind: 'chat',
      role: 'assistant',
      content: ''
    }
    const nextMessages = [...messages, userMessage, assistantMessage]
    setMessages(nextMessages)
    setDraft('')
    setAttachments([])
    setSending(true)
    streamingIdRef.current = assistantId
    setStreamingId(assistantId)

    // Ensure a session id exists before the reply so later saves update the same chat.
    await persistMessages([...messages, userMessage])

    const chatMessages: AiChatMessage[] = nextMessages
      .filter(
        (message): message is Extract<DisplayMessage, { kind: 'chat' }> =>
          message.kind === 'chat' && message.id !== assistantId
      )
      .map((message) => {
        if (message.id === userMessage.id) {
          return { role: message.role, content: apiContent }
        }
        if (message.content.trim()) {
          return { role: message.role, content: message.content }
        }
        if (message.screenshots && message.screenshots.length > 0) {
          return {
            role: message.role,
            content:
              message.screenshots.length > 1
                ? 'Please review the attached screenshots.'
                : 'Please review the attached screenshot.'
          }
        }
        return { role: message.role, content: message.content }
      })

    try {
      const result = await window.lockin.aiChat({
        messages: chatMessages,
        screenshots: pendingShots.length > 0 ? pendingShots : undefined
      })
      if ('error' in result) {
        setMessages((prev) => {
          const withoutEmpty = prev.filter(
            (message) => !(message.id === assistantId && message.kind === 'chat' && !message.content)
          )
          const withError: DisplayMessage[] = [
            ...withoutEmpty,
            { id: nextId(), kind: 'error', content: result.error }
          ]
          void persistMessages(withError)
          return withError
        })
      } else {
        setMessages((prev) => {
          const updated = prev.map((message) =>
            message.id === assistantId && message.kind === 'chat'
              ? { ...message, content: result.text }
              : message
          )
          void persistMessages(updated)
          return updated
        })
      }
    } catch {
      setMessages((prev) => {
        const withoutEmpty = prev.filter(
          (message) => !(message.id === assistantId && message.kind === 'chat' && !message.content)
        )
        const withError: DisplayMessage[] = [
          ...withoutEmpty,
          { id: nextId(), kind: 'error', content: 'Failed to reach the AI assistant.' }
        ]
        void persistMessages(withError)
        return withError
      })
    } finally {
      streamingIdRef.current = null
      setStreamingId(null)
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const onSubmit = (event: FormEvent): void => {
    event.preventDefault()
    void send()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void send()
    }
  }

  const showThinking = sending && streamingId !== null &&
    !messages.some(
      (message) => message.id === streamingId && message.kind === 'chat' && message.content.length > 0
    )

  return (
    <aside
      className="ai-sidebar"
      aria-label="AI Assistant"
      style={{ ['--ai-sidebar-current-width' as string]: `${width}px` }}
    >
      <div className="ai-sidebar-body">
        <div
          className="ai-sidebar-resize"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize AI Assistant"
          onPointerDown={onResizePointerDown}
        />
        <div className="ai-sidebar-header">
          <div className="ai-sidebar-brand">
            <span className="ai-sidebar-brand-mark" aria-hidden="true" />
            <div className="ai-sidebar-brand-text">
              <h2 className="ai-sidebar-title">AI Assistant</h2>
              <p className="ai-sidebar-subtitle">Claude · page aware</p>
            </div>
          </div>
          <div className="ai-sidebar-header-actions" ref={historyRef}>
            <button
              type="button"
              className={`ai-sidebar-icon-btn${historyOpen ? ' is-active' : ''}`}
              aria-label="Chat history"
              aria-expanded={historyOpen}
              onClick={() => void openHistory()}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path
                  d="M8 4.5V8l2.4 1.6"
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
              className="ai-sidebar-icon-btn"
              aria-label="New chat"
              onClick={startNewChat}
              disabled={sending}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
                <path
                  d="M8 3.2v9.6M3.2 8h9.6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <button type="button" className="ai-sidebar-close" aria-label="Close AI Assistant" onClick={onClose}>
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path
                  d="M3.2 3.2 10.8 10.8M10.8 3.2 3.2 10.8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>

            {historyOpen ? (
              <div className="ai-history-popover" role="dialog" aria-label="Chat history">
                <input
                  className="ai-history-search"
                  type="search"
                  value={historyQuery}
                  onChange={(event) => setHistoryQuery(event.target.value)}
                  placeholder="Search chats…"
                  autoFocus
                />
                <div className="ai-history-list">
                  {historyGroups.length === 0 ? (
                    <div className="ai-history-empty">
                      {sessions.length === 0 ? 'No saved chats yet.' : 'No matching chats.'}
                    </div>
                  ) : (
                    historyGroups.map((group) => (
                      <div key={group.label} className="ai-history-group">
                        <div className="ai-history-group-label">{group.label}</div>
                        {group.items.map((session) => (
                          <div
                            key={session.id}
                            className={`ai-history-item${session.id === sessionId ? ' is-active' : ''}`}
                          >
                            <button
                              type="button"
                              className="ai-history-item-main"
                              onClick={() => void loadSession(session.id)}
                            >
                              <span className="ai-history-item-icon" aria-hidden="true">
                                <svg width="14" height="14" viewBox="0 0 16 16">
                                  <circle
                                    cx="8"
                                    cy="8"
                                    r="6"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.4"
                                  />
                                  <path
                                    d="M5.2 8.1 7.1 10l3.7-4.2"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.4"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </span>
                              <span className="ai-history-item-title">{session.title}</span>
                            </button>
                            <span className="ai-history-item-actions">
                              <button
                                type="button"
                                className={`ai-history-action${session.pinned ? ' is-on' : ''}`}
                                aria-label={session.pinned ? 'Unpin chat' : 'Pin chat'}
                                onClick={(event) => void togglePin(session.id, session.pinned, event)}
                              >
                                <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true">
                                  <path
                                    d="M8.8 2.4 12.2 5.8 9.6 8.4l.6 3.2-1.7-1-1.7 1 .6-3.2L5 5.8z"
                                    fill={session.pinned ? 'currentColor' : 'none'}
                                    stroke="currentColor"
                                    strokeWidth="1.3"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </button>
                              <button
                                type="button"
                                className="ai-history-action is-danger"
                                aria-label="Delete chat"
                                onClick={(event) => void deleteSession(session.id, event)}
                              >
                                <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true">
                                  <path
                                    d="M3.5 4.5h9M6.2 4.5V3.4h3.6v1.1M5.2 4.5l.5 8.1h4.6l.5-8.1"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </button>
                            </span>
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="ai-sidebar-messages" ref={listRef}>
          {hasKey === false ? (
            <div className="ai-sidebar-empty">
              <span className="ai-sidebar-empty-mark" aria-hidden="true" />
              <p>
                Add your Claude API key in{' '}
                <button type="button" className="link" onClick={onOpenSettings}>
                  Settings
                </button>{' '}
                to start chatting.
              </p>
            </div>
          ) : null}

          {hasKey !== false && messages.length === 0 && !sending ? (
            <div className="ai-sidebar-empty">
              <span className="ai-sidebar-empty-mark" aria-hidden="true" />
              <p className="ai-sidebar-empty-title">Ready when you are</p>
              <p>
                Ask anything about the page, homework, or code. Page text is included when helpful;
                attach screenshots for visual context.
              </p>
            </div>
          ) : null}

          {messages.map((message) => {
            if (message.kind === 'error') {
              return (
                <div key={message.id} className="ai-sidebar-bubble is-error">
                  {message.content}
                </div>
              )
            }

            if (message.role === 'assistant' && !message.content) {
              // Empty placeholder while waiting for the first streamed token.
              return null
            }

            const isStreaming = message.id === streamingId
            const shots = message.role === 'user' ? message.screenshots : undefined
            return (
              <div
                key={message.id}
                className={`ai-sidebar-bubble ${message.role === 'user' ? 'is-user' : 'is-assistant'}${
                  isStreaming ? ' is-streaming' : ''
                }`}
              >
                {shots && shots.length > 0 ? (
                  <div className="ai-sidebar-bubble-shots">
                    {shots.map((shot) => (
                      <img
                        key={shot.id}
                        className="ai-sidebar-bubble-shot"
                        src={screenshotSrc(shot)}
                        alt={shot.title || 'Page screenshot'}
                        title={shot.title || shot.url || 'Page screenshot'}
                      />
                    ))}
                  </div>
                ) : null}
                {message.role === 'assistant' ? (
                  <AiMarkdown content={message.content} streaming={isStreaming} />
                ) : message.content ? (
                  message.content
                ) : null}
                {isStreaming ? <span className="ai-sidebar-caret" aria-hidden="true" /> : null}
              </div>
            )
          })}

          {showThinking ? (
            <div className="ai-sidebar-status" aria-live="polite">
              <span className="ai-sidebar-status-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              Thinking…
            </div>
          ) : null}
        </div>

        <form className="ai-sidebar-composer" onSubmit={onSubmit}>
          <div className="ai-sidebar-composer-shell">
            {attachments.length > 0 ? (
              <div className="ai-sidebar-attachments" aria-label="Attached screenshots">
                {attachments.map((shot) => (
                  <div key={shot.id} className="ai-sidebar-attachment">
                    <img src={screenshotSrc(shot)} alt={shot.title || 'Page screenshot'} />
                    <button
                      type="button"
                      className="ai-sidebar-attachment-remove"
                      aria-label="Remove screenshot"
                      onClick={() => removeAttachment(shot.id)}
                      disabled={sending}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder={
                hasKey === false
                  ? 'Configure an API key first…'
                  : attachments.length > 0
                    ? 'Ask about the screenshot(s)…'
                    : 'Message Claude…'
              }
              disabled={sending || hasKey === false}
              rows={3}
            />
            <div className="ai-sidebar-composer-row">
              <button
                type="button"
                className="ai-sidebar-attach"
                onClick={() => void addScreenshot()}
                disabled={
                  sending || capturing || hasKey === false || attachments.length >= MAX_ATTACHMENTS
                }
                aria-label="Add page screenshot"
                title={
                  attachments.length >= MAX_ATTACHMENTS
                    ? `Maximum ${MAX_ATTACHMENTS} screenshots`
                    : 'Add screenshot of current tab'
                }
              >
                <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
                  <rect
                    x="2.25"
                    y="3.25"
                    width="11.5"
                    height="9.5"
                    rx="1.6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  />
                  <circle cx="8" cy="8" r="2.15" fill="none" stroke="currentColor" strokeWidth="1.4" />
                  <path
                    d="M11.2 3.2h1.4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
                {capturing ? 'Capturing…' : 'Screenshot'}
              </button>
              <button
                type="submit"
                className="ai-sidebar-send"
                disabled={
                  sending || hasKey === false || (!draft.trim() && attachments.length === 0)
                }
              >
                Send
              </button>
            </div>
          </div>
        </form>
      </div>
    </aside>
  )
}
