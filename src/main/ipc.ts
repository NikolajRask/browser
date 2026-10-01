import { ipcMain } from 'electron'
import {
  IpcChannels,
  type AiChatRequest,
  type AiChatSavePayload,
  type BookmarkAddPayload,
  type BookmarkFolderAddPayload,
  type BookmarkMovePayload,
  type BookmarkRenamePayload,
  type CreateTabOptions,
  type LoginDetectedPayload,
  type PasswordSaveResponse,
  type SplitSide,
  type TodoAddPayload,
  type TodoFolderAddPayload,
  type TodoMovePayload,
  type TodoRenamePayload
} from '../shared/ipc'
import type { AiChatStore } from './ai-chat-store'
import type { ApiKeyStore } from './api-key-store'
import type { BookmarkStore } from './bookmark-store'
import { isIncognitoWebContents } from './browser-session'
import { decidePageContextMode, pageContextFromCapture, pageContextFromScreenshots, resolvePageContextMode, sanitizeScreenshots, sendClaudeChat } from './claude-chat'
import type { DownloadManager } from './download-manager'
import type { HistoryStore } from './history-store'
import type { PasswordManager } from './password-manager'
import type { ScreenTimeStore } from './screentime-store'
import type { ScreenTimeTracker } from './screentime-tracker'
import type { TabManager } from './tab-manager'
import type { TodoStore } from './todo-store'

export type WindowControlsApi = {
  isFullScreen: () => boolean
  close: () => void
  minimize: () => void
  toggleFullScreen: () => void
}

