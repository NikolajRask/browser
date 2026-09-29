import { randomUUID } from 'crypto'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { app, safeStorage } from 'electron'

export type StoredCredential = {
  id: string
  origin: string
  username: string
  passwordCiphertext: string
  createdAt: number
  updatedAt: number
}

export type CredentialListItem = {
  id: string
  origin: string
  username: string
  createdAt: number
  updatedAt: number
}

export type CredentialWithSecret = CredentialListItem & {
  password: string
}

export type SaveCredentialInput = {
  origin: string
  username: string
  password: string
}

type PersistedFile = {
  entries: StoredCredential[]
  neverOrigins: string[]
}

function isStoredCredential(item: unknown): item is StoredCredential {
  if (!item || typeof item !== 'object') return false
  const entry = item as StoredCredential
  return (
    typeof entry.id === 'string' &&
    typeof entry.origin === 'string' &&
    typeof entry.username === 'string' &&
    typeof entry.passwordCiphertext === 'string' &&
    typeof entry.createdAt === 'number' &&
    typeof entry.updatedAt === 'number'
  )
}

export function normalizeOrigin(urlOrOrigin: string): string | null {
  try {
    const parsed = new URL(urlOrOrigin)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.origin
  } catch {
    return null
  }
}

export function shouldOfferPasswords(urlOrOrigin: string): boolean {
  if (!urlOrOrigin || urlOrOrigin === 'about:blank') return false
  if (urlOrOrigin.startsWith('lockin://')) return false
  return normalizeOrigin(urlOrOrigin) !== null
}

export class PasswordStore {
  private entries: StoredCredential[] = []
  private neverOrigins: string[] = []
  private filePath: string
  private loaded = false

  constructor(filePath?: string) {
    this.filePath = filePath ?? join(app.getPath('userData'), 'passwords.json')
  }

  private ensureLoaded(): void {
    if (this.loaded) return
    this.loaded = true

    try {
      if (!existsSync(this.filePath)) return
      const raw = readFileSync(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as unknown

      if (Array.isArray(parsed)) {
        this.entries = parsed.filter(isStoredCredential)
        this.neverOrigins = []
        return
      }

      if (!parsed || typeof parsed !== 'object') return
      const file = parsed as PersistedFile
      this.entries = Array.isArray(file.entries) ? file.entries.filter(isStoredCredential) : []
      this.neverOrigins = Array.isArray(file.neverOrigins)
        ? file.neverOrigins.filter((item): item is string => typeof item === 'string')
        : []
    } catch {
      this.entries = []
      this.neverOrigins = []
    }
  }

  private persist(): void {
    try {
      const dir = dirname(this.filePath)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      const payload: PersistedFile = {
        entries: this.entries,
        neverOrigins: this.neverOrigins
      }
      writeFileSync(this.filePath, JSON.stringify(payload), 'utf8')
    } catch {
      // Ignore disk errors; in-memory state remains usable for the session.
    }
  }

  private encrypt(password: string): string | null {
    if (!safeStorage.isEncryptionAvailable()) return null
    try {
      return safeStorage.encryptString(password).toString('base64')
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

  isEncryptionAvailable(): boolean {
    return safeStorage.isEncryptionAvailable()
  }

  list(): CredentialListItem[] {
    this.ensureLoaded()
    return this.entries
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(({ id, origin, username, createdAt, updatedAt }) => ({
        id,
        origin,
        username,
        createdAt,
        updatedAt
      }))
  }

  forOrigin(origin: string): CredentialWithSecret[] {
    this.ensureLoaded()
    const normalized = normalizeOrigin(origin)
    if (!normalized) return []

    const matches: CredentialWithSecret[] = []
    for (const entry of this.entries) {
      if (entry.origin !== normalized) continue
      const password = this.decrypt(entry.passwordCiphertext)
      if (password === null) continue
      matches.push({
        id: entry.id,
        origin: entry.origin,
        username: entry.username,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        password
      })
    }
    return matches.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  isNeverOrigin(origin: string): boolean {
    this.ensureLoaded()
    const normalized = normalizeOrigin(origin)
    if (!normalized) return false
    return this.neverOrigins.includes(normalized)
  }

  addNeverOrigin(origin: string): void {
    this.ensureLoaded()
    const normalized = normalizeOrigin(origin)
    if (!normalized) return
    if (this.neverOrigins.includes(normalized)) return
    this.neverOrigins.push(normalized)
    this.persist()
  }

  save(input: SaveCredentialInput): CredentialListItem | null {
    this.ensureLoaded()
    const origin = normalizeOrigin(input.origin)
    const username = input.username.trim()
    const password = input.password
    if (!origin || !username || !password) return null

    const ciphertext = this.encrypt(password)
    if (ciphertext === null) return null

    const now = Date.now()
    const existing = this.entries.find(
      (entry) => entry.origin === origin && entry.username === username
    )

    if (existing) {
      existing.passwordCiphertext = ciphertext
      existing.updatedAt = now
      this.persist()
      return {
        id: existing.id,
        origin: existing.origin,
        username: existing.username,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt
      }
    }

    const entry: StoredCredential = {
      id: randomUUID(),
      origin,
      username,
      passwordCiphertext: ciphertext,
      createdAt: now,
      updatedAt: now
    }
    this.entries.unshift(entry)
    this.persist()
    return {
      id: entry.id,
      origin: entry.origin,
      username: entry.username,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt
    }
  }

  reveal(id: string): string | null {
    this.ensureLoaded()
    const entry = this.entries.find((item) => item.id === id)
    if (!entry) return null
    return this.decrypt(entry.passwordCiphertext)
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

  findExisting(origin: string, username: string): CredentialListItem | null {
    this.ensureLoaded()
    const normalized = normalizeOrigin(origin)
    if (!normalized) return null
    const entry = this.entries.find(
      (item) => item.origin === normalized && item.username === username.trim()
    )
    if (!entry) return null
    return {
      id: entry.id,
      origin: entry.origin,
      username: entry.username,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt
    }
  }
}
