import { ipcMain } from 'electron'
import {
  IpcChannels,
  type LoginDetectedPayload,
  type PasswordSaveResponse,
  type SplitSide
} from '../shared/ipc'
import type { DownloadManager } from './download-manager'
import type { HistoryStore } from './history-store'
import type { PasswordManager } from './password-manager'
import type { TabManager } from './tab-manager'

export function registerIpc(
  tabs: TabManager,
  history: HistoryStore,
  downloads: DownloadManager,
  passwords: PasswordManager
): void {
  ipcMain.handle(IpcChannels.TABS_LIST, () => tabs.getTabInfos())
  ipcMain.handle(IpcChannels.TABS_CREATE, (_event, url?: string) => {
    tabs.createTab(url)
  })
  ipcMain.handle(IpcChannels.TABS_CLOSE, (_event, id: string) => {
    tabs.closeTab(id)
  })
  ipcMain.handle(IpcChannels.TABS_ACTIVATE, (_event, id: string) => {
    tabs.activateTab(id)
  })
  ipcMain.handle(
    IpcChannels.TABS_REORDER,
    (_event, fromId: string, toId: string, position: 'before' | 'after') => {
      tabs.reorderTab(fromId, toId, position)
    }
  )
  ipcMain.handle(IpcChannels.SPLIT_DRAG_START, (_event, tabId: string) => {
    tabs.beginSplitDrag(tabId)
  })
  ipcMain.handle(IpcChannels.SPLIT_DRAG_END, () => {
    tabs.endSplitDrag()
  })
  ipcMain.handle(IpcChannels.SPLIT_ENTER, (_event, tabId: string, side: SplitSide) => {
    tabs.enterSplit(tabId, side)
  })
  ipcMain.on(IpcChannels.SPLIT_RESIZE_START, () => {
    tabs.startSplitResize()
  })
  ipcMain.on(IpcChannels.SPLIT_RESIZE_MOVE, (_event, screenX: number) => {
    tabs.moveSplitResize(screenX)
  })
  ipcMain.on(IpcChannels.SPLIT_RESIZE_END, () => {
    tabs.endSplitResize()
  })
  ipcMain.handle(IpcChannels.NAV_BACK, () => tabs.goBack())
  ipcMain.handle(IpcChannels.NAV_FORWARD, () => tabs.goForward())
  ipcMain.handle(IpcChannels.NAV_RELOAD, () => tabs.reload())
  ipcMain.handle(IpcChannels.NAV_GO, (_event, url: string) => {
    tabs.navigate(url)
  })
  ipcMain.handle(IpcChannels.APP_MENU_OPEN, (_event, open: boolean) => {
    tabs.setAppMenuOpen(open)
  })
  ipcMain.handle(IpcChannels.FIND_SET_OPEN, (_event, open: boolean) => {
    tabs.setFindOpen(open)
  })
  ipcMain.handle(IpcChannels.FIND_QUERY, (_event, query: string) => {
    tabs.findInPage(typeof query === 'string' ? query : '')
  })
  ipcMain.handle(IpcChannels.FIND_NEXT, () => tabs.findNext())
  ipcMain.handle(IpcChannels.FIND_PREV, () => tabs.findPrevious())
  ipcMain.handle(IpcChannels.FIND_STOP, () => tabs.stopFindInPage())
  ipcMain.handle(IpcChannels.HISTORY_LIST, () => history.list())
  ipcMain.handle(IpcChannels.HISTORY_REMOVE, (_event, id: string) => history.remove(id))
  ipcMain.handle(IpcChannels.HISTORY_CLEAR, (_event, range?: string) => {
    const allowed = new Set(['hour', 'day', 'week', 'month', 'all'])
    const next = typeof range === 'string' && allowed.has(range) ? range : 'all'
    history.clear(next as 'hour' | 'day' | 'week' | 'month' | 'all')
  })
  ipcMain.handle(IpcChannels.HISTORY_OPEN, (_event, url: string) => {
    tabs.navigate(url)
  })
  ipcMain.handle(IpcChannels.HISTORY_SUGGEST, (_event, query: string, limit?: number) => {
    return history.suggest(query, typeof limit === 'number' ? limit : 10)
  })
  ipcMain.handle(IpcChannels.DOWNLOADS_LIST, () => downloads.list())
  ipcMain.handle(IpcChannels.DOWNLOADS_CANCEL, (_event, id: string) => downloads.cancel(id))
  ipcMain.handle(IpcChannels.DOWNLOADS_PAUSE, (_event, id: string) => downloads.pause(id))
  ipcMain.handle(IpcChannels.DOWNLOADS_RESUME, (_event, id: string) => downloads.resume(id))
  ipcMain.handle(IpcChannels.DOWNLOADS_OPEN, (_event, id: string) => downloads.open(id))
  ipcMain.handle(IpcChannels.DOWNLOADS_SHOW, (_event, id: string) => downloads.showInFolder(id))
  ipcMain.handle(IpcChannels.DOWNLOADS_REMOVE, (_event, id: string) => downloads.remove(id))
  ipcMain.handle(IpcChannels.DOWNLOADS_CLEAR, () => {
    downloads.clear()
  })
  ipcMain.handle(IpcChannels.DOWNLOADS_OPEN_PAGE, () => {
    downloads.openDownloadsPage()
  })
  ipcMain.handle(IpcChannels.PASSWORDS_LOGIN_DETECTED, (_event, payload: LoginDetectedPayload) => {
    if (!payload || typeof payload !== 'object') return { prompted: false, reason: 'invalid' }
    const origin = typeof payload.origin === 'string' ? payload.origin : ''
    const username = typeof payload.username === 'string' ? payload.username : ''
    const password = typeof payload.password === 'string' ? payload.password : ''
    return passwords.handleLoginDetected({ origin, username, password })
  })
  ipcMain.handle(IpcChannels.PASSWORDS_SAVE_RESPONSE, (_event, response: PasswordSaveResponse) => {
    if (!response || typeof response !== 'object') return false
    const id = typeof response.id === 'string' ? response.id : ''
    const action = response.action
    if (!id || (action !== 'save' && action !== 'dismiss' && action !== 'never')) return false
    return passwords.respondToSavePrompt({ id, action })
  })
  ipcMain.handle(IpcChannels.PASSWORDS_FOR_ORIGIN, (_event, origin: string) => {
    return passwords.forOrigin(typeof origin === 'string' ? origin : '')
  })
  ipcMain.handle(IpcChannels.PASSWORDS_LIST, () => passwords.list())
  ipcMain.handle(IpcChannels.PASSWORDS_REMOVE, (_event, id: string) => {
    return passwords.remove(typeof id === 'string' ? id : '')
  })
  ipcMain.handle(IpcChannels.PASSWORDS_CLEAR, () => {
    passwords.clear()
  })
  ipcMain.handle(IpcChannels.PASSWORDS_REVEAL, (_event, id: string) => {
    return passwords.reveal(typeof id === 'string' ? id : '')
  })
  ipcMain.handle(IpcChannels.PASSWORDS_COPY, (_event, id: string) => {
    return passwords.copyPassword(typeof id === 'string' ? id : '')
  })
}

