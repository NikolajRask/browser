export const CHROME_HEIGHT = 78
export const APP_MENU_OVERLAY = 360
export const FIND_BAR_OVERLAY = 48
export const SPLIT_GAP = 6

export type FindResult = {
  activeMatchOrdinal: number
  matches: number
  finalUpdate: boolean
}

export type SplitSide = 'left' | 'right'

export type TabInfo = {
  id: string
  title: string
  url: string
  favicon: string | null
  active: boolean
  splitSide: SplitSide | null
}

export type NavState = {
  url: string
  canGoBack: boolean
  canGoForward: boolean
}

export type HistoryEntry = {
  id: string
  url: string
  title: string
  favicon: string | null
  visitedAt: number
}

export type HistoryClearRange = 'hour' | 'day' | 'week' | 'month' | 'all'

export type DownloadState = 'progressing' | 'completed' | 'cancelled' | 'interrupted'

export type DownloadEntry = {
  id: string
  url: string
  filename: string
  savePath: string
  mimeType: string
  totalBytes: number
  receivedBytes: number
  state: DownloadState
  startedAt: number
  endedAt: number | null
  canResume: boolean
  paused: boolean
}

export const IpcChannels = {
  TABS_LIST: 'tabs:list',
  TABS_UPDATED: 'tabs:updated',
  TABS_CREATE: 'tabs:create',
  TABS_CLOSE: 'tabs:close',
  TABS_ACTIVATE: 'tabs:activate',
  TABS_REORDER: 'tabs:reorder',
  SPLIT_DRAG_START: 'split:drag-start',
  SPLIT_DRAG_END: 'split:drag-end',
  SPLIT_ENTER: 'split:enter',
  SPLIT_RESIZE_START: 'split:resize-start',
  SPLIT_RESIZE_MOVE: 'split:resize-move',
  SPLIT_RESIZE_END: 'split:resize-end',
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
  HISTORY_LIST: 'history:list',
  HISTORY_REMOVE: 'history:remove',
  HISTORY_CLEAR: 'history:clear',
  HISTORY_OPEN: 'history:open',
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
  PASSWORDS_LOGIN_DETECTED: 'passwords:login-detected',
  PASSWORDS_SAVE_PROMPT: 'passwords:save-prompt',
  PASSWORDS_SAVE_RESPONSE: 'passwords:save-response',
  PASSWORDS_FOR_ORIGIN: 'passwords:for-origin',
  PASSWORDS_LIST: 'passwords:list',
  PASSWORDS_REMOVE: 'passwords:remove',
  PASSWORDS_CLEAR: 'passwords:clear',
  PASSWORDS_REVEAL: 'passwords:reveal',
  PASSWORDS_COPY: 'passwords:copy'
} as const

export type DownloadsUpdatedPayload = {
  entries: DownloadEntry[]
  changedId: string | null
}

export type CredentialListItem = {
  id: string
  origin: string
  username: string
  createdAt: number
  updatedAt: number
}

export type CredentialAutofillItem = {
  id: string
  origin: string
  username: string
  password: string
}

export type PasswordSavePrompt = {
  id: string
  origin: string
  username: string
}

export type PasswordSaveAction = 'save' | 'dismiss' | 'never'

export type PasswordSaveResponse = {
  id: string
  action: PasswordSaveAction
}

export type LoginDetectedPayload = {
  origin: string
  username: string
  password: string
}

export type LockinApi = {
  platform: 'darwin' | 'win32' | 'linux' | string
  getTabs: () => Promise<TabInfo[]>
  createTab: (url?: string) => Promise<void>
  closeTab: (id: string) => Promise<void>
  activateTab: (id: string) => Promise<void>
  reorderTab: (fromId: string, toId: string, position: 'before' | 'after') => Promise<void>
  beginSplitDrag: (tabId: string) => Promise<void>
  endSplitDrag: () => Promise<void>
  enterSplit: (tabId: string, side: SplitSide) => Promise<void>
  goBack: () => Promise<void>
  goForward: () => Promise<void>
  reload: () => Promise<void>
  navigate: (url: string) => Promise<void>
  setAppMenuOpen: (open: boolean) => Promise<void>
  setFindOpen: (open: boolean) => Promise<void>
  findInPage: (query: string) => Promise<void>
  findNext: () => Promise<void>
  findPrevious: () => Promise<void>
  stopFindInPage: () => Promise<void>
  suggestHistory: (query: string, limit?: number) => Promise<HistoryEntry[]>
  listDownloads: () => Promise<DownloadEntry[]>
  cancelDownload: (id: string) => Promise<boolean>
  pauseDownload: (id: string) => Promise<boolean>
  resumeDownload: (id: string) => Promise<boolean>
  openDownload: (id: string) => Promise<boolean>
  showDownloadInFolder: (id: string) => Promise<boolean>
  removeDownload: (id: string) => Promise<boolean>
  clearDownloads: () => Promise<void>
  openDownloadsPage: () => Promise<void>
  respondToPasswordSave: (response: PasswordSaveResponse) => Promise<boolean>
  onTabsUpdated: (callback: (tabs: TabInfo[]) => void) => () => void
  onNavState: (callback: (state: NavState) => void) => () => void
  onFocusOmnibox: (callback: () => void) => () => void
  onOpenFind: (callback: (open: boolean) => void) => () => void
  onFindResult: (callback: (result: FindResult) => void) => () => void
  onDownloadsUpdated: (callback: (payload: DownloadsUpdatedPayload) => void) => () => void
  onPasswordSavePrompt: (callback: (prompt: PasswordSavePrompt | null) => void) => () => void
}
