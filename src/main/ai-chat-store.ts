import { randomUUID } from 'crypto'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { app } from 'electron'
import type {
  AiChatSavePayload,
  AiChatScreenshot,
  AiChatSession,
  AiChatSessionSummary,
  AiChatStoredMessage
} from '../shared/ipc'

const MAX_SESSIONS = 100
const TITLE_MAX = 48

type PersistedState = {
  version: 1
  sessions: Record<string, AiChatSession>
}

function titleFromMessages(messages: AiChatStoredMessage[]): string {
  const firstUser = messages.find(
    (message) =>
      message.role === 'user' &&
      (message.content.trim() || (message.screenshots && message.screenshots.length > 0))
  )
  if (!firstUser) return 'New chat'
  if (firstUser.content.trim()) {
    const compact = firstUser.content.trim().replace(/\s+/g, ' ')
    if (compact.length <= TITLE_MAX) return compact
    return `${compact.slice(0, TITLE_MAX).trimEnd()}…`
  }
  const count = firstUser.screenshots?.length ?? 0
  return count > 1 ? `Screenshots (${count})` : 'Page screenshot'
}

function sanitizeScreenshots(value: unknown): AiChatScreenshot[] {
  if (!Array.isArray(value)) return []
  const screenshots: AiChatScreenshot[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const imageBase64 = (item as AiChatScreenshot).imageBase64
    if (typeof imageBase64 !== 'string' || imageBase64.length < 32) continue
    screenshots.push({
      id:
        typeof (item as AiChatScreenshot).id === 'string' && (item as AiChatScreenshot).id
          ? (item as AiChatScreenshot).id
          : randomUUID(),
      imageBase64,
      mediaType: 'image/jpeg',
      title:
        typeof (item as AiChatScreenshot).title === 'string' ? (item as AiChatScreenshot).title : '',
      url: typeof (item as AiChatScreenshot).url === 'string' ? (item as AiChatScreenshot).url : '',
      capturedAt:
        typeof (item as AiChatScreenshot).capturedAt === 'number'
          ? (item as AiChatScreenshot).capturedAt
          : Date.now()
    })
  }
  return screenshots.slice(0, 6)
}

function sanitizeMessages(value: unknown): AiChatStoredMessage[] {
  if (!Array.isArray(value)) return []
  const messages: AiChatStoredMessage[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const role = (item as AiChatStoredMessage).role
    const content = (item as AiChatStoredMessage).content
    const id = (item as AiChatStoredMessage).id
    if (role !== 'user' && role !== 'assistant' && role !== 'error') continue
    if (typeof content !== 'string') continue
    const screenshots = sanitizeScreenshots((item as AiChatStoredMessage).screenshots)
    const message: AiChatStoredMessage = {
      id: typeof id === 'string' && id ? id : randomUUID(),
      role,
      content
    }
    if (screenshots.length > 0) message.screenshots = screenshots
    messages.push(message)
  }
  return messages
}

function toSummary(session: AiChatSession): AiChatSessionSummary {
  return {
    id: session.id,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    pinned: session.pinned
  }
}

function cloneSession(session: AiChatSession): AiChatSession {
  return {
    ...session,
    messages: session.messages.map((message) => ({
      ...message,
      screenshots: message.screenshots?.map((shot) => ({ ...shot }))
    }))
  }
}

export class AiChatStore {
  private sessions: Record<string, AiChatSession> = {}
  private filePath: string
  private loaded = false

  constructor(filePath?: string) {
    this.filePath = filePath ?? join(app.getPath('userData'), 'ai-chats.json')
  }

  private ensureLoaded(): void {
    if (this.loaded) return
    this.loaded = true

    try {
      if (!existsSync(this.filePath)) return
      const raw = readFileSync(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as unknown
      if (!parsed || typeof parsed !== 'object') return
      const state = parsed as PersistedState
      if (state.version !== 1 || !state.sessions || typeof state.sessions !== 'object') return

      const sessions: Record<string, AiChatSession> = {}
      for (const [id, item] of Object.entries(state.sessions)) {
        if (!item || typeof item !== 'object') continue
        const messages = sanitizeMessages(item.messages)
        if (messages.length === 0) continue
        const createdAt = typeof item.createdAt === 'number' ? item.createdAt : Date.now()
        const updatedAt = typeof item.updatedAt === 'number' ? item.updatedAt : createdAt
        const title =
          typeof item.title === 'string' && item.title.trim()
            ? item.title.trim()
            : titleFromMessages(messages)
        sessions[id] = {
          id,
          title,
          createdAt,
          updatedAt,
          pinned: Boolean(item.pinned),
          messages
        }
      }
      this.sessions = sessions
      this.trimToLimit()
    } catch {
      this.sessions = {}
    }
  }

  private persist(): void {
    try {
      const dir = dirname(this.filePath)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      const state: PersistedState = { version: 1, sessions: this.sessions }
      writeFileSync(this.filePath, JSON.stringify(state), 'utf8')
    } catch {
      // Ignore disk errors; in-memory state remains usable for the session.
    }
  }

  private trimToLimit(): void {
    const ids = Object.keys(this.sessions)
    if (ids.length <= MAX_SESSIONS) return

    const ranked = ids
      .map((id) => this.sessions[id])
      .filter((session): session is AiChatSession => Boolean(session))
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        return b.updatedAt - a.updatedAt
      })

    const keep = new Set(ranked.slice(0, MAX_SESSIONS).map((session) => session.id))
    for (const id of ids) {
      if (!keep.has(id)) delete this.sessions[id]
    }
  }

  list(): AiChatSessionSummary[] {
    this.ensureLoaded()
    return Object.values(this.sessions)
      .map(toSummary)
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        return b.updatedAt - a.updatedAt
      })
  }

  get(id: string): AiChatSession | null {
    this.ensureLoaded()
    const session = this.sessions[id]
    return session ? cloneSession(session) : null
  }

  save(payload: AiChatSavePayload): AiChatSession | null {
    this.ensureLoaded()
    const messages = sanitizeMessages(payload?.messages)
    if (messages.length === 0) return null

    const now = Date.now()
    const existingId = typeof payload.id === 'string' ? payload.id : ''
    const existing = existingId ? this.sessions[existingId] : undefined

    const titleOverride =
      typeof payload.title === 'string' && payload.title.trim() ? payload.title.trim() : null
    const title = titleOverride ?? (existing?.title || titleFromMessages(messages))

    const session: AiChatSession = {
      id: existing?.id ?? randomUUID(),
      title,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      pinned: existing?.pinned ?? false,
      messages
    }

    this.sessions[session.id] = session
    this.trimToLimit()
    this.persist()
    return cloneSession(session)
  }

  remove(id: string): boolean {
    this.ensureLoaded()
    if (!this.sessions[id]) return false
    delete this.sessions[id]
    this.persist()
    return true
  }

  setPinned(id: string, pinned: boolean): boolean {
    this.ensureLoaded()
    const session = this.sessions[id]
    if (!session) return false
    session.pinned = Boolean(pinned)
    session.updatedAt = Date.now()
    this.persist()
    return true
  }
}
