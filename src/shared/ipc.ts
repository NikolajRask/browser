export const BOOKMARKS_BAR_HEIGHT = 28
/** Height of the tab strip row (`.chrome-header`). */
export const TAB_ROW_HEIGHT = 38
/** Tab strip + nav bar only. Bookmarks bar is added when visible. */
export const CHROME_HEIGHT = 78
export const APP_MENU_OVERLAY = 560
export const FIND_BAR_OVERLAY = 48
export const TAB_SEARCH_OVERLAY = 420
export const SPLIT_GAP = 6
export const AI_SIDEBAR_WIDTH = 360
export const AI_SIDEBAR_MIN_WIDTH = 280
export const AI_SIDEBAR_MAX_WIDTH = 640

export type AiChatRole = 'user' | 'assistant'

export type AiChatMessage = {
  role: AiChatRole
  content: string
}

export type AiChatScreenshot = {
  id: string
  imageBase64: string
  mediaType: 'image/jpeg'
  title: string
  url: string
  capturedAt: number
}

export type AiChatRequest = {
  messages: AiChatMessage[]
  /** When present and non-empty, these images are sent and auto page-screenshot routing is skipped. */
  screenshots?: AiChatScreenshot[]
}

export type AiChatResponse = {
  text: string
}

export type AiChatError = {
  error: string
}

export type AiChatChunk = {
  text: string
}

export type AiChatStoredRole = 'user' | 'assistant' | 'error'

export type AiChatStoredMessage = {
  id: string
  role: AiChatStoredRole
  content: string
  screenshots?: AiChatScreenshot[]
}

export type AiChatSessionSummary = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  pinned: boolean
}

export type AiChatSession = AiChatSessionSummary & {
  messages: AiChatStoredMessage[]
}

export type AiChatSavePayload = {
  id?: string
  title?: string
  messages: AiChatStoredMessage[]
}

export type ClaudeKeyStatus = {
  configured: boolean
}

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
  lastAccessed: number
  isIncognito: boolean
  isMuted: boolean
}

export type CreateTabPlacement = {
  tabId: string
  position: 'before' | 'after'
}

export type CreateTabOptions = {
  isIncognito?: boolean
  placement?: CreateTabPlacement
}