export function unregisterIpc(): void {
  const channels = [
    IpcChannels.TABS_LIST,
    IpcChannels.TABS_CREATE,
    IpcChannels.TABS_CLOSE,
    IpcChannels.TABS_ACTIVATE,
    IpcChannels.TABS_REORDER,
    IpcChannels.SPLIT_DRAG_START,
    IpcChannels.SPLIT_DRAG_END,
    IpcChannels.SPLIT_ENTER,
    IpcChannels.NAV_BACK,
    IpcChannels.NAV_FORWARD,
    IpcChannels.NAV_RELOAD,
    IpcChannels.NAV_GO,
    IpcChannels.APP_MENU_OPEN,
    IpcChannels.FIND_SET_OPEN,
    IpcChannels.FIND_QUERY,
    IpcChannels.FIND_NEXT,
    IpcChannels.FIND_PREV,
    IpcChannels.FIND_STOP,
    IpcChannels.HISTORY_LIST,
    IpcChannels.HISTORY_REMOVE,
    IpcChannels.HISTORY_CLEAR,
    IpcChannels.HISTORY_OPEN,
    IpcChannels.HISTORY_SUGGEST,
    IpcChannels.DOWNLOADS_LIST,
    IpcChannels.DOWNLOADS_CANCEL,
    IpcChannels.DOWNLOADS_PAUSE,
    IpcChannels.DOWNLOADS_RESUME,
    IpcChannels.DOWNLOADS_OPEN,
    IpcChannels.DOWNLOADS_SHOW,
    IpcChannels.DOWNLOADS_REMOVE,
    IpcChannels.DOWNLOADS_CLEAR,
    IpcChannels.DOWNLOADS_OPEN_PAGE,
    IpcChannels.PASSWORDS_LOGIN_DETECTED,
    IpcChannels.PASSWORDS_SAVE_RESPONSE,
    IpcChannels.PASSWORDS_FOR_ORIGIN,
    IpcChannels.PASSWORDS_LIST,
    IpcChannels.PASSWORDS_REMOVE,
    IpcChannels.PASSWORDS_CLEAR,
    IpcChannels.PASSWORDS_REVEAL,
    IpcChannels.PASSWORDS_COPY
  ]

  for (const channel of channels) {
    ipcMain.removeHandler(channel)
  }

  ipcMain.removeAllListeners(IpcChannels.SPLIT_RESIZE_START)
  ipcMain.removeAllListeners(IpcChannels.SPLIT_RESIZE_MOVE)
  ipcMain.removeAllListeners(IpcChannels.SPLIT_RESIZE_END)
}
