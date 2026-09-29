import { existsSync } from 'fs'
import { basename, dirname, extname, join } from 'path'
import { app, shell, type DownloadItem, type WebContents } from 'electron'
import type { DownloadEntry, DownloadState } from '../shared/ipc'
import { getBrowserSession } from './browser-session'
import type { DownloadsStore } from './downloads-store'

type DownloadManagerOptions = {
  onUpdated: (entries: DownloadEntry[], changedId: string | null) => void
  openDownloadsPage: () => void
}

export class DownloadManager {
  private store: DownloadsStore
  private options: DownloadManagerOptions
  private activeItems = new Map<string, DownloadItem>()
  private attached = false

  constructor(store: DownloadsStore, options: DownloadManagerOptions) {
    this.store = store
    this.options = options
  }

  attach(): void {
    if (this.attached) return
    this.attached = true

    getBrowserSession().on('will-download', (_event, item) => {
      this.handleWillDownload(item)
    })
  }

  list(): DownloadEntry[] {
    return this.store.list()
  }

  cancel(id: string): boolean {
    const item = this.activeItems.get(id)
    if (!item) return false
    item.cancel()
    return true
  }

  pause(id: string): boolean {
    const item = this.activeItems.get(id)
    if (!item || item.isPaused()) return false
    item.pause()
    this.syncItem(id, item, 'progressing')
    return true
  }

  resume(id: string): boolean {
    const item = this.activeItems.get(id)
    if (!item || !item.canResume()) return false
    item.resume()
    this.syncItem(id, item, 'progressing')
    return true
  }

  async open(id: string): Promise<boolean> {
    const entry = this.store.get(id)
    if (!entry || entry.state !== 'completed' || !entry.savePath) return false
    if (!existsSync(entry.savePath)) return false
    const result = await shell.openPath(entry.savePath)
    return result === ''
  }

  showInFolder(id: string): boolean {
    const entry = this.store.get(id)
    if (!entry || !entry.savePath) return false
    if (!existsSync(entry.savePath)) return false
    shell.showItemInFolder(entry.savePath)
    return true
  }

  remove(id: string): boolean {
    const item = this.activeItems.get(id)
    if (item) {
      item.cancel()
      this.activeItems.delete(id)
    }
    const removed = this.store.remove(id)
    if (removed) this.emit(null)
    return removed
  }

  clear(): void {
    for (const item of Array.from(this.activeItems.values())) {
      item.cancel()
    }
    this.activeItems.clear()
    this.store.clear()
    this.emit(null)
  }

  openDownloadsPage(): void {
    this.options.openDownloadsPage()
  }

  private handleWillDownload(item: DownloadItem): void {
    const filename = sanitizeFilename(item.getFilename() || 'download')
    const savePath = uniqueSavePath(join(app.getPath('downloads'), filename))
    item.setSavePath(savePath)

    const entry = this.store.upsert({
      url: item.getURL(),
      filename: basename(savePath),
      savePath,
      mimeType: item.getMimeType() || '',
      totalBytes: item.getTotalBytes(),
      receivedBytes: item.getReceivedBytes(),
      state: 'progressing',
      startedAt: Date.now(),
      endedAt: null,
      canResume: item.canResume(),
      paused: item.isPaused()
    })

    this.activeItems.set(entry.id, item)
    this.emit(entry.id)

    item.on('updated', (_event, state) => {
      this.syncItem(entry.id, item, mapUpdatedState(state))
    })

    item.once('done', (_event, state) => {
      this.activeItems.delete(entry.id)
      this.syncItem(entry.id, item, mapDoneState(state), true)
    })
  }

  private syncItem(
    id: string,
    item: DownloadItem,
    state: DownloadState,
    done = false
  ): void {
    const savePath = item.getSavePath() || this.store.get(id)?.savePath || ''
    this.store.upsert({
      id,
      url: item.getURL(),
      filename: basename(savePath) || item.getFilename() || 'download',
      savePath,
      mimeType: item.getMimeType() || '',
      totalBytes: item.getTotalBytes(),
      receivedBytes: item.getReceivedBytes(),
      state,
      endedAt: done ? Date.now() : null,
      canResume: item.canResume(),
      paused: item.isPaused()
    })
    this.emit(id)
  }

  private emit(changedId: string | null): void {
    this.options.onUpdated(this.store.list(), changedId)
  }
}

function mapUpdatedState(state: 'progressing' | 'interrupted'): DownloadState {
  return state === 'interrupted' ? 'interrupted' : 'progressing'
}

function mapDoneState(
  state: 'completed' | 'cancelled' | 'interrupted'
): DownloadState {
  return state
}

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim()
  return cleaned || 'download'
}

function uniqueSavePath(desiredPath: string): string {
  if (!existsSync(desiredPath)) return desiredPath

  const extension = extname(desiredPath)
  const stem = basename(desiredPath, extension)
  const dir = dirname(desiredPath)

  for (let i = 1; i < 10_000; i += 1) {
    const candidate = join(dir, `${stem} (${i})${extension}`)
    if (!existsSync(candidate)) return candidate
  }

  return join(dir, `${stem} (${Date.now()})${extension}`)
}

/** Start a download from an arbitrary URL (e.g. context-menu Save As). */
export function downloadUrl(webContents: WebContents, url: string): void {
  if (!url) return
  webContents.downloadURL(url)
}
