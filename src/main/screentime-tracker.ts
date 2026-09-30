import { powerMonitor, type BaseWindow } from 'electron'
import { originFromUrl, type ScreenTimeStore } from './screentime-store'

const TICK_MS = 15_000
const IDLE_THRESHOLD_SEC = 60

type ActiveSegment = {
  origin: string
  startedAt: number
}

export class ScreenTimeTracker {
  private store: ScreenTimeStore
  private window: BaseWindow
  private segment: ActiveSegment | null = null
  private desiredOrigin: string | null = null
  private windowFocused = true
  private tickTimer: ReturnType<typeof setInterval> | null = null
  private started = false

  constructor(store: ScreenTimeStore, window: BaseWindow) {
    this.store = store
    this.window = window
  }

  start(): void {
    if (this.started) return
    this.started = true
    this.windowFocused = this.window.isFocused()

    this.window.on('focus', () => {
      this.windowFocused = true
      this.resumeIfNeeded()
    })

    this.window.on('blur', () => {
      this.windowFocused = false
      this.flush(false)
    })

    this.tickTimer = setInterval(() => this.tick(), TICK_MS)
  }

  stop(): void {
    if (!this.started) return
    this.started = false
    this.flush(false)
    if (this.tickTimer) {
      clearInterval(this.tickTimer)
      this.tickTimer = null
    }
  }

  setActiveUrl(url: string | null): void {
    const origin = url ? originFromUrl(url) : null
    if (origin === this.desiredOrigin) {
      if (origin && !this.segment && this.canTrack()) {
        this.segment = { origin, startedAt: Date.now() }
      }
      return
    }

    this.flush(false)
    this.desiredOrigin = origin
    if (origin && this.canTrack()) {
      this.segment = { origin, startedAt: Date.now() }
    }
  }

  flush(restart = true): void {
    if (!this.segment) {
      if (restart) this.resumeIfNeeded()
      return
    }

    const elapsed = Date.now() - this.segment.startedAt
    if (elapsed > 0) {
      this.store.addMs(this.segment.origin, elapsed)
    }
    this.segment = null

    if (restart) this.resumeIfNeeded()
  }

  private canTrack(): boolean {
    if (!this.windowFocused || !this.desiredOrigin) return false
    try {
      return powerMonitor.getSystemIdleTime() < IDLE_THRESHOLD_SEC
    } catch {
      return true
    }
  }

  private resumeIfNeeded(): void {
    if (this.segment) return
    if (!this.desiredOrigin || !this.canTrack()) return
    this.segment = { origin: this.desiredOrigin, startedAt: Date.now() }
  }

  private tick(): void {
    if (!this.desiredOrigin) return

    if (!this.canTrack()) {
      this.flush(false)
      return
    }

    if (!this.segment) {
      this.resumeIfNeeded()
      return
    }

    // Checkpoint periodically so a crash loses at most one tick interval.
    this.flush(true)
  }
}