export type ClosedTabInfo = {
  url: string
  title: string
  favicon: string | null
  closedAt: number
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

export type BookmarkFolderNode = {
  id: string
  type: 'folder'
  title: string
  parentId: string | null
  children: string[]
  createdAt: number
}

export type BookmarkLinkNode = {
  id: string
  type: 'bookmark'
  title: string
  url: string
  favicon: string | null
  parentId: string
  createdAt: number
}

export type BookmarkNode = BookmarkFolderNode | BookmarkLinkNode

export type BookmarksState = {
  version: 1
  rootId: string
  barId: string
  otherId: string
  nodes: Record<string, BookmarkNode>
}

export type BookmarkAddPayload = {
  url: string
  title?: string
  favicon?: string | null
  parentId?: string
}

export type BookmarkFolderAddPayload = {
  title: string
  parentId: string
}

export type BookmarkMovePayload = {
  id: string
  parentId: string
  index?: number
}

export type BookmarkRenamePayload = {
  id: string
  title: string
}

export type BookmarkToggleResult = {
  bookmarked: boolean
  node: BookmarkLinkNode | null
}

export type BookmarkFolderOption = {
  id: string
  title: string
  depth: number
}

export type TodoFolder = {
  id: string
  title: string
  createdAt: number
  order: number
}

export type TodoItem = {
  id: string
  folderId: string
  title: string
  completed: boolean
  createdAt: number
}

export type TodosState = {
  version: 1
  folders: Record<string, TodoFolder>
  todos: Record<string, TodoItem>
  folderOrder: string[]
}

export type TodoFolderAddPayload = {
  title: string
}

export type TodoAddPayload = {
  folderId: string
  title: string
}

export type TodoRenamePayload = {
  id: string
  title: string
}

export type TodoMovePayload = {
  id: string
  folderId: string
}

export const IpcChannels = {
  TABS_LIST: 'tabs:list',
  TABS_UPDATED: 'tabs:updated',
  TABS_CREATE: 'tabs:create',
  TABS_CLOSE: 'tabs:close',
  TABS_ACTIVATE: 'tabs:activate',
  TABS_REORDER: 'tabs:reorder',
  TABS_CONTEXT_MENU: 'tabs:context-menu',
  TABS_TOGGLE_MUTE: 'tabs:toggle-mute',
  TABS_CLOSED_LIST: 'tabs:closed-list',
  TABS_CLOSED_UPDATED: 'tabs:closed-updated',
  TABS_REOPEN_CLOSED: 'tabs:reopen-closed',
  TAB_SEARCH_OPEN: 'tab-search:open',
  TAB_SEARCH_SET_OPEN: 'tab-search:set-open',
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
  AI_SIDEBAR_OPEN: 'chrome:ai-sidebar-open',
  AI_SIDEBAR_OPEN_CHANGED: 'chrome:ai-sidebar-open-changed',
  AI_SIDEBAR_GET_WIDTH: 'chrome:ai-sidebar-get-width',
  AI_SIDEBAR_WIDTH_CHANGED: 'chrome:ai-sidebar-width-changed',
  AI_SIDEBAR_RESIZE_START: 'chrome:ai-sidebar-resize-start',
  AI_SIDEBAR_RESIZE_MOVE: 'chrome:ai-sidebar-resize-move',
  AI_SIDEBAR_RESIZE_END: 'chrome:ai-sidebar-resize-end',
  AI_HAS_KEY: 'ai:has-key',
  AI_CHAT: 'ai:chat',
  AI_CHAT_CHUNK: 'ai:chat-chunk',
  AI_CAPTURE_SCREENSHOT: 'ai:capture-screenshot',
  AI_CHATS_LIST: 'ai:chats-list',
  AI_CHATS_GET: 'ai:chats-get',
  AI_CHATS_SAVE: 'ai:chats-save',
  AI_CHATS_REMOVE: 'ai:chats-remove',
  AI_CHATS_SET_PINNED: 'ai:chats-set-pinned',
  SETTINGS_CLAUDE_STATUS: 'settings:claude-status',
  SETTINGS_CLAUDE_SET: 'settings:claude-set',
  SETTINGS_CLAUDE_CLEAR: 'settings:claude-clear',
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
  PASSWORDS_COPY: 'passwords:copy',
  SCREENTIME_SUMMARY: 'screentime:summary',
  SCREENTIME_CLEAR: 'screentime:clear',
  BOOKMARKS_STATE: 'bookmarks:state',
  BOOKMARKS_BAR: 'bookmarks:bar',
  BOOKMARKS_UPDATED: 'bookmarks:updated',
  BOOKMARKS_FIND_URL: 'bookmarks:find-url',
  BOOKMARKS_ADD: 'bookmarks:add',
  BOOKMARKS_TOGGLE: 'bookmarks:toggle',
  BOOKMARKS_ADD_FOLDER: 'bookmarks:add-folder',
  BOOKMARKS_RENAME: 'bookmarks:rename',
  BOOKMARKS_REMOVE: 'bookmarks:remove',
  BOOKMARKS_MOVE: 'bookmarks:move',
  BOOKMARKS_FOLDERS: 'bookmarks:folders',
  BOOKMARKS_OPEN: 'bookmarks:open',
  BOOKMARKS_OPEN_PAGE: 'bookmarks:open-page',
  TODOS_STATE: 'todos:state',
  TODOS_UPDATED: 'todos:updated',
  TODOS_ADD_FOLDER: 'todos:add-folder',
  TODOS_RENAME_FOLDER: 'todos:rename-folder',
  TODOS_REMOVE_FOLDER: 'todos:remove-folder',
  TODOS_ADD_TODO: 'todos:add-todo',
  TODOS_TOGGLE_TODO: 'todos:toggle-todo',
  TODOS_RENAME_TODO: 'todos:rename-todo',
  TODOS_REMOVE_TODO: 'todos:remove-todo',
  TODOS_MOVE_TODO: 'todos:move-todo',
  TODOS_OPEN_PAGE: 'todos:open-page',
  PAGE_PRINT: 'page:print',
  PAGE_LINK_DRAG: 'page:link-drag',
  PAGE_PICTURE_IN_PICTURE: 'page:picture-in-picture',
  PAGE_PICTURE_IN_PICTURE_CHANGED: 'page:picture-in-picture-changed',
  WINDOW_FULLSCREEN: 'window:fullscreen',
  WINDOW_IS_FULLSCREEN: 'window:is-fullscreen',
  WINDOW_CLOSE: 'window:close',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_TOGGLE_FULLSCREEN: 'window:toggle-fullscreen'
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

export type ScreenTimeDay = {
  day: string
  totalMs: number
}

export type ScreenTimeOrigin = {
  origin: string
  ms: number
  streakDays: number
}

export type ScreenTimeStreak = {
  origin: string
  streakDays: number
}

export type ScreenTimeSummary = {
  todayTotalMs: number
  days: ScreenTimeDay[]
  topOrigins: ScreenTimeOrigin[]
  streaks: ScreenTimeStreak[]
}

export type LockinApi = {
  platform: 'darwin' | 'win32' | 'linux' | string
  getTabs: () => Promise<TabInfo[]>
  createTab: (url?: string, options?: CreateTabOptions) => Promise<void>
  closeTab: (id: string) => Promise<void>
  activateTab: (id: string) => Promise<void>
  reorderTab: (fromId: string, toId: string, position: 'before' | 'after') => Promise<void>
  showTabContextMenu: (id: string) => Promise<void>
  toggleMuteTab: (id: string) => Promise<void>
  getClosedTabs: () => Promise<ClosedTabInfo[]>
  reopenClosedTab: (index: number) => Promise<void>
  beginSplitDrag: (tabId: string) => Promise<void>
  endSplitDrag: () => Promise<void>
  enterSplit: (tabId: string, side: SplitSide) => Promise<void>
  goBack: () => Promise<void>
  goForward: () => Promise<void>
  reload: () => Promise<void>
  navigate: (url: string) => Promise<void>
  setAppMenuOpen: (open: boolean) => Promise<void>
  setAiSidebarOpen: (open: boolean) => Promise<void>
  getAiSidebarWidth: () => Promise<number>
  startAiSidebarResize: () => void
  moveAiSidebarResize: (screenX: number) => void
  endAiSidebarResize: () => void
  aiHasKey: () => Promise<boolean>
  aiChat: (request: AiChatRequest) => Promise<AiChatResponse | AiChatError>
  onAiChatChunk: (callback: (chunk: AiChatChunk) => void) => () => void
  captureAiScreenshot: () => Promise<AiChatScreenshot | null>
  listAiChats: () => Promise<AiChatSessionSummary[]>
  getAiChat: (id: string) => Promise<AiChatSession | null>
  saveAiChat: (payload: AiChatSavePayload) => Promise<AiChatSession | null>
  removeAiChat: (id: string) => Promise<boolean>
  setAiChatPinned: (id: string, pinned: boolean) => Promise<boolean>
  setFindOpen: (open: boolean) => Promise<void>
  setTabSearchOpen: (open: boolean) => Promise<void>
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
  getBookmarksState: () => Promise<BookmarksState>
  listBookmarksBar: () => Promise<BookmarkNode[]>
  findBookmarkByUrl: (url: string) => Promise<BookmarkLinkNode | null>
  addBookmark: (payload: BookmarkAddPayload) => Promise<BookmarkLinkNode | null>
  toggleBookmark: (payload: BookmarkAddPayload) => Promise<BookmarkToggleResult>
  openBookmark: (url: string) => Promise<void>
  openBookmarksPage: () => Promise<void>
  getTodosState: () => Promise<TodosState>
  addTodo: (payload: TodoAddPayload) => Promise<TodoItem | null>
  toggleTodo: (id: string) => Promise<TodoItem | null>
  removeTodo: (id: string) => Promise<boolean>
  openTodosPage: () => Promise<void>
  printPage: () => Promise<void>
  togglePictureInPicture: () => Promise<void>
  isFullScreen: () => Promise<boolean>
  closeWindow: () => Promise<void>
  minimizeWindow: () => Promise<void>
  toggleFullScreen: () => Promise<void>
  onTabsUpdated: (callback: (tabs: TabInfo[]) => void) => () => void
  onClosedTabsUpdated: (callback: (tabs: ClosedTabInfo[]) => void) => () => void
  onNavState: (callback: (state: NavState) => void) => () => void
  onFocusOmnibox: (callback: () => void) => () => void
  onOpenFind: (callback: (open: boolean) => void) => () => void
  onOpenTabSearch: (callback: (open: boolean) => void) => () => void
  onFindResult: (callback: (result: FindResult) => void) => () => void
  onDownloadsUpdated: (callback: (payload: DownloadsUpdatedPayload) => void) => () => void
  onPasswordSavePrompt: (callback: (prompt: PasswordSavePrompt | null) => void) => () => void
  onBookmarksUpdated: (callback: (state: BookmarksState) => void) => () => void
  onTodosUpdated: (callback: (state: TodosState) => void) => () => void
  onAiSidebarOpenChanged: (callback: (open: boolean) => void) => () => void
  onAiSidebarWidthChanged: (callback: (width: number) => void) => () => void
  onFullScreenChanged: (callback: (fullScreen: boolean) => void) => () => void
}
