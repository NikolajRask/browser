import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type {
  BookmarkAddPayload,
  BookmarksState,
  ClosedTabInfo,
  DownloadEntry,
  DownloadsUpdatedPayload,
  FindResult,
  LockinApi,
  NavState,
  PasswordSavePrompt,
  PasswordSaveResponse,
  SplitSide,
  TabInfo,
  TodoAddPayload,
  TodosState
} from '../shared/ipc'

// Channel names inlined so the sandboxed preload has no shared runtime chunks.
const IpcChannels = {
  TABS_LIST: 'tabs:list',
  TABS_UPDATED: 'tabs:updated',
  TABS_CREATE: 'tabs:create',
  TABS_CLOSE: 'tabs:close',
  TABS_ACTIVATE: 'tabs:activate',
  TABS_REORDER: 'tabs:reorder',
  TABS_CLOSED_LIST: 'tabs:closed-list',
  TABS_CLOSED_UPDATED: 'tabs:closed-updated',
  TABS_REOPEN_CLOSED: 'tabs:reopen-closed',
  TAB_SEARCH_OPEN: 'tab-search:open',
  TAB_SEARCH_SET_OPEN: 'tab-search:set-open',
  SPLIT_DRAG_START: 'split:drag-start',
  SPLIT_DRAG_END: 'split:drag-end',
  SPLIT_ENTER: 'split:enter',
  NAV_BACK: 'nav:back',
  NAV_FORWARD: 'nav:forward',
  NAV_RELOAD: 'nav:reload',
  NAV_GO: 'nav:go',
  NAV_STATE: 'nav:state',
  FOCUS_OMNIBOX: 'chrome:focus-omnibox',
  APP_MENU_OPEN: 'chrome:app-menu-open',
  FIND_OPEN: 'find:open',
  FIND_SET_OPEN: 'find:set-open',
  FIND_QUERY: 'find:query',
  FIND_NEXT: 'find:next',
  FIND_PREV: 'find:prev',
  FIND_STOP: 'find:stop',
  FIND_RESULT: 'find:result',
  HISTORY_SUGGEST: 'history:suggest',
  DOWNLOADS_LIST: 'downloads:list',
  DOWNLOADS_UPDATED: 'downloads:updated',
  DOWNLOADS_CANCEL: 'downloads:cancel',
  DOWNLOADS_PAUSE: 'downloads:pause',
  DOWNLOADS_RESUME: 'downloads:resume',
  DOWNLOADS_OPEN: 'downloads:open',
  DOWNLOADS_SHOW: 'downloads:show',
  DOWNLOADS_REMOVE: 'downloads:remove',
  DOWNLOADS_CLEAR: 'downloads:clear',
  DOWNLOADS_OPEN_PAGE: 'downloads:open-page',
  PASSWORDS_SAVE_PROMPT: 'passwords:save-prompt',
  PASSWORDS_SAVE_RESPONSE: 'passwords:save-response',
  BOOKMARKS_STATE: 'bookmarks:state',
  BOOKMARKS_BAR: 'bookmarks:bar',
  BOOKMARKS_UPDATED: 'bookmarks:updated',
  BOOKMARKS_FIND_URL: 'bookmarks:find-url',
  BOOKMARKS_ADD: 'bookmarks:add',
  BOOKMARKS_TOGGLE: 'bookmarks:toggle',
  BOOKMARKS_OPEN: 'bookmarks:open',
  BOOKMARKS_OPEN_PAGE: 'bookmarks:open-page',
  TODOS_STATE: 'todos:state',
  TODOS_UPDATED: 'todos:updated',
  TODOS_ADD_TODO: 'todos:add-todo',
  TODOS_TOGGLE_TODO: 'todos:toggle-todo',
  TODOS_REMOVE_TODO: 'todos:remove-todo',
  TODOS_OPEN_PAGE: 'todos:open-page',
  PAGE_PRINT: 'page:print',
  WINDOW_FULLSCREEN: 'window:fullscreen',
  WINDOW_IS_FULLSCREEN: 'window:is-fullscreen',
  WINDOW_CLOSE: 'window:close',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_TOGGLE_FULLSCREEN: 'window:toggle-fullscreen'
} as const

