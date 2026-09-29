import { randomUUID } from 'crypto'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { app } from 'electron'
import type { DownloadEntry, DownloadState } from '../shared/ipc'

const MAX_ENTRIES = 500

const VALID_STATES = new Set<DownloadState>([
  'progressing',
  'completed',
  'cancelled',
  'interrupted'
])

export type DownloadUpsertInput = {
  id?: string
  url: string
  filename: string
  savePath: string
  mimeType: string
  totalBytes: number
  receivedBytes: number
  state: DownloadState
  startedAt?: number
  endedAt?: number | null
  canResume?: boolean
  paused?: boolean
}

export class DownloadsStore {
  private entries: DownloadEntry[] = []
  private filePath: string
  private loaded = false

  constructor(filePath?: string) {
    this.filePath = filePath ?? join(app.getPath('userData'), 'downloads.json')
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
        .filter((item): item is DownloadEntry => isDownloadEntry(item))
        .map((item) => normalizeEntry(item))
        .sort((a, b) => b.startedAt - a.startedAt)
        .slice(0, MAX_ENTRIES)

      // In-progress items from a previous session cannot be resumed.
      for (const entry of this.entries) {
        if (entry.state === 'progressing') {
          entry.state = 'interrupted'
          entry.endedAt = entry.endedAt ?? Date.now()
          entry.canResume = false
          entry.paused = false
        }
      }
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

  list(): DownloadEntry[] {
    this.ensureLoaded()
    return this.entries.map((entry) => ({ ...entry }))
  }

  get(id: string): DownloadEntry | null {
    this.ensureLoaded()
    const entry = this.entries.find((item) => item.id === id)
    return entry ? { ...entry } : null
  }

  upsert(input: DownloadUpsertInput): DownloadEntry {
    this.ensureLoaded()

    const existingIndex = input.id
      ? this.entries.findIndex((item) => item.id === input.id)
      : -1

    if (existingIndex >= 0) {
      const existing = this.entries[existingIndex]!
      const next: DownloadEntry = {
        ...existing,
        url: input.url,
        filename: input.filename,
        savePath: input.savePath,
        mimeType: input.mimeType,
        totalBytes: input.totalBytes,
        receivedBytes: input.receivedBytes,
        state: input.state,
        endedAt: input.endedAt !== undefined ? input.endedAt : existing.endedAt,
        canResume: input.canResume ?? existing.canResume,
        paused: input.paused ?? existing.paused
      }
      this.entries[existingIndex] = next
      this.persist()
      return { ...next }
    }

    const entry: DownloadEntry = {
      id: input.id ?? randomUUID(),
      url: input.url,
      filename: input.filename,
      savePath: input.savePath,
      mimeType: input.mimeType,
      totalBytes: input.totalBytes,
      receivedBytes: input.receivedBytes,
      state: input.state,
      startedAt: input.startedAt ?? Date.now(),
      endedAt: input.endedAt ?? null,
      canResume: input.canResume ?? false,
      paused: input.paused ?? false
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

  clear(): void {
    this.ensureLoaded()
    this.entries = []
    this.persist()
  }
}

function isDownloadEntry(item: unknown): item is DownloadEntry {
  if (!item || typeof item !== 'object') return false
  const entry = item as DownloadEntry
  return (
    typeof entry.id === 'string' &&
    typeof entry.url === 'string' &&
    typeof entry.filename === 'string' &&
    typeof entry.savePath === 'string' &&
    typeof entry.startedAt === 'number' &&
    VALID_STATES.has(entry.state as DownloadState)
  )
}

function normalizeEntry(item: DownloadEntry): DownloadEntry {
  return {
    id: item.id,
    url: item.url,
    filename: typeof item.filename === 'string' ? item.filename : 'download',
    savePath: typeof item.savePath === 'string' ? item.savePath : '',
    mimeType: typeof item.mimeType === 'string' ? item.mimeType : '',
    totalBytes: typeof item.totalBytes === 'number' ? item.totalBytes : 0,
    receivedBytes: typeof item.receivedBytes === 'number' ? item.receivedBytes : 0,
    state: VALID_STATES.has(item.state) ? item.state : 'interrupted',
    startedAt: item.startedAt,
    endedAt: typeof item.endedAt === 'number' ? item.endedAt : null,
    canResume: Boolean(item.canResume),
    paused: Boolean(item.paused)
  }
}
