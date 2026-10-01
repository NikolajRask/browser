import { randomUUID } from 'crypto'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { app } from 'electron'
import type { HistoryClearRange } from '../shared/ipc'

export type HistoryEntry = {
  id: string
  url: string
  title: string
  favicon: string | null
  visitedAt: number
}

export type HistoryVisitInput = {
  url: string
  title?: string
  favicon?: string | null
  visitedAt?: number
}

const MAX_ENTRIES = 1000

const CLEAR_RANGE_MS: Record<Exclude<HistoryClearRange, 'all'>, number> = {
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000
}

export function shouldRecordHistoryUrl(url: string): boolean {
  if (!url || url === 'about:blank') return false
  if (url.startsWith('lockin://')) return false
  if (url.startsWith('data:')) return false
  return true
}

export class HistoryStore {
  private entries: HistoryEntry[] = []
  private filePath: string
  private loaded = false

  constructor(filePath?: string) {
    this.filePath = filePath ?? join(app.getPath('userData'), 'history.json')
  }

  private ensureLoaded(): void {
    if (this.loaded) return
    this.loaded = true

    try {
      if (!existsSync(this.filePath)) return
      const raw = readFileSync(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) return

      this.entries = parsed
        .filter((item): item is HistoryEntry => {
          return (
            !!item &&
            typeof item === 'object' &&
            typeof (item as HistoryEntry).id === 'string' &&
            typeof (item as HistoryEntry).url === 'string' &&
            typeof (item as HistoryEntry).visitedAt === 'number'
          )
        })
        .map((item) => ({
          id: item.id,
          url: item.url,
          title: typeof item.title === 'string' ? item.title : item.url,
          favicon: typeof item.favicon === 'string' ? item.favicon : null,
          visitedAt: item.visitedAt
        }))
        .sort((a, b) => b.visitedAt - a.visitedAt)
        .slice(0, MAX_ENTRIES)
    } catch {
      this.entries = []
    }
  }

  private persist(): void {
    try {
      const dir = dirname(this.filePath)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(this.filePath, JSON.stringify(this.entries), 'utf8')
    } catch {
      // Ignore disk errors; in-memory state remains usable for the session.
    }
  }

  list(options?: { offset?: number; limit?: number }): {
    entries: HistoryEntry[]
    total: number
  } {
    this.ensureLoaded()
    const total = this.entries.length
    const offset = Math.max(0, Math.floor(options?.offset ?? 0))
    const limit =
      typeof options?.limit === 'number' && Number.isFinite(options.limit)
        ? Math.max(0, Math.floor(options.limit))
        : total

    return {
      entries: this.entries.slice(offset, offset + limit).map((entry) => ({ ...entry })),
      total
    }
  }

  add(visit: HistoryVisitInput): HistoryEntry | null {
    this.ensureLoaded()
    if (!shouldRecordHistoryUrl(visit.url)) return null

    const entry: HistoryEntry = {
      id: randomUUID(),
      url: visit.url,
      title: visit.title?.trim() || visit.url,
      favicon: visit.favicon ?? null,
      visitedAt: visit.visitedAt ?? Date.now()
    }

    this.entries.unshift(entry)
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.length = MAX_ENTRIES
    }
    this.persist()
    return { ...entry }
  }

  remove(id: string): boolean {
    this.ensureLoaded()
    const next = this.entries.filter((entry) => entry.id !== id)
    if (next.length === this.entries.length) return false
    this.entries = next
    this.persist()
    return true
  }

  clear(range: HistoryClearRange = 'all'): void {
    this.ensureLoaded()

    if (range === 'all') {
      this.entries = []
      this.persist()
      return
    }

    const cutoff = Date.now() - CLEAR_RANGE_MS[range]
    const next = this.entries.filter((entry) => entry.visitedAt < cutoff)
    if (next.length === this.entries.length) return
    this.entries = next
    this.persist()
  }

  updateMeta(url: string, meta: { title?: string; favicon?: string | null }): void {
    this.ensureLoaded()
    if (!shouldRecordHistoryUrl(url)) return

    const entry = this.entries.find((item) => item.url === url)
    if (!entry) return

    let changed = false
    if (typeof meta.title === 'string' && meta.title.trim() && entry.title !== meta.title) {
      entry.title = meta.title.trim()
      changed = true
    }
    if (meta.favicon !== undefined && entry.favicon !== meta.favicon) {
      entry.favicon = meta.favicon
      changed = true
    }

    if (changed) this.persist()
  }

  suggest(query: string, limit = 10): HistoryEntry[] {
    this.ensureLoaded()
    // Keep trailing spaces so "you " does not match "youtube.com".
    const q = query.trimStart().toLowerCase()
    if (!q.trim() || limit <= 0) return []

    type Candidate = HistoryEntry & { visits: number; score: number }
    const byUrl = new Map<string, Candidate>()

    for (const entry of this.entries) {
      const existing = byUrl.get(entry.url)
      if (existing) {
        existing.visits += 1
        if (entry.visitedAt > existing.visitedAt) {
          existing.visitedAt = entry.visitedAt
          existing.title = entry.title
          existing.favicon = entry.favicon
          existing.id = entry.id
        }
        continue
      }

      byUrl.set(entry.url, { ...entry, visits: 1, score: 0 })
    }

    const scored: Candidate[] = []
    for (const candidate of byUrl.values()) {
      const score = scoreHistoryMatch(q, candidate)
      if (score <= 0) continue
      candidate.score = score
      scored.push(candidate)
    }

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (b.visits !== a.visits) return b.visits - a.visits
      return b.visitedAt - a.visitedAt
    })

    return scored.slice(0, limit).map(({ id, url, title, favicon, visitedAt }) => ({
      id,
      url,
      title,
      favicon,
      visitedAt
    }))
  }
}

function scoreHistoryMatch(query: string, entry: HistoryEntry): number {
  const url = entry.url.toLowerCase()
  const title = entry.title.toLowerCase()

  let host = ''
  let hostNoWww = ''
  try {
    const parsed = new URL(entry.url)
    host = parsed.hostname.toLowerCase()
    hostNoWww = host.startsWith('www.') ? host.slice(4) : host
  } catch {
    // Non-standard URLs still match against raw url/title.
  }

  if (hostNoWww.startsWith(query) || host.startsWith(query)) return 100
  if (url.startsWith(query)) return 90
  if (title.startsWith(query)) return 80
  if (hostNoWww.includes(query) || host.includes(query)) return 70
  if (url.includes(query)) return 60
  if (title.includes(query)) return 50
  return 0
}
