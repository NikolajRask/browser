import { useEffect, useRef, useState } from 'react'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onBeforeOpen: () => void
}

type Preset = {
  id: string
  label: string
  detail: string
  minutes: number
}

const PRESETS: Preset[] = [
  { id: 'focus', label: 'Focus', detail: '25 min', minutes: 25 },
  { id: 'break', label: 'Break', detail: '5 min', minutes: 5 },
  { id: 'deep', label: 'Deep', detail: '50 min', minutes: 50 }
]

const STORAGE_KEY = 'lockin.study-timer'
const RING_SIZE = 132
const RING_STROKE = 6
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

type PersistedState = {
  totalSeconds: number
  remainingSeconds: number
  running: boolean
  endsAt: number | null
  presetId: string
}

function loadState(): PersistedState {
  const fallback: PersistedState = {
    totalSeconds: 25 * 60,
    remainingSeconds: 25 * 60,
    running: false,
    endsAt: null,
    presetId: 'focus'
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<PersistedState>
    const totalSeconds =
      typeof parsed.totalSeconds === 'number' && parsed.totalSeconds > 0
        ? parsed.totalSeconds
        : fallback.totalSeconds
    let remainingSeconds =
      typeof parsed.remainingSeconds === 'number'
        ? Math.max(0, Math.min(totalSeconds, parsed.remainingSeconds))
        : totalSeconds
    let running = Boolean(parsed.running)
    let endsAt = typeof parsed.endsAt === 'number' ? parsed.endsAt : null
    const presetId = typeof parsed.presetId === 'string' ? parsed.presetId : 'focus'

    if (running && endsAt) {
      remainingSeconds = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
      if (remainingSeconds <= 0) {
        running = false
        endsAt = null
        remainingSeconds = 0
      }
    } else {
      running = false
      endsAt = null
    }

    return { totalSeconds, remainingSeconds, running, endsAt, presetId }
  } catch {
    return fallback
  }
}

function formatTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function notifyComplete(): void {
  try {
    if (typeof Notification === 'undefined') return
    if (Notification.permission === 'granted') {
      new Notification('Study session complete', {
        body: 'Nice work — time for a break.',
        silent: false
      })
      return
    }
    if (Notification.permission === 'default') {
      void Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          new Notification('Study session complete', {
            body: 'Nice work — time for a break.'
          })
        }
      })
    }
  } catch {
    // Notifications are best-effort in the chrome UI.
  }
}