export function registerIpc(
  tabs: TabManager,
  history: HistoryStore,
  downloads: DownloadManager,
  passwords: PasswordManager,
  screenTime: ScreenTimeStore,
  bookmarks: BookmarkStore,
  todos: TodoStore,
  apiKeys: ApiKeyStore,
  aiChats: AiChatStore,
  screenTimeTracker?: ScreenTimeTracker | null,
  windowControls?: WindowControlsApi | null
): void {
  ipcMain.handle(IpcChannels.TABS_LIST, () => tabs.getTabInfos())
  ipcMain.handle(
    IpcChannels.TABS_CREATE,
    (event, url?: string, options?: CreateTabOptions) => {
      if (typeof url === 'string' && url && tabs.isChromeWebContents(event.sender)) {
        tabs.markExternalLinkDragHandled()
      }
      tabs.createTab(typeof url === 'string' ? url : undefined, {
        isIncognito: options?.isIncognito === true,
        placement: options?.placement
      })
    }
  )
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
  ipcMain.handle(IpcChannels.TABS_CONTEXT_MENU, (_event, id: string) => {
    tabs.showTabContextMenu(id)
  })
  ipcMain.handle(IpcChannels.TABS_TOGGLE_MUTE, (_event, id: string) => {
    tabs.toggleMuteTab(id)
  })
  ipcMain.handle(IpcChannels.TABS_CLOSED_LIST, () => tabs.getClosedTabs())
  ipcMain.handle(IpcChannels.TABS_REOPEN_CLOSED, (_event, index: number) => {
    tabs.reopenClosedTab(typeof index === 'number' ? index : -1)
  })
  ipcMain.handle(IpcChannels.TAB_SEARCH_SET_OPEN, (_event, open: boolean) => {
    tabs.setTabSearchOpen(Boolean(open))
  })
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
  ipcMain.handle(IpcChannels.AI_SIDEBAR_OPEN, (_event, open: boolean) => {
    tabs.setAiSidebarOpen(Boolean(open))
  })
  ipcMain.handle(IpcChannels.AI_SIDEBAR_GET_WIDTH, () => tabs.getAiSidebarWidth())
  ipcMain.on(IpcChannels.AI_SIDEBAR_RESIZE_START, () => {
    tabs.startAiSidebarResize()
  })
  ipcMain.on(IpcChannels.AI_SIDEBAR_RESIZE_MOVE, (_event, screenX: number) => {
    tabs.moveAiSidebarResize(screenX)
  })
  ipcMain.on(IpcChannels.AI_SIDEBAR_RESIZE_END, () => {
    tabs.endAiSidebarResize()
  })
  ipcMain.handle(IpcChannels.AI_HAS_KEY, () => apiKeys.hasClaudeKey())
  ipcMain.handle(IpcChannels.AI_CHAT, async (event, request: AiChatRequest) => {
    const messages = Array.isArray(request?.messages) ? request.messages : []
    const manualScreenshots = sanitizeScreenshots(request?.screenshots)

    let pageContext = null
    if (manualScreenshots.length > 0) {
      // User-provided screenshots replace auto page-screenshot routing entirely.
      pageContext = pageContextFromScreenshots(manualScreenshots)
    } else {
      // Meta + text extract (no screenshot yet) for routing and TEXT mode.
      const pageMeta = await tabs.captureActivePageForAi(false)
      const routed = await decidePageContextMode(apiKeys, messages, pageMeta)
      const mode = resolvePageContextMode(routed, pageMeta, messages)

      if (mode === 'none') {
        pageContext = null
      } else if (mode === 'text') {
        pageContext = pageContextFromCapture(pageMeta, { includeScreenshot: false })
      } else {
        pageContext = pageContextFromCapture(await tabs.captureActivePageForAi(true), {
          includeScreenshot: true
        })
      }
    }

    return sendClaudeChat(apiKeys, messages, pageContext, (text) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(IpcChannels.AI_CHAT_CHUNK, { text })
      }
    })
  })
  ipcMain.handle(IpcChannels.AI_CAPTURE_SCREENSHOT, async () => {
    const capture = await tabs.captureActivePageForAi(true)
    if (!capture?.imageBase64) return null
    return {
      id: `shot-${Date.now()}`,
      imageBase64: capture.imageBase64,
      mediaType: capture.mediaType,
      title: capture.title,
      url: capture.url,
      capturedAt: Date.now()
    }
  })
  ipcMain.handle(IpcChannels.AI_CHATS_LIST, () => aiChats.list())
  ipcMain.handle(IpcChannels.AI_CHATS_GET, (_event, id: string) => {
    return aiChats.get(typeof id === 'string' ? id : '')
  })
  ipcMain.handle(IpcChannels.AI_CHATS_SAVE, (_event, payload: AiChatSavePayload) => {
    return aiChats.save(payload)
  })
  ipcMain.handle(IpcChannels.AI_CHATS_REMOVE, (_event, id: string) => {
    return aiChats.remove(typeof id === 'string' ? id : '')
  })
  ipcMain.handle(IpcChannels.AI_CHATS_SET_PINNED, (_event, id: string, pinned: boolean) => {
    return aiChats.setPinned(typeof id === 'string' ? id : '', Boolean(pinned))
  })
  ipcMain.handle(IpcChannels.SETTINGS_CLAUDE_STATUS, () => ({
    configured: apiKeys.hasClaudeKey()
  }))
  ipcMain.handle(IpcChannels.SETTINGS_CLAUDE_SET, (_event, key: string) => {
    const ok = apiKeys.setClaudeKey(typeof key === 'string' ? key : '')
    return { configured: ok && apiKeys.hasClaudeKey() }
  })
  ipcMain.handle(IpcChannels.SETTINGS_CLAUDE_CLEAR, () => {
    apiKeys.clearClaudeKey()
    return { configured: false }
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
  ipcMain.handle(
    IpcChannels.HISTORY_LIST,
    (_event, options?: { offset?: number; limit?: number }) => {
      const offset =
        typeof options?.offset === 'number' && Number.isFinite(options.offset)
          ? options.offset
          : undefined
      const limit =
        typeof options?.limit === 'number' && Number.isFinite(options.limit)
          ? options.limit
          : undefined
      return history.list(
        offset !== undefined || limit !== undefined ? { offset, limit } : undefined
      )
    }
  )
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
  ipcMain.handle(IpcChannels.PASSWORDS_LOGIN_DETECTED, (event, payload: LoginDetectedPayload) => {
    if (isIncognitoWebContents(event.sender)) return { prompted: false, reason: 'incognito' }
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
  ipcMain.handle(IpcChannels.PASSWORDS_FOR_ORIGIN, (event, origin: string) => {
    if (isIncognitoWebContents(event.sender)) return []
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
  ipcMain.handle(IpcChannels.SCREENTIME_SUMMARY, () => {
    screenTimeTracker?.flush(true)
    return screenTime.summary()
  })
  ipcMain.handle(IpcChannels.SCREENTIME_CLEAR, () => {
    screenTimeTracker?.flush(false)
    screenTime.clear()
    screenTimeTracker?.flush(true)
  })
  ipcMain.handle(IpcChannels.BOOKMARKS_STATE, () => bookmarks.getState())
  ipcMain.handle(IpcChannels.BOOKMARKS_BAR, () => bookmarks.listBar())
  ipcMain.handle(IpcChannels.BOOKMARKS_FIND_URL, (_event, url: string) => {
    return bookmarks.findByUrl(typeof url === 'string' ? url : '')
  })
  ipcMain.handle(IpcChannels.BOOKMARKS_ADD, (_event, payload: BookmarkAddPayload) => {
    if (!payload || typeof payload !== 'object') return null
    const url = typeof payload.url === 'string' ? payload.url : ''
    return bookmarks.addBookmark({
      url,
      title: typeof payload.title === 'string' ? payload.title : undefined,
      favicon: typeof payload.favicon === 'string' ? payload.favicon : null,
      parentId: typeof payload.parentId === 'string' ? payload.parentId : undefined
    })
  })
  ipcMain.handle(IpcChannels.BOOKMARKS_TOGGLE, (_event, payload: BookmarkAddPayload) => {
    if (!payload || typeof payload !== 'object') return { bookmarked: false, node: null }
    const url = typeof payload.url === 'string' ? payload.url : ''
    return bookmarks.toggleBookmark({
      url,
      title: typeof payload.title === 'string' ? payload.title : undefined,
      favicon: typeof payload.favicon === 'string' ? payload.favicon : null,
      parentId: typeof payload.parentId === 'string' ? payload.parentId : undefined
    })
  })
  ipcMain.handle(IpcChannels.BOOKMARKS_ADD_FOLDER, (_event, payload: BookmarkFolderAddPayload) => {
    if (!payload || typeof payload !== 'object') return null
    const title = typeof payload.title === 'string' ? payload.title : ''
    const parentId = typeof payload.parentId === 'string' ? payload.parentId : ''
    return bookmarks.addFolder({ title, parentId })
  })
  ipcMain.handle(IpcChannels.BOOKMARKS_RENAME, (_event, payload: BookmarkRenamePayload) => {
    if (!payload || typeof payload !== 'object') return false
    const id = typeof payload.id === 'string' ? payload.id : ''
    const title = typeof payload.title === 'string' ? payload.title : ''
    return bookmarks.rename(id, title)
  })
  ipcMain.handle(IpcChannels.BOOKMARKS_REMOVE, (_event, id: string) => {
    return bookmarks.remove(typeof id === 'string' ? id : '')
  })
  ipcMain.handle(IpcChannels.BOOKMARKS_MOVE, (_event, payload: BookmarkMovePayload) => {
    if (!payload || typeof payload !== 'object') return false
    const id = typeof payload.id === 'string' ? payload.id : ''
    const parentId = typeof payload.parentId === 'string' ? payload.parentId : ''
    const index = typeof payload.index === 'number' ? payload.index : undefined
    return bookmarks.move(id, parentId, index)
  })
  ipcMain.handle(IpcChannels.BOOKMARKS_FOLDERS, () => bookmarks.getFolderOptions())
  ipcMain.handle(IpcChannels.BOOKMARKS_OPEN, (_event, url: string) => {
    if (typeof url === 'string' && url) tabs.navigate(url)
  })
  ipcMain.handle(IpcChannels.BOOKMARKS_OPEN_PAGE, () => {
    tabs.createTab('lockin://bookmarks')
  })
  ipcMain.handle(IpcChannels.TODOS_STATE, () => todos.getState())
  ipcMain.handle(IpcChannels.TODOS_ADD_FOLDER, (_event, payload: TodoFolderAddPayload) => {
    if (!payload || typeof payload !== 'object') return null
    const title = typeof payload.title === 'string' ? payload.title : ''
    return todos.addFolder(title)
  })
  ipcMain.handle(IpcChannels.TODOS_RENAME_FOLDER, (_event, payload: TodoRenamePayload) => {
    if (!payload || typeof payload !== 'object') return false
    const id = typeof payload.id === 'string' ? payload.id : ''
    const title = typeof payload.title === 'string' ? payload.title : ''
    return todos.renameFolder(id, title)
  })
  ipcMain.handle(IpcChannels.TODOS_REMOVE_FOLDER, (_event, id: string) => {
    return todos.removeFolder(typeof id === 'string' ? id : '')
  })
  ipcMain.handle(IpcChannels.TODOS_ADD_TODO, (_event, payload: TodoAddPayload) => {
    if (!payload || typeof payload !== 'object') return null
    const folderId = typeof payload.folderId === 'string' ? payload.folderId : ''
    const title = typeof payload.title === 'string' ? payload.title : ''
    return todos.addTodo(folderId, title)
  })
  ipcMain.handle(IpcChannels.TODOS_TOGGLE_TODO, (_event, id: string) => {
    return todos.toggleTodo(typeof id === 'string' ? id : '')
  })
  ipcMain.handle(IpcChannels.TODOS_RENAME_TODO, (_event, payload: TodoRenamePayload) => {
    if (!payload || typeof payload !== 'object') return false
    const id = typeof payload.id === 'string' ? payload.id : ''
    const title = typeof payload.title === 'string' ? payload.title : ''
    return todos.renameTodo(id, title)
  })
  ipcMain.handle(IpcChannels.TODOS_REMOVE_TODO, (_event, id: string) => {
    return todos.removeTodo(typeof id === 'string' ? id : '')
  })
  ipcMain.handle(IpcChannels.TODOS_MOVE_TODO, (_event, payload: TodoMovePayload) => {
    if (!payload || typeof payload !== 'object') return false
    const id = typeof payload.id === 'string' ? payload.id : ''
    const folderId = typeof payload.folderId === 'string' ? payload.folderId : ''
    return todos.moveTodo(id, folderId)
  })
  ipcMain.handle(IpcChannels.TODOS_OPEN_PAGE, () => {
    tabs.createTab('lockin://todos')
  })
  ipcMain.handle(IpcChannels.PAGE_PRINT, () => {
    tabs.printPage()
  })
  ipcMain.handle(IpcChannels.PAGE_PICTURE_IN_PICTURE, () => {
    return tabs.togglePictureInPicture()
  })
  ipcMain.on(IpcChannels.PAGE_PICTURE_IN_PICTURE_CHANGED, (_event, active: unknown) => {
    tabs.setPictureInPictureActive(Boolean(active))
  })
  ipcMain.on(
    IpcChannels.PAGE_LINK_DRAG,
    (
      event,
      payload: { phase?: string; url?: string; screenX?: number; screenY?: number } | undefined
    ) => {
      if (!payload || typeof payload.url !== 'string') return
      if (payload.phase === 'start') {
        tabs.beginExternalLinkDrag(payload.url, isIncognitoWebContents(event.sender))
        return
      }
      if (payload.phase === 'end') {
        const screenX = typeof payload.screenX === 'number' ? payload.screenX : 0
        const screenY = typeof payload.screenY === 'number' ? payload.screenY : 0
        tabs.finishExternalLinkDragAt(screenX, screenY)
      }
    }
  )
  ipcMain.handle(IpcChannels.WINDOW_IS_FULLSCREEN, () => windowControls?.isFullScreen() ?? false)
  ipcMain.handle(IpcChannels.WINDOW_CLOSE, () => {
    windowControls?.close()
  })
  ipcMain.handle(IpcChannels.WINDOW_MINIMIZE, () => {
    windowControls?.minimize()
  })
  ipcMain.handle(IpcChannels.WINDOW_TOGGLE_FULLSCREEN, () => {
    windowControls?.toggleFullScreen()
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
    IpcChannels.AI_SIDEBAR_OPEN,
    IpcChannels.AI_SIDEBAR_GET_WIDTH,
    IpcChannels.AI_HAS_KEY,
    IpcChannels.AI_CHAT,
    IpcChannels.AI_CAPTURE_SCREENSHOT,
    IpcChannels.AI_CHATS_LIST,
    IpcChannels.AI_CHATS_GET,
    IpcChannels.AI_CHATS_SAVE,
    IpcChannels.AI_CHATS_REMOVE,
    IpcChannels.AI_CHATS_SET_PINNED,
    IpcChannels.SETTINGS_CLAUDE_STATUS,
    IpcChannels.SETTINGS_CLAUDE_SET,
    IpcChannels.SETTINGS_CLAUDE_CLEAR,
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
    IpcChannels.PASSWORDS_COPY,
    IpcChannels.SCREENTIME_SUMMARY,
    IpcChannels.SCREENTIME_CLEAR,
    IpcChannels.BOOKMARKS_STATE,
    IpcChannels.BOOKMARKS_BAR,
    IpcChannels.BOOKMARKS_FIND_URL,
    IpcChannels.BOOKMARKS_ADD,
    IpcChannels.BOOKMARKS_TOGGLE,
    IpcChannels.BOOKMARKS_ADD_FOLDER,
    IpcChannels.BOOKMARKS_RENAME,
    IpcChannels.BOOKMARKS_REMOVE,
    IpcChannels.BOOKMARKS_MOVE,
    IpcChannels.BOOKMARKS_FOLDERS,
    IpcChannels.BOOKMARKS_OPEN,
    IpcChannels.BOOKMARKS_OPEN_PAGE,
    IpcChannels.TODOS_STATE,
    IpcChannels.TODOS_ADD_FOLDER,
    IpcChannels.TODOS_RENAME_FOLDER,
    IpcChannels.TODOS_REMOVE_FOLDER,
    IpcChannels.TODOS_ADD_TODO,
    IpcChannels.TODOS_TOGGLE_TODO,
    IpcChannels.TODOS_RENAME_TODO,
    IpcChannels.TODOS_REMOVE_TODO,
    IpcChannels.TODOS_MOVE_TODO,
    IpcChannels.TODOS_OPEN_PAGE,
    IpcChannels.PAGE_PRINT,
    IpcChannels.PAGE_PICTURE_IN_PICTURE,
    IpcChannels.WINDOW_IS_FULLSCREEN,
    IpcChannels.WINDOW_CLOSE,
    IpcChannels.WINDOW_MINIMIZE,
    IpcChannels.WINDOW_TOGGLE_FULLSCREEN
  ]

  for (const channel of channels) {
    ipcMain.removeHandler(channel)
  }

  ipcMain.removeAllListeners(IpcChannels.SPLIT_RESIZE_START)
  ipcMain.removeAllListeners(IpcChannels.SPLIT_RESIZE_MOVE)
  ipcMain.removeAllListeners(IpcChannels.SPLIT_RESIZE_END)
  ipcMain.removeAllListeners(IpcChannels.AI_SIDEBAR_RESIZE_START)
  ipcMain.removeAllListeners(IpcChannels.AI_SIDEBAR_RESIZE_MOVE)
  ipcMain.removeAllListeners(IpcChannels.AI_SIDEBAR_RESIZE_END)
  ipcMain.removeAllListeners(IpcChannels.PAGE_PICTURE_IN_PICTURE_CHANGED)
  ipcMain.removeAllListeners(IpcChannels.PAGE_LINK_DRAG)
}
