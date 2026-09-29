import { useEffect, useRef, useState } from 'react'
import type { PasswordSaveAction, PasswordSavePrompt } from '../../../shared/ipc'

function hostnameFromOrigin(origin: string): string {
  try {
    return new URL(origin).hostname.replace(/^www\./i, '')
  } catch {
    return origin
  }
}

export function SavePasswordPrompt(): React.JSX.Element | null {
  const [prompt, setPrompt] = useState<PasswordSavePrompt | null>(null)
  const promptRef = useRef<PasswordSavePrompt | null>(null)

  useEffect(() => {
    promptRef.current = prompt
  }, [prompt])

  useEffect(() => {
    return window.lockin.onPasswordSavePrompt((next) => {
      setPrompt(next)
    })
  }, [])

  useEffect(() => {
    const open = prompt !== null
    document.documentElement.classList.toggle('password-save-open', open)
    void window.lockin.setAppMenuOpen(
      open || document.documentElement.classList.contains('app-menu-open')
    )

    if (!open) return

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      const current = promptRef.current
      if (!current) return
      setPrompt(null)
      void window.lockin.respondToPasswordSave({ id: current.id, action: 'dismiss' }).finally(() => {
        const menuStillOpen = document.documentElement.classList.contains('app-menu-open')
        void window.lockin.setAppMenuOpen(menuStillOpen)
      })
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.documentElement.classList.remove('password-save-open')
    }
  }, [prompt])

  const respond = (action: PasswordSaveAction): void => {
    if (!prompt) return
    const id = prompt.id
    setPrompt(null)
    void window.lockin.respondToPasswordSave({ id, action }).finally(() => {
      const menuStillOpen = document.documentElement.classList.contains('app-menu-open')
      void window.lockin.setAppMenuOpen(menuStillOpen)
    })
  }

  if (!prompt) return null

  const host = hostnameFromOrigin(prompt.origin)

  return (
    <div className="password-save-prompt" role="dialog" aria-label="Save password">
      <div className="password-save-icon" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path
            d="M9 1.75A3.75 3.75 0 0 0 5.25 5.5V7H4.5A1.75 1.75 0 0 0 2.75 8.75v5.5c0 .966.784 1.75 1.75 1.75h9c.966 0 1.75-.784 1.75-1.75v-5.5A1.75 1.75 0 0 0 13.5 7h-.75V5.5A3.75 3.75 0 0 0 9 1.75Zm2.25 5.25H6.75V5.5a2.25 2.25 0 0 1 4.5 0V7Z"
            fill="currentColor"
          />
        </svg>
      </div>
      <div className="password-save-body">
        <div className="password-save-copy">
          <div className="password-save-title">Save password?</div>
          <div className="password-save-user">{prompt.username}</div>
          <div className="password-save-origin">{host}</div>
        </div>
        <div className="password-save-actions">
          <button type="button" className="password-save-never" onClick={() => respond('never')}>
            Never
          </button>
          <button type="button" className="password-save-dismiss" onClick={() => respond('dismiss')}>
            Not now
          </button>
          <button type="button" className="password-save-confirm" onClick={() => respond('save')}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
