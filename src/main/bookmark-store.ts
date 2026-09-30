import { randomUUID } from 'crypto'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { app } from 'electron'
import type {
  BookmarkFolderNode,
  BookmarkLinkNode,
  BookmarkNode,
  BookmarksState
} from '../shared/ipc'

export type BookmarkAddInput = {
  url: string
  title?: string
  favicon?: string | null
  parentId?: string
}

export type FolderAddInput = {
  title: string
  parentId: string
}

const ROOT_ID = 'root'
const BAR_ID = 'bar'
const OTHER_ID = 'other'

export function shouldBookmarkUrl(url: string): boolean {
  if (!url || url === 'about:blank') return false
  if (url.startsWith('lockin://')) return false
  if (url.startsWith('data:')) return false
  return true
}

function createSeedState(): BookmarksState {
  const now = Date.now()
  const root: BookmarkFolderNode = {
    id: ROOT_ID,
    type: 'folder',
    title: 'Bookmarks',
    parentId: null,
    children: [BAR_ID, OTHER_ID],
    createdAt: now
  }
  const bar: BookmarkFolderNode = {
    id: BAR_ID,
    type: 'folder',
    title: 'Bookmarks bar',
    parentId: ROOT_ID,
    children: [],
    createdAt: now
  }
  const other: BookmarkFolderNode = {
    id: OTHER_ID,
    type: 'folder',
    title: 'Other bookmarks',
    parentId: ROOT_ID,
    children: [],
    createdAt: now
  }
  return {
    version: 1,
    rootId: ROOT_ID,
    barId: BAR_ID,
    otherId: OTHER_ID,
    nodes: {
      [ROOT_ID]: root,
      [BAR_ID]: bar,
      [OTHER_ID]: other
    }
  }
}

function isFolder(node: BookmarkNode | undefined): node is BookmarkFolderNode {
  return Boolean(node && node.type === 'folder')
}

function isLink(node: BookmarkNode | undefined): node is BookmarkLinkNode {
  return Boolean(node && node.type === 'bookmark')
}

function cloneState(state: BookmarksState): BookmarksState {
  const nodes: Record<string, BookmarkNode> = {}
  for (const [id, node] of Object.entries(state.nodes)) {
    if (node.type === 'folder') {
      nodes[id] = { ...node, children: [...node.children] }
    } else {
      nodes[id] = { ...node }
    }
  }
  return {
    version: 1,
    rootId: state.rootId,
    barId: state.barId,
    otherId: state.otherId,
    nodes
  }
}

function isValidPersistedState(value: unknown): value is BookmarksState {
  if (!value || typeof value !== 'object') return false
  const state = value as BookmarksState
  if (state.version !== 1) return false
  if (typeof state.rootId !== 'string') return false
  if (typeof state.barId !== 'string') return false
  if (typeof state.otherId !== 'string') return false
  if (!state.nodes || typeof state.nodes !== 'object') return false
  return true
}

export class BookmarkStore {
  private state: BookmarksState = createSeedState()
  private filePath: string
  private loaded = false
  private onUpdated: ((state: BookmarksState) => void) | null = null

  constructor(filePath?: string) {
    this.filePath = filePath ?? join(app.getPath('userData'), 'bookmarks.json')
  }

