import { randomUUID } from 'crypto'
import { clipboard } from 'electron'
import type {
  CredentialAutofillItem,
  CredentialListItem,
  PasswordSavePrompt,
  PasswordSaveResponse
} from '../shared/ipc'
import {
  PasswordStore,
  normalizeOrigin,
  shouldOfferPasswords,
  type SaveCredentialInput
} from './password-store'

type PendingSave = {
  id: string
  origin: string
  username: string
  password: string
}

type PasswordManagerOptions = {
  onSavePrompt: (prompt: PasswordSavePrompt | null) => void
}

export class PasswordManager {
  private store: PasswordStore
  private pending = new Map<string, PendingSave>()
  private activePromptId: string | null = null
  private options: PasswordManagerOptions

  constructor(store: PasswordStore, options: PasswordManagerOptions) {
    this.store = store
    this.options = options
  }

  list(): CredentialListItem[] {
    return this.store.list()
  }

  forOrigin(origin: string): CredentialAutofillItem[] {
    if (!shouldOfferPasswords(origin)) return []
    return this.store.forOrigin(origin).map(({ id, origin: entryOrigin, username, password }) => ({
      id,
      origin: entryOrigin,
      username,
      password
    }))
  }

  handleLoginDetected(input: SaveCredentialInput): { prompted: boolean; reason?: string } {
    const origin = normalizeOrigin(input.origin)
    const username = input.username.trim()
    const password = input.password
    if (!origin || !username || !password || !shouldOfferPasswords(origin)) {
      return { prompted: false, reason: 'invalid' }
    }

    if (this.store.isNeverOrigin(origin)) {
      return { prompted: false, reason: 'never' }
    }

    if (!this.store.isEncryptionAvailable()) {
      return { prompted: false, reason: 'encryption-unavailable' }
    }

    const existing = this.store.findExisting(origin, username)
    if (existing) {
      const current = this.store.reveal(existing.id)
      if (current === password) {
        return { prompted: false, reason: 'unchanged' }
      }
    }

    const id = randomUUID()
    this.pending.set(id, { id, origin, username, password })
    this.activePromptId = id
    this.options.onSavePrompt({ id, origin, username })
    return { prompted: true }
  }

  respondToSavePrompt(response: PasswordSaveResponse): boolean {
    const pending = this.pending.get(response.id)
    if (!pending) return false

    this.pending.delete(response.id)
    if (this.activePromptId === response.id) {
      this.activePromptId = null
      this.options.onSavePrompt(null)
    }

    if (response.action === 'dismiss') {
      return true
    }

    if (response.action === 'never') {
      this.store.addNeverOrigin(pending.origin)
      return true
    }

    if (response.action === 'save') {
      return this.store.save({
        origin: pending.origin,
        username: pending.username,
        password: pending.password
      }) !== null
    }

    return false
  }

  dismissActivePrompt(): void {
    if (!this.activePromptId) return
    void this.respondToSavePrompt({ id: this.activePromptId, action: 'dismiss' })
  }

  reveal(id: string): string | null {
    return this.store.reveal(id)
  }

  copyPassword(id: string): boolean {
    const password = this.store.reveal(id)
    if (password === null) return false
    clipboard.writeText(password)
    return true
  }

  remove(id: string): boolean {
    return this.store.remove(id)
  }

  clear(): void {
    this.store.clear()
  }
}
