import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { app } from 'electron'
import type { ScreenTimeDay, ScreenTimeOrigin, ScreenTimeSummary } from '../shared/ipc'

type DayBucket = {
  totalMs: number
  byOrigin: Record<string, number>
}

type ScreenTimeData = {
  days: Record<string, DayBucket>
}

const MAX_DAYS = 90
const SUMMARY_DAYS = 7
const TOP_ORIGINS = 15

export function shouldRecordScreenTimeUrl(url: string): boolean {
  if (!url || url === 'about:blank') return false
  if (url.startsWith('lockin://')) return false
  if (url.startsWith('data:')) return false
  return true
}

export function originFromUrl(url: string): string | null {
  if (!shouldRecordScreenTimeUrl(url)) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.origin
  } catch {
    return null
  }
}

export function dayKeyFromDate(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDayKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (Number.isNaN(date.getTime())) return null
  return date
}

function shiftDayKey(key: string, offsetDays: number): string {
  const date = parseDayKey(key) ?? new Date()
  date.setDate(date.getDate() + offsetDays)
  return dayKeyFromDate(date)
}

export class ScreenTimeStore {
  private data: ScreenTimeData = { days: {} }
  private filePath: string
  private loaded = false

  constructor(filePath?: string) {
    this.filePath = filePath ?? join(app.getPath('userData'), 'screentime.json')
  }

  private ensureLoaded(): void {
    if (this.loaded) return
    this.loaded = true

    try {
      if (!existsSync(this.filePath)) return
      const raw = readFileSync(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as unknown
      if (!parsed || typeof parsed !== 'object') return

      const daysRaw = (parsed as { days?: unknown }).days
      if (!daysRaw || typeof daysRaw !== 'object') return

      const days: Record<string, DayBucket> = {}
      for (const [key, value] of Object.entries(daysRaw as Record<string, unknown>)) {
        if (!parseDayKey(key)) continue
        if (!value || typeof value !== 'object') continue
        const totalMs = (value as DayBucket).totalMs
        const byOrigin = (value as DayBucket).byOrigin
        if (typeof totalMs !== 'number' || !Number.isFinite(totalMs) || totalMs < 0) continue
        if (!byOrigin || typeof byOrigin !== 'object') continue

        const cleaned: Record<string, number> = {}
        for (const [origin, ms] of Object.entries(byOrigin)) {
          if (typeof origin !== 'string' || !origin) continue
          if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) continue
          cleaned[origin] = Math.floor(ms)
        }

        days[key] = {
          totalMs: Math.floor(totalMs),
          byOrigin: cleaned
        }
      }

      this.data = { days }
      this.prune()
    } catch {
      this.data = { days: {} }
    }
  }

  private prune(): void {
    const keys = Object.keys(this.data.days).sort()
    if (keys.length <= MAX_DAYS) return
    const drop = keys.slice(0, keys.length - MAX_DAYS)
    for (const key of drop) {
      delete this.data.days[key]
    }
  }

  private persist(): void {
    try {
      const dir = dirname(this.filePath)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      this.prune()
      writeFileSync(this.filePath, JSON.stringify(this.data), 'utf8')
    } catch {
      // Ignore disk errors; in-memory state remains usable for the session.
    }
  }

  addMs(origin: string, ms: number, at: Date = new Date()): void {
    this.ensureLoaded()
    if (!origin || ms <= 0) return

    const amount = Math.floor(ms)
    if (amount <= 0) return

    const key = dayKeyFromDate(at)
    const bucket = this.data.days[key] ?? { totalMs: 0, byOrigin: {} }
    bucket.totalMs += amount
    bucket.byOrigin[origin] = (bucket.byOrigin[origin] ?? 0) + amount
    this.data.days[key] = bucket
    this.persist()
  }

  summary(now: Date = new Date()): ScreenTimeSummary {
    this.ensureLoaded()

    const todayKey = dayKeyFromDate(now)
    const today = this.data.days[todayKey]

    const days: ScreenTimeDay[] = []
    for (let i = SUMMARY_DAYS - 1; i >= 0; i -= 1) {
      const key = shiftDayKey(todayKey, -i)
      days.push({
        day: key,
        totalMs: this.data.days[key]?.totalMs ?? 0
      })
    }

    const topOrigins: ScreenTimeOrigin[] = Object.entries(today?.byOrigin ?? {})
      .map(([origin, ms]) => ({ origin, ms }))
      .sort((a, b) => b.ms - a.ms)
      .slice(0, TOP_ORIGINS)

    return {
      todayTotalMs: today?.totalMs ?? 0,
      days,
      topOrigins
    }
  }

  clear(): void {
    this.ensureLoaded()
    this.data = { days: {} }
    this.persist()
  }
}
