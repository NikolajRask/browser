import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { app } from 'electron'

export type SessionTab = {
  url: string
  title: string
  favicon: string | null
}

export type SessionSplit = {
  leftIndex: number
  rightIndex: number
  ratio: number
}

export type BrowserSessionState = {
  version: 1
  tabs: SessionTab[]
  activeIndex: number
  split: SessionSplit | null
}

const EMPTY_SESSION: BrowserSessionState = {
  version: 1,
  tabs: [],
  activeIndex: 0,
  split: null
}

export class SessionStore {
  private filePath: string
  private loaded = false
  private state: BrowserSessionState = { ...EMPTY_SESSION, tabs: [] }

  constructor(filePath?: string) {
    this.filePath = filePath ?? join(app.getPath('userData'), 'session.json')
  }

  load(): BrowserSessionState {
    this.ensureLoaded()
    return cloneSession(this.state)
  }

  save(state: BrowserSessionState): void {
    this.state = normalizeSession(state)
    this.loaded = true
    this.persist()
  }

  private ensureLoaded(): void {
    if (this.loaded) return
    this.loaded = true

    try {
      if (!existsSync(this.filePath)) return
      const raw = readFileSync(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as unknown
      this.state = normalizeSession(parsed)
    } catch {
      this.state = { ...EMPTY_SESSION, tabs: [] }
    }
  }

  private persist(): void {
    try {
      const dir = dirname(this.filePath)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(this.filePath, JSON.stringify(this.state), 'utf8')
    } catch {
      // Ignore disk errors; in-memory state remains usable for the session.
    }
  }
}

function cloneSession(state: BrowserSessionState): BrowserSessionState {
  return {
    version: 1,
    tabs: state.tabs.map((tab) => ({ ...tab })),
    activeIndex: state.activeIndex,
    split: state.split ? { ...state.split } : null
  }
}

function normalizeSession(value: unknown): BrowserSessionState {
  if (!value || typeof value !== 'object') {
    return { ...EMPTY_SESSION, tabs: [] }
  }

  const raw = value as Partial<BrowserSessionState>
  const tabs = Array.isArray(raw.tabs)
    ? raw.tabs.filter(isSessionTab).map((tab) => ({
        url: typeof tab.url === 'string' ? tab.url : '',
        title: typeof tab.title === 'string' && tab.title.trim() ? tab.title : 'New Tab',
        favicon: typeof tab.favicon === 'string' ? tab.favicon : null
      }))
    : []

  const activeIndex =
    typeof raw.activeIndex === 'number' && Number.isFinite(raw.activeIndex)
      ? Math.min(Math.max(Math.trunc(raw.activeIndex), 0), Math.max(tabs.length - 1, 0))
      : 0

  let split: SessionSplit | null = null
  if (raw.split && typeof raw.split === 'object' && tabs.length >= 2) {
    const leftIndex = Number((raw.split as SessionSplit).leftIndex)
    const rightIndex = Number((raw.split as SessionSplit).rightIndex)
    const ratio = Number((raw.split as SessionSplit).ratio)
    if (
      Number.isInteger(leftIndex) &&
      Number.isInteger(rightIndex) &&
      leftIndex >= 0 &&
      rightIndex >= 0 &&
      leftIndex < tabs.length &&
      rightIndex < tabs.length &&
      leftIndex !== rightIndex &&
      Number.isFinite(ratio)
    ) {
      split = {
        leftIndex,
        rightIndex,
        ratio: Math.min(Math.max(ratio, 0.2), 0.8)
      }
    }
  }

  return { version: 1, tabs, activeIndex, split }
}

function isSessionTab(value: unknown): value is SessionTab {
  return !!value && typeof value === 'object' && typeof (value as SessionTab).url === 'string'
}
