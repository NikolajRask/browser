import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { app, safeStorage } from 'electron'

type PersistedFile = {
  claudeApiKeyCiphertext: string | null
}

export class ApiKeyStore {
  private claudeApiKeyCiphertext: string | null = null
  private filePath: string
  private loaded = false

  constructor(filePath?: string) {
    this.filePath = filePath ?? join(app.getPath('userData'), 'api-keys.json')
  }

  private ensureLoaded(): void {
    if (this.loaded) return
    this.loaded = true

    try {
      if (!existsSync(this.filePath)) return
      const raw = readFileSync(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as unknown
      if (!parsed || typeof parsed !== 'object') return
      const file = parsed as PersistedFile
      this.claudeApiKeyCiphertext =
        typeof file.claudeApiKeyCiphertext === 'string' ? file.claudeApiKeyCiphertext : null
    } catch {
      this.claudeApiKeyCiphertext = null
    }
  }

  private persist(): void {
    try {
      const dir = dirname(this.filePath)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      const payload: PersistedFile = {
        claudeApiKeyCiphertext: this.claudeApiKeyCiphertext
      }
      writeFileSync(this.filePath, JSON.stringify(payload), 'utf8')
    } catch {
      // Ignore disk errors; in-memory state remains usable for the session.
    }
  }

  private encrypt(value: string): string | null {
    if (!safeStorage.isEncryptionAvailable()) return null
    try {
      return safeStorage.encryptString(value).toString('base64')
    } catch {
      return null
    }
  }

  private decrypt(ciphertext: string): string | null {
    if (!safeStorage.isEncryptionAvailable()) return null
    try {
      return safeStorage.decryptString(Buffer.from(ciphertext, 'base64'))
    } catch {
      return null
    }
  }

  hasClaudeKey(): boolean {
    this.ensureLoaded()
    return Boolean(this.claudeApiKeyCiphertext)
  }

  getClaudeKey(): string | null {
    this.ensureLoaded()
    if (!this.claudeApiKeyCiphertext) return null
    return this.decrypt(this.claudeApiKeyCiphertext)
  }

  setClaudeKey(key: string): boolean {
    const trimmed = key.trim()
    if (!trimmed) return false
    const ciphertext = this.encrypt(trimmed)
    if (!ciphertext) return false
    this.ensureLoaded()
    this.claudeApiKeyCiphertext = ciphertext
    this.persist()
    return true
  }

  clearClaudeKey(): void {
    this.ensureLoaded()
    this.claudeApiKeyCiphertext = null
    this.persist()
  }
}
