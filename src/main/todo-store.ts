import { randomUUID } from 'crypto'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { app } from 'electron'
import type { TodoFolder, TodoItem, TodosState } from '../shared/ipc'

const INBOX_ID = 'inbox'

function createSeedState(): TodosState {
  const now = Date.now()
  const inbox: TodoFolder = {
    id: INBOX_ID,
    title: 'Inbox',
    createdAt: now,
    order: 0
  }
  return {
    version: 1,
    folders: { [INBOX_ID]: inbox },
    todos: {},
    folderOrder: [INBOX_ID]
  }
}

function cloneState(state: TodosState): TodosState {
  const folders: Record<string, TodoFolder> = {}
  for (const [id, folder] of Object.entries(state.folders)) {
    folders[id] = { ...folder }
  }
  const todos: Record<string, TodoItem> = {}
  for (const [id, todo] of Object.entries(state.todos)) {
    todos[id] = { ...todo }
  }
  return {
    version: 1,
    folders,
    todos,
    folderOrder: [...state.folderOrder]
  }
}

function isValidPersistedState(value: unknown): value is TodosState {
  if (!value || typeof value !== 'object') return false
  const state = value as TodosState
  if (state.version !== 1) return false
  if (!state.folders || typeof state.folders !== 'object') return false
  if (!state.todos || typeof state.todos !== 'object') return false
  if (!Array.isArray(state.folderOrder)) return false
  return true
}

export class TodoStore {
  private state: TodosState = createSeedState()
  private filePath: string
  private loaded = false
  private onUpdated: ((state: TodosState) => void) | null = null

  constructor(filePath?: string) {
    this.filePath = filePath ?? join(app.getPath('userData'), 'todos.json')
  }

  setOnUpdated(handler: ((state: TodosState) => void) | null): void {
    this.onUpdated = handler
  }

  private ensureLoaded(): void {
    if (this.loaded) return
    this.loaded = true

    try {
      if (!existsSync(this.filePath)) {
        this.state = createSeedState()
        this.persist()
        return
      }
      const raw = readFileSync(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as unknown
      if (!isValidPersistedState(parsed)) {
        this.state = createSeedState()
        this.persist()
        return
      }

      const folders: Record<string, TodoFolder> = {}
      for (const [id, item] of Object.entries(parsed.folders)) {
        if (!item || typeof item !== 'object') continue
        if (typeof item.title !== 'string') continue
        folders[id] = {
          id,
          title: item.title,
          createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
          order: typeof item.order === 'number' ? item.order : 0
        }
      }

      if (Object.keys(folders).length === 0) {
        this.state = createSeedState()
        this.persist()
        return
      }

      const todos: Record<string, TodoItem> = {}
      for (const [id, item] of Object.entries(parsed.todos)) {
        if (!item || typeof item !== 'object') continue
        if (typeof item.folderId !== 'string' || typeof item.title !== 'string') continue
        if (!folders[item.folderId]) continue
        todos[id] = {
          id,
          folderId: item.folderId,
          title: item.title,
          completed: Boolean(item.completed),
          createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now()
        }
      }

      const folderOrder = parsed.folderOrder.filter(
        (id): id is string => typeof id === 'string' && Boolean(folders[id])
      )
      for (const id of Object.keys(folders)) {
        if (!folderOrder.includes(id)) folderOrder.push(id)
      }

      this.state = {
        version: 1,
        folders,
        todos,
        folderOrder
      }
    } catch {
      this.state = createSeedState()
      this.persist()
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

  private emit(): void {
    this.onUpdated?.(this.getState())
  }

  private mutate(mutator: () => void): void {
    this.ensureLoaded()
    mutator()
    this.persist()
    this.emit()
  }

  getState(): TodosState {
    this.ensureLoaded()
    return cloneState(this.state)
  }

  addFolder(title: string): TodoFolder | null {
    this.ensureLoaded()
    const nextTitle = title.trim()
    if (!nextTitle) return null

    const folder: TodoFolder = {
      id: randomUUID(),
      title: nextTitle,
      createdAt: Date.now(),
      order: this.state.folderOrder.length
    }

    this.mutate(() => {
      this.state.folders[folder.id] = folder
      this.state.folderOrder.push(folder.id)
    })

    return { ...folder }
  }

  renameFolder(id: string, title: string): boolean {
    this.ensureLoaded()
    const folder = this.state.folders[id]
    if (!folder) return false
    const nextTitle = title.trim()
    if (!nextTitle) return false

    this.mutate(() => {
      const target = this.state.folders[id]
      if (target) target.title = nextTitle
    })
    return true
  }

  removeFolder(id: string): boolean {
    this.ensureLoaded()
    if (!this.state.folders[id]) return false
    if (this.state.folderOrder.length <= 1) return false

    this.mutate(() => {
      delete this.state.folders[id]
      this.state.folderOrder = this.state.folderOrder.filter((folderId) => folderId !== id)
      for (const [todoId, todo] of Object.entries(this.state.todos)) {
        if (todo.folderId === id) delete this.state.todos[todoId]
      }
    })
    return true
  }

  addTodo(folderId: string, title: string): TodoItem | null {
    this.ensureLoaded()
    if (!this.state.folders[folderId]) return null
    const nextTitle = title.trim()
    if (!nextTitle) return null

    const todo: TodoItem = {
      id: randomUUID(),
      folderId,
      title: nextTitle,
      completed: false,
      createdAt: Date.now()
    }

    this.mutate(() => {
      this.state.todos[todo.id] = todo
    })

    return { ...todo }
  }

  toggleTodo(id: string): TodoItem | null {
    this.ensureLoaded()
    const todo = this.state.todos[id]
    if (!todo) return null

    this.mutate(() => {
      const target = this.state.todos[id]
      if (target) target.completed = !target.completed
    })

    const updated = this.state.todos[id]
    return updated ? { ...updated } : null
  }

  renameTodo(id: string, title: string): boolean {
    this.ensureLoaded()
    const todo = this.state.todos[id]
    if (!todo) return false
    const nextTitle = title.trim()
    if (!nextTitle) return false

    this.mutate(() => {
      const target = this.state.todos[id]
      if (target) target.title = nextTitle
    })
    return true
  }

  removeTodo(id: string): boolean {
    this.ensureLoaded()
    if (!this.state.todos[id]) return false

    this.mutate(() => {
      delete this.state.todos[id]
    })
    return true
  }

  moveTodo(id: string, folderId: string): boolean {
    this.ensureLoaded()
    const todo = this.state.todos[id]
    if (!todo) return false
    if (!this.state.folders[folderId]) return false

    this.mutate(() => {
      const target = this.state.todos[id]
      if (target) target.folderId = folderId
    })
    return true
  }
}