const api: LockinApi = {
  platform: process.platform,
  getTabs: () => ipcRenderer.invoke(IpcChannels.TABS_LIST),
  createTab: (url?) => ipcRenderer.invoke(IpcChannels.TABS_CREATE, url),
  closeTab: (id) => ipcRenderer.invoke(IpcChannels.TABS_CLOSE, id),
  activateTab: (id) => ipcRenderer.invoke(IpcChannels.TABS_ACTIVATE, id),
  reorderTab: (fromId, toId, position) =>
    ipcRenderer.invoke(IpcChannels.TABS_REORDER, fromId, toId, position),
  getClosedTabs: () => ipcRenderer.invoke(IpcChannels.TABS_CLOSED_LIST),
  reopenClosedTab: (index) => ipcRenderer.invoke(IpcChannels.TABS_REOPEN_CLOSED, index),
  beginSplitDrag: (tabId) => ipcRenderer.invoke(IpcChannels.SPLIT_DRAG_START, tabId),
  endSplitDrag: () => ipcRenderer.invoke(IpcChannels.SPLIT_DRAG_END),
  enterSplit: (tabId, side: SplitSide) =>
    ipcRenderer.invoke(IpcChannels.SPLIT_ENTER, tabId, side),
  goBack: () => ipcRenderer.invoke(IpcChannels.NAV_BACK),
  goForward: () => ipcRenderer.invoke(IpcChannels.NAV_FORWARD),
  reload: () => ipcRenderer.invoke(IpcChannels.NAV_RELOAD),
  navigate: (url) => ipcRenderer.invoke(IpcChannels.NAV_GO, url),
  setAppMenuOpen: (open) => ipcRenderer.invoke(IpcChannels.APP_MENU_OPEN, open),
  setFindOpen: (open) => ipcRenderer.invoke(IpcChannels.FIND_SET_OPEN, open),
  setTabSearchOpen: (open) => ipcRenderer.invoke(IpcChannels.TAB_SEARCH_SET_OPEN, open),
  findInPage: (query) => ipcRenderer.invoke(IpcChannels.FIND_QUERY, query),
  findNext: () => ipcRenderer.invoke(IpcChannels.FIND_NEXT),
  findPrevious: () => ipcRenderer.invoke(IpcChannels.FIND_PREV),
  stopFindInPage: () => ipcRenderer.invoke(IpcChannels.FIND_STOP),
  suggestHistory: (query, limit) => ipcRenderer.invoke(IpcChannels.HISTORY_SUGGEST, query, limit),
  listDownloads: () => ipcRenderer.invoke(IpcChannels.DOWNLOADS_LIST),
  cancelDownload: (id) => ipcRenderer.invoke(IpcChannels.DOWNLOADS_CANCEL, id),
  pauseDownload: (id) => ipcRenderer.invoke(IpcChannels.DOWNLOADS_PAUSE, id),
  resumeDownload: (id) => ipcRenderer.invoke(IpcChannels.DOWNLOADS_RESUME, id),
  openDownload: (id) => ipcRenderer.invoke(IpcChannels.DOWNLOADS_OPEN, id),
  showDownloadInFolder: (id) => ipcRenderer.invoke(IpcChannels.DOWNLOADS_SHOW, id),
  removeDownload: (id) => ipcRenderer.invoke(IpcChannels.DOWNLOADS_REMOVE, id),
  clearDownloads: () => ipcRenderer.invoke(IpcChannels.DOWNLOADS_CLEAR),
  openDownloadsPage: () => ipcRenderer.invoke(IpcChannels.DOWNLOADS_OPEN_PAGE),
  respondToPasswordSave: (response: PasswordSaveResponse) =>
    ipcRenderer.invoke(IpcChannels.PASSWORDS_SAVE_RESPONSE, response),
  getBookmarksState: () => ipcRenderer.invoke(IpcChannels.BOOKMARKS_STATE),
  listBookmarksBar: () => ipcRenderer.invoke(IpcChannels.BOOKMARKS_BAR),
  findBookmarkByUrl: (url: string) => ipcRenderer.invoke(IpcChannels.BOOKMARKS_FIND_URL, url),
  addBookmark: (payload: BookmarkAddPayload) => ipcRenderer.invoke(IpcChannels.BOOKMARKS_ADD, payload),
  toggleBookmark: (payload: BookmarkAddPayload) =>
    ipcRenderer.invoke(IpcChannels.BOOKMARKS_TOGGLE, payload),
  openBookmark: (url: string) => ipcRenderer.invoke(IpcChannels.BOOKMARKS_OPEN, url),
  openBookmarksPage: () => ipcRenderer.invoke(IpcChannels.BOOKMARKS_OPEN_PAGE),
  getTodosState: () => ipcRenderer.invoke(IpcChannels.TODOS_STATE),
  addTodo: (payload: TodoAddPayload) =>
    ipcRenderer.invoke(IpcChannels.TODOS_ADD_TODO, payload),
  toggleTodo: (id: string) => ipcRenderer.invoke(IpcChannels.TODOS_TOGGLE_TODO, id),
  removeTodo: (id: string) => ipcRenderer.invoke(IpcChannels.TODOS_REMOVE_TODO, id),
  openTodosPage: () => ipcRenderer.invoke(IpcChannels.TODOS_OPEN_PAGE),
  printPage: () => ipcRenderer.invoke(IpcChannels.PAGE_PRINT),
  isFullScreen: () => ipcRenderer.invoke(IpcChannels.WINDOW_IS_FULLSCREEN),
  closeWindow: () => ipcRenderer.invoke(IpcChannels.WINDOW_CLOSE),
  minimizeWindow: () => ipcRenderer.invoke(IpcChannels.WINDOW_MINIMIZE),
  toggleFullScreen: () => ipcRenderer.invoke(IpcChannels.WINDOW_TOGGLE_FULLSCREEN),
  onTabsUpdated: (callback) => {
    const listener = (_event: IpcRendererEvent, tabs: TabInfo[]): void => {
      callback(tabs)
    }
    ipcRenderer.on(IpcChannels.TABS_UPDATED, listener)
    return () => {
      ipcRenderer.removeListener(IpcChannels.TABS_UPDATED, listener)
    }
  },
  onClosedTabsUpdated: (callback) => {
    const listener = (_event: IpcRendererEvent, tabs: ClosedTabInfo[]): void => {
      callback(tabs)
    }
    ipcRenderer.on(IpcChannels.TABS_CLOSED_UPDATED, listener)
    return () => {
      ipcRenderer.removeListener(IpcChannels.TABS_CLOSED_UPDATED, listener)
    }
  },
  onNavState: (callback) => {
    const listener = (_event: IpcRendererEvent, state: NavState): void => {
      callback(state)
    }
    ipcRenderer.on(IpcChannels.NAV_STATE, listener)
    return () => {
      ipcRenderer.removeListener(IpcChannels.NAV_STATE, listener)
    }
  },
  onFocusOmnibox: (callback) => {
    const listener = (): void => {
      callback()
    }
    ipcRenderer.on(IpcChannels.FOCUS_OMNIBOX, listener)
    return () => {
      ipcRenderer.removeListener(IpcChannels.FOCUS_OMNIBOX, listener)
    }
  },
  onOpenFind: (callback) => {
    const listener = (_event: IpcRendererEvent, open: boolean): void => {
      callback(open)
    }
    ipcRenderer.on(IpcChannels.FIND_OPEN, listener)
    return () => {
      ipcRenderer.removeListener(IpcChannels.FIND_OPEN, listener)
    }
  },
  onOpenTabSearch: (callback) => {
    const listener = (_event: IpcRendererEvent, open: boolean): void => {
      callback(open)
    }
    ipcRenderer.on(IpcChannels.TAB_SEARCH_OPEN, listener)
    return () => {
      ipcRenderer.removeListener(IpcChannels.TAB_SEARCH_OPEN, listener)
    }
  },
  onFindResult: (callback) => {
    const listener = (_event: IpcRendererEvent, result: FindResult): void => {
      callback(result)
    }
    ipcRenderer.on(IpcChannels.FIND_RESULT, listener)
    return () => {
      ipcRenderer.removeListener(IpcChannels.FIND_RESULT, listener)
    }
  },
  onDownloadsUpdated: (callback) => {
    const listener = (_event: IpcRendererEvent, payload: DownloadsUpdatedPayload): void => {
      callback(payload)
    }
    ipcRenderer.on(IpcChannels.DOWNLOADS_UPDATED, listener)
    return () => {
      ipcRenderer.removeListener(IpcChannels.DOWNLOADS_UPDATED, listener)
    }
  },
  onPasswordSavePrompt: (callback) => {
    const listener = (_event: IpcRendererEvent, prompt: PasswordSavePrompt | null): void => {
      callback(prompt)
    }
    ipcRenderer.on(IpcChannels.PASSWORDS_SAVE_PROMPT, listener)
    return () => {
      ipcRenderer.removeListener(IpcChannels.PASSWORDS_SAVE_PROMPT, listener)
    }
  },
  onBookmarksUpdated: (callback) => {
    const listener = (_event: IpcRendererEvent, state: BookmarksState): void => {
      callback(state)
    }
    ipcRenderer.on(IpcChannels.BOOKMARKS_UPDATED, listener)
    return () => {
      ipcRenderer.removeListener(IpcChannels.BOOKMARKS_UPDATED, listener)
    }
  },
  onTodosUpdated: (callback) => {
    const listener = (_event: IpcRendererEvent, state: TodosState): void => {
      callback(state)
    }
    ipcRenderer.on(IpcChannels.TODOS_UPDATED, listener)
    return () => {
      ipcRenderer.removeListener(IpcChannels.TODOS_UPDATED, listener)
    }
  },
  onFullScreenChanged: (callback) => {
    const listener = (_event: IpcRendererEvent, fullScreen: boolean): void => {
      callback(fullScreen)
    }
    ipcRenderer.on(IpcChannels.WINDOW_FULLSCREEN, listener)
    return () => {
      ipcRenderer.removeListener(IpcChannels.WINDOW_FULLSCREEN, listener)
    }
  }
}

contextBridge.exposeInMainWorld('lockin', api)
