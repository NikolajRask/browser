import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type {
  DownloadEntry,
  DownloadsUpdatedPayload,
  FindResult,
  LockinApi,
  NavState,
  PasswordSavePrompt,
  PasswordSaveResponse,
  SplitSide,
  TabInfo
} from '../shared/ipc'

// Channel names inlined so the sandboxed preload has no shared runtime chunks.
const IpcChannels = {
  TABS_LIST: 'tabs:list',
  TABS_UPDATED: 'tabs:updated',
  TABS_CREATE: 'tabs:create',
  TABS_CLOSE: 'tabs:close',
  TABS_ACTIVATE: 'tabs:activate',
  TABS_REORDER: 'tabs:reorder',
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
  PASSWORDS_SAVE_RESPONSE: 'passwords:save-response'
} as const

const api: LockinApi = {
  platform: process.platform,
  getTabs: () => ipcRenderer.invoke(IpcChannels.TABS_LIST),
  createTab: (url?) => ipcRenderer.invoke(IpcChannels.TABS_CREATE, url),
  closeTab: (id) => ipcRenderer.invoke(IpcChannels.TABS_CLOSE, id),
  activateTab: (id) => ipcRenderer.invoke(IpcChannels.TABS_ACTIVATE, id),
  reorderTab: (fromId, toId, position) =>
    ipcRenderer.invoke(IpcChannels.TABS_REORDER, fromId, toId, position),
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
  onTabsUpdated: (callback) => {
    const listener = (_event: IpcRendererEvent, tabs: TabInfo[]): void => {
      callback(tabs)
    }
    ipcRenderer.on(IpcChannels.TABS_UPDATED, listener)
    return () => {
      ipcRenderer.removeListener(IpcChannels.TABS_UPDATED, listener)
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
  }
}

contextBridge.exposeInMainWorld('lockin', api)