export function StudyTimer({ open, onOpenChange, onBeforeOpen }: Props): React.JSX.Element {
  const initial = useRef(loadState()).current
  const [totalSeconds, setTotalSeconds] = useState(initial.totalSeconds)
  const [remainingSeconds, setRemainingSeconds] = useState(initial.remainingSeconds)
  const [running, setRunning] = useState(initial.running)
  const [endsAt, setEndsAt] = useState<number | null>(initial.endsAt)
  const [presetId, setPresetId] = useState(initial.presetId)
  const completedRef = useRef(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const state: PersistedState = {
      totalSeconds,
      remainingSeconds,
      running,
      endsAt,
      presetId
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Ignore quota / private-mode failures.
    }
  }, [totalSeconds, remainingSeconds, running, endsAt, presetId])

  useEffect(() => {
    if (!running || endsAt === null) return

    const tick = (): void => {
      const next = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
      setRemainingSeconds(next)
      if (next <= 0) {
        setRunning(false)
        setEndsAt(null)
        if (!completedRef.current) {
          completedRef.current = true
          notifyComplete()
        }
      }
    }

    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [running, endsAt])

  const progress =
    totalSeconds > 0 ? Math.min(1, (totalSeconds - remainingSeconds) / totalSeconds) : 0
  const ringOffset = RING_CIRCUMFERENCE * (1 - progress)
  const isDone = remainingSeconds === 0 && !running
  const showLive = running || remainingSeconds < totalSeconds
  const durationMinutes = Math.max(1, Math.round(totalSeconds / 60))
  const statusLabel = running
    ? presetId === 'break'
      ? 'Break'
      : presetId === 'deep'
        ? 'Deep focus'
        : 'Focusing'
    : isDone
      ? 'Done'
      : 'Ready'
  const statusClass = running ? 'is-running' : isDone ? 'is-done' : 'is-ready'
  const sessionCaption = isDone
    ? 'Session complete'
    : presetId === 'break'
      ? `${durationMinutes} min break`
      : presetId === 'deep'
        ? `${durationMinutes} min deep focus`
        : `${durationMinutes} min focus`

  const applyDuration = (minutes: number, nextPresetId: string): void => {
    const seconds = Math.max(1, Math.min(180, Math.round(minutes))) * 60
    completedRef.current = false
    setPresetId(nextPresetId)
    setTotalSeconds(seconds)
    setRemainingSeconds(seconds)
    setRunning(false)
    setEndsAt(null)
  }

  const nudgeDuration = (delta: number): void => {
    applyDuration(durationMinutes + delta, 'custom')
  }

  const toggleRunning = (): void => {
    if (remainingSeconds <= 0) {
      completedRef.current = false
      setRemainingSeconds(totalSeconds)
      setEndsAt(Date.now() + totalSeconds * 1000)
      setRunning(true)
      return
    }

    if (running) {
      setRunning(false)
      setEndsAt(null)
      return
    }

    completedRef.current = false
    setEndsAt(Date.now() + remainingSeconds * 1000)
    setRunning(true)
  }

  const reset = (): void => {
    completedRef.current = false
    setRunning(false)
    setEndsAt(null)
    setRemainingSeconds(totalSeconds)
  }

  return (
    <div className="study-timer" ref={menuRef}>
      <button
        type="button"
        className={`study-timer-button${open ? ' is-open' : ''}${running ? ' is-running' : ''}${isDone ? ' is-done' : ''}`}
        aria-label={showLive ? `Study timer ${formatTime(remainingSeconds)}` : 'Study timer'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (open) {
            onOpenChange(false)
            return
          }
          onBeforeOpen()
          onOpenChange(true)
        }}
      >
        {showLive ? (
          <span className="study-timer-chip">{formatTime(remainingSeconds)}</span>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <circle
              cx="8"
              cy="8.5"
              r="5.2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <path
              d="M8 5.8v2.8l1.8 1.1"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M6.2 2.4h3.6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>
      {open ? (
        <div className="study-timer-dropdown" role="dialog" aria-label="Study timer">
          <div className="study-timer-header">
            <span className="study-timer-title">Study timer</span>
            <span className={`study-timer-status ${statusClass}`}>
              <span className="study-timer-status-dot" aria-hidden="true" />
              {statusLabel}
            </span>
          </div>

          <div className="study-timer-hero">
            <div className="study-timer-ring" aria-hidden="true">
              <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
                <circle
                  className="study-timer-ring-track"
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  fill="none"
                  strokeWidth={RING_STROKE}
                />
                <circle
                  className={`study-timer-ring-value${isDone ? ' is-done' : ''}`}
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  fill="none"
                  strokeWidth={RING_STROKE}
                  strokeDasharray={RING_CIRCUMFERENCE}
                  strokeDashoffset={ringOffset}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                />
              </svg>
            </div>
            <div className="study-timer-display" aria-live="polite">
              <span className="study-timer-time">{formatTime(remainingSeconds)}</span>
              <span className="study-timer-caption">{sessionCaption}</span>
            </div>
          </div>

          <div className="study-timer-presets" role="group" aria-label="Duration presets">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={presetId === preset.id ? 'is-active' : undefined}
                onClick={() => applyDuration(preset.minutes, preset.id)}
              >
                <span className="study-timer-preset-label">{preset.label}</span>
                <span className="study-timer-preset-detail">{preset.detail}</span>
              </button>
            ))}
          </div>

          <div className="study-timer-stepper" role="group" aria-label="Adjust duration">
            <button
              type="button"
              aria-label="Decrease by 5 minutes"
              disabled={running || durationMinutes <= 1}
              onClick={() => nudgeDuration(-5)}
            >
              −
            </button>
            <div className="study-timer-stepper-value">
              <span>{durationMinutes}</span>
              <span>min</span>
            </div>
            <button
              type="button"
              aria-label="Increase by 5 minutes"
              disabled={running || durationMinutes >= 180}
              onClick={() => nudgeDuration(5)}
            >
              +
            </button>
          </div>

          <div className="study-timer-actions">
            <button type="button" className="study-timer-primary" onClick={toggleRunning}>
              {running ? 'Pause' : remainingSeconds === 0 ? 'Restart' : 'Start'}
            </button>
            <button
              type="button"
              className="study-timer-secondary"
              onClick={reset}
              disabled={!showLive}
            >
              Reset
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