  setOnUpdated(handler: ((state: BookmarksState) => void) | null): void {
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

      const nodes: Record<string, BookmarkNode> = {}
      for (const [id, item] of Object.entries(parsed.nodes)) {
        if (!item || typeof item !== 'object') continue
        if (item.type === 'folder') {
          if (typeof item.title !== 'string' || !Array.isArray(item.children)) continue
          nodes[id] = {
            id,
            type: 'folder',
            title: item.title,
            parentId: typeof item.parentId === 'string' ? item.parentId : null,
            children: item.children.filter((child): child is string => typeof child === 'string'),
            createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now()
          }
        } else if (item.type === 'bookmark') {
          if (typeof item.url !== 'string' || typeof item.parentId !== 'string') continue
          nodes[id] = {
            id,
            type: 'bookmark',
            title: typeof item.title === 'string' ? item.title : item.url,
            url: item.url,
            favicon: typeof item.favicon === 'string' ? item.favicon : null,
            parentId: item.parentId,
            createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now()
          }
        }
      }

      if (!isFolder(nodes[parsed.rootId]) || !isFolder(nodes[parsed.barId]) || !isFolder(nodes[parsed.otherId])) {
        this.state = createSeedState()
        this.persist()
        return
      }

      this.state = {
        version: 1,
        rootId: parsed.rootId,
        barId: parsed.barId,
        otherId: parsed.otherId,
        nodes
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

  getState(): BookmarksState {
    this.ensureLoaded()
    return cloneState(this.state)
  }

  getBarId(): string {
    this.ensureLoaded()
    return this.state.barId
  }

  listBar(): BookmarkNode[] {
    this.ensureLoaded()
    const bar = this.state.nodes[this.state.barId]
    if (!isFolder(bar)) return []
    return bar.children
      .map((id) => this.state.nodes[id])
      .filter((node): node is BookmarkNode => Boolean(node))
      .map((node) => (node.type === 'folder' ? { ...node, children: [...node.children] } : { ...node }))
  }

  findByUrl(url: string): BookmarkLinkNode | null {
    this.ensureLoaded()
    if (!url) return null
    for (const node of Object.values(this.state.nodes)) {
      if (node.type === 'bookmark' && node.url === url) {
        return { ...node }
      }
    }
    return null
  }

  getFolderOptions(): Array<{ id: string; title: string; depth: number }> {
    this.ensureLoaded()
    const options: Array<{ id: string; title: string; depth: number }> = []

    const walk = (folderId: string, depth: number): void => {
      const folder = this.state.nodes[folderId]
      if (!isFolder(folder)) return
      if (folderId !== this.state.rootId) {
        options.push({ id: folder.id, title: folder.title, depth })
      }
      for (const childId of folder.children) {
        const child = this.state.nodes[childId]
        if (isFolder(child)) walk(child.id, depth + (folderId === this.state.rootId ? 0 : 1))
      }
    }

    walk(this.state.rootId, 0)
    return options
  }

  private isDescendant(ancestorId: string, nodeId: string): boolean {
    let current = this.state.nodes[nodeId]
    while (current) {
      if (current.id === ancestorId) return true
      if (current.parentId === null) return false
      current = this.state.nodes[current.parentId]
    }
    return false
  }

  addBookmark(input: BookmarkAddInput): BookmarkLinkNode | null {
    this.ensureLoaded()
    if (!shouldBookmarkUrl(input.url)) return null

    const existing = this.findByUrl(input.url)
    if (existing) return existing

    const parentId = input.parentId ?? this.state.barId
    const parent = this.state.nodes[parentId]
    if (!isFolder(parent)) return null

    const node: BookmarkLinkNode = {
      id: randomUUID(),
      type: 'bookmark',
      title: (input.title?.trim() || input.url).trim(),
      url: input.url,
      favicon: input.favicon ?? null,
      parentId,
      createdAt: Date.now()
    }

    this.mutate(() => {
      this.state.nodes[node.id] = node
      const folder = this.state.nodes[parentId]
      if (isFolder(folder)) folder.children.push(node.id)
    })

    return { ...node }
  }

  toggleBookmark(input: BookmarkAddInput): { bookmarked: boolean; node: BookmarkLinkNode | null } {
    this.ensureLoaded()
    const existing = this.findByUrl(input.url)
    if (existing) {
      this.remove(existing.id)
      return { bookmarked: false, node: null }
    }
    const node = this.addBookmark(input)
    return { bookmarked: Boolean(node), node }
  }

  addFolder(input: FolderAddInput): BookmarkFolderNode | null {
    this.ensureLoaded()
    const title = input.title.trim()
    if (!title) return null
    const parent = this.state.nodes[input.parentId]
    if (!isFolder(parent)) return null

    const node: BookmarkFolderNode = {
      id: randomUUID(),
      type: 'folder',
      title,
      parentId: input.parentId,
      children: [],
      createdAt: Date.now()
    }

    this.mutate(() => {
      this.state.nodes[node.id] = node
      const folder = this.state.nodes[input.parentId]
      if (isFolder(folder)) folder.children.push(node.id)
    })

    return { ...node, children: [] }
  }

  rename(id: string, title: string): boolean {
    this.ensureLoaded()
    const node = this.state.nodes[id]
    if (!node) return false
    if (id === this.state.rootId) return false
    const nextTitle = title.trim()
    if (!nextTitle) return false

    this.mutate(() => {
      const target = this.state.nodes[id]
      if (target) target.title = nextTitle
    })
    return true
  }

  remove(id: string): boolean {
    this.ensureLoaded()
    if (id === this.state.rootId || id === this.state.barId || id === this.state.otherId) return false
    const node = this.state.nodes[id]
    if (!node) return false

    this.mutate(() => {
      const removeRecursive = (nodeId: string): void => {
        const current = this.state.nodes[nodeId]
        if (!current) return
        if (current.type === 'folder') {
          for (const childId of [...current.children]) {
            removeRecursive(childId)
          }
        }
        delete this.state.nodes[nodeId]
      }

      if (node.parentId) {
        const parent = this.state.nodes[node.parentId]
        if (isFolder(parent)) {
          parent.children = parent.children.filter((childId) => childId !== id)
        }
      }
      removeRecursive(id)
    })

    return true
  }

  move(id: string, newParentId: string, index?: number): boolean {
    this.ensureLoaded()
    if (id === this.state.rootId || id === this.state.barId || id === this.state.otherId) return false
    const node = this.state.nodes[id]
    const newParent = this.state.nodes[newParentId]
    if (!node || !isFolder(newParent)) return false
    if (node.parentId === null) return false

    if (node.type === 'folder') {
      if (id === newParentId) return false
      if (this.isDescendant(id, newParentId)) return false
    }

    this.mutate(() => {
      const target = this.state.nodes[id]
      const dest = this.state.nodes[newParentId]
      if (!target || !isFolder(dest) || target.parentId === null) return

      const oldParent = this.state.nodes[target.parentId]
      if (isFolder(oldParent)) {
        oldParent.children = oldParent.children.filter((childId) => childId !== id)
      }

      target.parentId = newParentId
      const insertAt =
        typeof index === 'number' ? Math.max(0, Math.min(index, dest.children.length)) : dest.children.length
      dest.children.splice(insertAt, 0, id)
    })

    return true
  }
}
