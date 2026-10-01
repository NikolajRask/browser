import { join } from 'path'
import { Menu, WebContentsView, type BaseWindow, type WebContents } from 'electron'
import { randomUUID } from 'crypto'
import {
  CHROME_HEIGHT,
  TAB_ROW_HEIGHT,
  BOOKMARKS_BAR_HEIGHT,
  APP_MENU_OVERLAY,
  FIND_BAR_OVERLAY,
  TAB_SEARCH_OVERLAY,
  AI_SIDEBAR_WIDTH,
  AI_SIDEBAR_MIN_WIDTH,
  AI_SIDEBAR_MAX_WIDTH,
  IpcChannels,
  SPLIT_GAP,
  type ClosedTabInfo,
  type FindResult,
  type NavState,
  type SplitSide,
  type TabInfo
} from '../shared/ipc'
import { attachPageContextMenu } from './page-context-menu'
import { SPLITTER_PAGE_HTML } from './splitter-page'
import { AI_RESIZE_OVERLAY_HTML } from './ai-resize-overlay-page'
import { HistoryStore, shouldRecordHistoryUrl } from './history-store'
import type { BookmarkStore } from './bookmark-store'
import {
  SessionStore,
  type BrowserSessionState,
  type SessionTab
} from './session-store'
import { buildErrorPageDataUrl, errorPageTitle } from './error-page'
import { isValidTld } from '../shared/tlds'
import type { ScreenTimeTracker } from './screentime-tracker'
import {
  INCOGNITO_PARTITION,
  clearIncognitoSession,
  configureIncognitoSession
} from './browser-session'

const DEFAULT_URL = 'lockin://newtab'
const PAGE_PRELOAD = join(__dirname, '../preload/page.js')
const MAX_CLOSED_TABS = 25

function isNewTabUrl(url: string): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'lockin:' && parsed.hostname === 'newtab'
  } catch {
    return url === 'lockin://newtab' || url.startsWith('lockin://newtab/')
  }
}

function displayUrl(url: string): string {
  return !url || url === 'about:blank' || isNewTabUrl(url) ? '' : url
}

function isBlankUrl(url: string): boolean {
  return !url || url === 'about:blank' || isNewTabUrl(url)
}

function shouldCapturePageForAi(url: string): boolean {
  if (!url || url === 'about:blank' || isBlankUrl(url)) return false
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'lockin:' && parsed.hostname === 'passwords') return false
  } catch {
    return false
  }
  return true
}

function isErrorInterstitialUrl(url: string): boolean {
  return url.startsWith('data:text/html')
}

function lockinPageTitle(url: string, isIncognito = false): string {
  try {
    const hostname = new URL(url).hostname
    if (hostname === 'history') return 'History'
    if (hostname === 'downloads') return 'Downloads'
    if (hostname === 'passwords') return 'Passwords'
    if (hostname === 'screentime') return 'Time Locked in'
    if (hostname === 'bookmarks') return 'Bookmarks'
    if (hostname === 'todos') return 'Todos'
    if (hostname === 'settings') return 'Settings'
    if (hostname === 'newtab') return isIncognito ? 'New Incognito Tab' : 'New Tab'
  } catch {
    // Fall through.
  }
  return 'Lockin'
}

function svgDataUri(body: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none">${body}</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const LOCKIN_PAGE_ICONS: Record<string, string> = {
  bookmarks: svgDataUri(
    `<path d="M4.5 2.5h7a1 1 0 0 1 1 1v10.2L8 11.3l-4.5 2.4V3.5a1 1 0 0 1 1-1Z" stroke="#5f6368" stroke-width="1.4" stroke-linejoin="round"/>`
  ),
  todos: svgDataUri(
    `<rect x="2.5" y="2.5" width="11" height="11" rx="2" stroke="#5f6368" stroke-width="1.4"/><path d="M5 8.1 6.9 10l4.1-4.2" stroke="#5f6368" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`
  ),
  downloads: svgDataUri(
    `<path d="M8 2.5v7.2M5.2 7.3 8 10.1l2.8-2.8M3.5 12.5h9" stroke="#5f6368" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`
  ),
  history: svgDataUri(
    `<circle cx="8" cy="8" r="5.4" stroke="#5f6368" stroke-width="1.4"/><path d="M8 5.2v3.1l2 1.2" stroke="#5f6368" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`
  ),
  screentime: svgDataUri(
    `<path d="M3 12.5V7.2M6.5 12.5V4M10 12.5V8.2M13.5 12.5H2.5" stroke="#5f6368" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`
  ),
  passwords: svgDataUri(
    `<path d="M5.2 7V5.4a2.8 2.8 0 0 1 5.6 0V7" stroke="#5f6368" stroke-width="1.4" stroke-linecap="round"/><rect x="3.5" y="7" width="9" height="6.2" rx="1.4" stroke="#5f6368" stroke-width="1.4"/>`
  ),
  settings: svgDataUri(
    `<circle cx="8" cy="8" r="2.1" stroke="#5f6368" stroke-width="1.4"/><path d="M6.7 2.6h2.6l.4 1.3.9.4 1.2-.7 1.3 1.3-.7 1.2.4.9 1.3.4v2.6l-1.3.4-.4.9.7 1.2-1.3 1.3-1.2-.7-.9.4-.4 1.3H6.7l-.4-1.3-.9-.4-1.2.7L3 11.7l.7-1.2-.4-.9-1.3-.4V6.7l1.3-.4.4-.9L3 3.2 4.2 1.9l1.2.7.9-.4.4-1.3Z" stroke="#5f6368" stroke-width="1.15" stroke-linejoin="round"/>`
  ),
  newtab: svgDataUri(
    `<circle cx="7" cy="7" r="4.2" stroke="#5f6368" stroke-width="1.4"/><path d="M10.2 10.2 13 13" stroke="#5f6368" stroke-width="1.4" stroke-linecap="round"/>`
  )
}

function lockinPageFavicon(url: string): string | null {
  try {
    const hostname = new URL(url).hostname
    return LOCKIN_PAGE_ICONS[hostname] ?? null
  } catch {
    return null
  }
}

type Tab = {
  id: string
  title: string
  url: string
  favicon: string | null
  lastAccessed: number
  view: WebContentsView
  suppressHistory: boolean
  isIncognito: boolean
  /** Failed navigation URL while an interstitial error page is shown. */
  errorUrl: string | null
}

type SplitState = {
  leftId: string
  rightId: string
}

type CreateTabOptions = {
  activate?: boolean
  suppressHistory?: boolean
  isIncognito?: boolean
  title?: string
  favicon?: string | null
  afterId?: string
  placement?: { tabId: string; position: 'before' | 'after' }
}

export class TabManager {
  private window: BaseWindow
  private chromeView: WebContentsView
  private history: HistoryStore
  private session: SessionStore
  private bookmarks: BookmarkStore | null
  private screenTime: ScreenTimeTracker | null
  private tabs = new Map<string, Tab>()
  private activeTabId: string | null = null
  private split: SplitState | null = null
  private splitRatio = 0.5
  private isResizingSplit = false
  private pageViewsHidden = false
  private chromeExpanded = false
  private appMenuOpen = false
  private aiSidebarOpen = false
  private aiSidebarWidth = AI_SIDEBAR_WIDTH
  private isResizingAiSidebar = false
  private findOpen = false
  private tabSearchOpen = false
  private bookmarksBarVisible = false
  private findQuery = ''
  private closedTabs: ClosedTabInfo[] = []
  private splitterView: WebContentsView | null = null
  private aiSidebarView: WebContentsView | null = null
  private aiResizeOverlay: WebContentsView | null = null
  /** Tracks whether an HTML PiP window is currently open. */
  private pictureInPictureActive = false
  private pipToggleInFlight = false
  private restoring = false
  private externalLinkDrag: { url: string; isIncognito: boolean; handled: boolean } | null = null
  private onTabsChanged: (tabs: TabInfo[]) => void
  private onNavChanged: (state: NavState) => void
  private onClosedTabsChanged: (tabs: ClosedTabInfo[]) => void

  constructor(
    window: BaseWindow,
    chromeView: WebContentsView,
    history: HistoryStore,
    session: SessionStore,
    handlers: {
      onTabsChanged: (tabs: TabInfo[]) => void
      onNavChanged: (state: NavState) => void
      onClosedTabsChanged?: (tabs: ClosedTabInfo[]) => void
    },
    screenTime?: ScreenTimeTracker | null,
    bookmarks?: BookmarkStore | null
  ) {
    this.window = window
    this.chromeView = chromeView
    this.history = history
    this.session = session
    this.screenTime = screenTime ?? null
    this.bookmarks = bookmarks ?? null
    this.onTabsChanged = handlers.onTabsChanged
    this.onNavChanged = handlers.onNavChanged
    this.onClosedTabsChanged = handlers.onClosedTabsChanged ?? (() => {})
    this.attachKeyboardShortcuts(chromeView.webContents)
  }

  private syncScreenTime(): void {
    if (!this.screenTime) return
    const tab = this.getActiveTab()
    if (tab?.isIncognito) {
      this.screenTime.setActiveUrl(null)
      return
    }
    this.screenTime.setActiveUrl(tab?.url ?? null)
  }

  private hasIncognitoTabs(): boolean {
    return Array.from(this.tabs.values()).some((tab) => tab.isIncognito)
  }

  private maybeClearIncognitoSession(): void {
    if (this.hasIncognitoTabs()) return
    void clearIncognitoSession()
  }

  relayout(): void {
    this.layoutViews()
  }

  setBookmarksBarVisible(visible: boolean): void {
    if (this.bookmarksBarVisible === visible) return
    this.bookmarksBarVisible = visible
    this.layoutViews()
  }

  private chromeHeight(): number {
    return CHROME_HEIGHT + (this.bookmarksBarVisible ? BOOKMARKS_BAR_HEIGHT : 0)
  }

  startSplitResize(): void {
    if (!this.split) return
    this.isResizingSplit = true
    this.layoutViews()
    this.syncSplitterBar()
  }

  moveSplitResize(screenX: number): void {
    if (!this.split || !this.isResizingSplit) return

    const left = this.tabs.get(this.split.leftId)
    const right = this.tabs.get(this.split.rightId)
    if (!left || !right) return

    const [width, height] = this.window.getContentSize()
    const contentHeight = Math.max(height - this.chromeHeight(), 0)
    const available = Math.max(width - SPLIT_GAP, 0)
    if (available <= 0) return

    const contentBounds = this.window.getContentBounds()
    const clientX = Math.round(screenX - contentBounds.x)

    const minWidth = Math.min(
      Math.max(200, Math.round(width * 0.2)),
      Math.floor(available / 2)
    )

    const leftWidth = Math.min(Math.max(clientX, minWidth), available - minWidth)
    this.splitRatio = leftWidth / available

    // Update pane bounds only — avoid a full relayout (chrome/splitter reattach) every move.
    left.view.setBounds({
      x: 0,
      y: this.chromeHeight(),
      width: leftWidth,
      height: contentHeight
    })
    right.view.setBounds({
      x: leftWidth + SPLIT_GAP,
      y: this.chromeHeight(),
      width: Math.max(width - leftWidth - SPLIT_GAP, 0),
      height: contentHeight
    })
  }

  endSplitResize(): void {
    if (!this.isResizingSplit) return
    this.isResizingSplit = false
    this.layoutViews()
  }

  createTab(url = DEFAULT_URL, options: CreateTabOptions = {}): string {
    const activate = options.activate !== false
    const isIncognito = options.isIncognito === true
    const id = randomUUID()

    if (isIncognito) configureIncognitoSession()

    const view = new WebContentsView({
      webPreferences: {
        preload: PAGE_PRELOAD,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        ...(isIncognito ? { partition: INCOGNITO_PARTITION } : {})
      }
    })

    const initialUrl = url || DEFAULT_URL
    const now = Date.now()
    const tab: Tab = {
      id,
      title:
        options.title?.trim() ||
        (initialUrl.startsWith('lockin://')
          ? lockinPageTitle(initialUrl, isIncognito)
          : 'New Tab'),
      url: initialUrl,
      favicon:
        options.favicon ??
        (initialUrl.startsWith('lockin://') ? lockinPageFavicon(initialUrl) : null),
      lastAccessed: now,
      view,
      suppressHistory: options.suppressHistory === true,
      isIncognito,
      errorUrl: null
    }

    this.tabs.set(id, tab)

    const [width, height] = this.window.getContentSize()
    view.setBounds({
      x: 0,
      y: this.chromeHeight(),
      width,
      height: Math.max(height - this.chromeHeight(), 0)
    })
    if (!activate) view.setVisible(false)
    this.window.contentView.addChildView(view)

    const { webContents } = view

    const recordVisit = (navigatedUrl: string): void => {
      if (tab.isIncognito) return
      if (tab.suppressHistory) {
        tab.suppressHistory = false
        return
      }
      if (!shouldRecordHistoryUrl(navigatedUrl)) return
      this.history.add({
        url: navigatedUrl,
        title: isBlankUrl(navigatedUrl) ? navigatedUrl : webContents.getTitle() || tab.title,
        favicon: tab.favicon,
        visitedAt: Date.now()
      })
    }

    webContents.on('page-title-updated', (_event, title) => {
      tab.title = isBlankUrl(webContents.getURL())
        ? tab.isIncognito
          ? 'New Incognito Tab'
          : 'New Tab'
        : title || 'New Tab'
      if (!tab.isIncognito) {
        this.history.updateMeta(webContents.getURL() || tab.url, { title: tab.title })
      }
      this.emitTabs()
    })

    webContents.on('page-favicon-updated', (_event, favicons) => {
      tab.favicon = favicons.at(-1) ?? favicons[0] ?? null
      if (!tab.isIncognito) {
        this.history.updateMeta(webContents.getURL() || tab.url, { favicon: tab.favicon })
      }
      this.emitTabs()
    })

    webContents.on('did-start-navigation', (_event, nextUrl, isInPlace, isMainFrame) => {
      if (!isMainFrame || isInPlace) return
      if (!tab.suppressHistory) {
        tab.favicon = nextUrl.startsWith('lockin://') ? lockinPageFavicon(nextUrl) : null
      }
      this.emitTabs()
    })

    webContents.on('did-navigate', (_event, navigatedUrl) => {
      if (isErrorInterstitialUrl(navigatedUrl)) {
        if (tab.errorUrl) {
          tab.url = tab.errorUrl
          this.emitTabs()
          if (this.activeTabId === id) this.emitNav()
        }
        return
      }

      tab.errorUrl = null
      tab.url = navigatedUrl
      if (navigatedUrl.startsWith('lockin://')) {
        tab.title = lockinPageTitle(navigatedUrl, tab.isIncognito)
        tab.favicon = lockinPageFavicon(navigatedUrl)
      }
      recordVisit(navigatedUrl)
      this.emitTabs()
      if (this.activeTabId === id) {
        this.emitNav()
        this.syncScreenTime()
      }
    })

    webContents.on('did-navigate-in-page', (_event, navigatedUrl, isMainFrame) => {
      if (!isMainFrame) return
      tab.url = navigatedUrl
      recordVisit(navigatedUrl)
      this.emitTabs()
      if (this.activeTabId === id) {
        this.emitNav()
        this.syncScreenTime()
      }
    })

    webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame) return
      // -3 = ERR_ABORTED (user navigated away / superseded request)
      if (errorCode === -3) return
      if (isErrorInterstitialUrl(validatedURL)) return

      const failedUrl = validatedURL || tab.url
      if (!failedUrl || isBlankUrl(failedUrl)) return

      tab.errorUrl = failedUrl
      tab.url = failedUrl
      tab.title = errorPageTitle(errorCode)
      tab.favicon = null
      this.emitTabs()
      if (this.activeTabId === id) this.emitNav()

      void webContents.loadURL(buildErrorPageDataUrl(failedUrl, errorCode, errorDescription))
    })

    webContents.on('did-finish-load', () => {
      const currentUrl = webContents.getURL()
      if (isErrorInterstitialUrl(currentUrl)) {
        if (tab.errorUrl) {
          tab.url = tab.errorUrl
          this.emitTabs()
          if (this.activeTabId === id) this.emitNav()
        }
        return
      }

      tab.url = currentUrl
      if (tab.url.startsWith('lockin://')) {
        tab.title = lockinPageTitle(tab.url, tab.isIncognito)
        tab.favicon = lockinPageFavicon(tab.url)
      } else {
        tab.title = isBlankUrl(tab.url)
          ? tab.isIncognito
            ? 'New Incognito Tab'
            : 'New Tab'
          : webContents.getTitle() || tab.title
      }
      if (!tab.isIncognito) {
        this.history.updateMeta(tab.url, { title: tab.title, favicon: tab.favicon })
      }
      this.emitTabs()
      if (this.activeTabId === id) this.emitNav()
    })

    webContents.on('focus', () => {
      if (!this.split) return
      if (id !== this.split.leftId && id !== this.split.rightId) return
      if (this.activeTabId === id) return
      this.activeTabId = id
      this.emitTabs()
      this.emitNav()
      this.syncScreenTime()
    })

    webContents.on('found-in-page', (_event, result) => {
      if (this.activeTabId !== id) return
      this.emitFindResult({
        activeMatchOrdinal: result.activeMatchOrdinal,
        matches: result.matches,
        finalUpdate: result.finalUpdate
      })
    })

    webContents.setWindowOpenHandler(({ url: openUrl }) => {
      this.createTab(openUrl, { isIncognito: tab.isIncognito })
      return { action: 'deny' }
    })

    attachPageContextMenu(webContents, this.window, {
      isIncognito: tab.isIncognito,
      openInNewTab: (openUrl) => this.createTab(openUrl, { isIncognito: tab.isIncognito }),
      openInIncognitoTab: (openUrl) => this.createTab(openUrl, { isIncognito: true }),
      goBack: () => this.goBack(),
      goForward: () => this.goForward(),
      reload: () => this.reload(),
      bookmarkPage: () => {
        const active = this.getActiveTab()
        if (!active || !this.bookmarks) return
        this.bookmarks.addBookmark({
          url: active.url,
          title: active.title,
          favicon: active.favicon
        })
      },
      bookmarkLink: (linkUrl, linkText) => {
        if (!this.bookmarks) return
        this.bookmarks.addBookmark({
          url: linkUrl,
          title: linkText || linkUrl,
          favicon: null
        })
      },
      pictureInPicture: (options) => {
        void this.togglePictureInPicture({ ...options, webContents })
      }
    })

    this.attachKeyboardShortcuts(webContents)

    void webContents.loadURL(initialUrl)

    if (options.placement && this.tabs.has(options.placement.tabId)) {
      this.reorderTab(id, options.placement.tabId, options.placement.position)
    } else if (options.afterId && this.tabs.has(options.afterId)) {
      this.reorderTab(id, options.afterId, 'after')
    }

    if (activate) {
      this.activateTab(id)
    } else {
      this.emitTabs()
    }
    return id
  }

  restoreSession(): void {
    const saved = this.session.load()
    if (saved.tabs.length === 0) {
      this.createTab()
      return
    }

    this.restoring = true
    try {
      const ids: string[] = []
      for (const tab of saved.tabs) {
        const raw = tab.url?.trim() || DEFAULT_URL
        const url = raw === 'about:blank' ? DEFAULT_URL : raw
        ids.push(
          this.createTab(url, {
            activate: false,
            suppressHistory: true,
            title: tab.title,
            favicon: tab.favicon
          })
        )
      }

      const activeId = ids[saved.activeIndex] ?? ids.at(-1)
      if (!activeId) {
        this.createTab()
        return
      }

      if (saved.split) {
        const leftId = ids[saved.split.leftIndex]
        const rightId = ids[saved.split.rightIndex]
        if (leftId && rightId && leftId !== rightId) {
          this.split = { leftId, rightId }
          this.splitRatio = saved.split.ratio
          this.activeTabId = activeId
          this.layoutViews()
          this.emitTabs()
          this.emitNav()
          this.syncScreenTime()
          this.tabs.get(activeId)?.view.webContents.focus()
          return
        }
      }

      this.activateTab(activeId)
    } finally {
      this.restoring = false
      this.persistSession()
    }
  }

  persistSession(): void {
    this.session.save(this.getSessionState())
  }

  private getSessionState(): BrowserSessionState {
    const tabs = [...this.tabs.values()].filter((tab) => !tab.isIncognito)
    let activeIndex = tabs.findIndex((tab) => tab.id === this.activeTabId)
    if (activeIndex < 0) {
      activeIndex = Math.max(0, tabs.length - 1)
    }

    let split: BrowserSessionState['split'] = null
    if (this.split) {
      const leftIndex = tabs.findIndex((tab) => tab.id === this.split!.leftId)
      const rightIndex = tabs.findIndex((tab) => tab.id === this.split!.rightId)
      if (leftIndex >= 0 && rightIndex >= 0 && leftIndex !== rightIndex) {
        split = {
          leftIndex,
          rightIndex,
          ratio: this.splitRatio
        }
      }
    }

    return {
      version: 1,
      tabs: tabs.map(
        (tab): SessionTab => ({
          url: isBlankUrl(tab.url) ? '' : tab.url,
          title: tab.title,
          favicon: tab.favicon
        })
      ),
      activeIndex,
      split
    }
  }

  activateTab(id: string): void {
    const tab = this.tabs.get(id)
    if (!tab) return

    tab.lastAccessed = Date.now()

    if (this.split && (id === this.split.leftId || id === this.split.rightId)) {
      this.activeTabId = id
      this.layoutViews()
      this.emitTabs()
      this.emitNav()
      this.syncScreenTime()
      if (this.tabSearchOpen) {
        this.closeTabSearch()
        return
      }
      tab.view.webContents.focus()
      return
    }

    this.split = null
    this.isResizingSplit = false
    this.splitRatio = 0.5
    this.detachSplitter()
    this.activeTabId = id
    this.layoutViews()
    this.emitTabs()
    this.emitNav()
    this.syncScreenTime()

    if (this.tabSearchOpen) {
      this.closeTabSearch()
      return
    }

    if (this.findOpen) {
      for (const [tabId, other] of this.tabs) {
        if (tabId === id || other.view.webContents.isDestroyed()) continue
        other.view.webContents.stopFindInPage('clearSelection')
      }
      if (this.findQuery) {
        tab.view.webContents.findInPage(this.findQuery)
      }
      this.chromeView.webContents.focus()
      return
    }

    if (isBlankUrl(tab.url) || isBlankUrl(tab.view.webContents.getURL())) {
      this.focusOmnibox()
    } else {
      tab.view.webContents.focus()
    }
  }

  closeTab(id: string): void {
    const tab = this.tabs.get(id)
    if (!tab) return

    const wasIncognito = tab.isIncognito
    this.pushClosedTab(tab)

    const splitPartner =
      this.split?.leftId === id
        ? this.split.rightId
        : this.split?.rightId === id
          ? this.split.leftId
          : null

    this.window.contentView.removeChildView(tab.view)
    tab.view.webContents.close()
    this.tabs.delete(id)

    if (wasIncognito) this.maybeClearIncognitoSession()

    if (this.split && (this.split.leftId === id || this.split.rightId === id)) {
      this.split = null
      this.isResizingSplit = false
      this.splitRatio = 0.5
      this.detachSplitter()
    }

    if (this.tabs.size === 0) {
      this.createTab()
      return
    }

    if (splitPartner && this.tabs.has(splitPartner)) {
      this.activateTab(splitPartner)
      return
    }

    if (this.activeTabId === id) {
      const next = [...this.tabs.keys()].at(-1)
      if (next) this.activateTab(next)
    } else {
      this.layoutViews()
      this.emitTabs()
    }
  }

  closeOtherTabs(keepId: string): void {
    if (!this.tabs.has(keepId)) return
    const toClose = [...this.tabs.keys()].filter((id) => id !== keepId)
    for (const id of toClose) {
      this.closeTab(id)
    }
  }

  duplicateTab(id: string): void {
    const tab = this.tabs.get(id)
    if (!tab) return
    this.createTab(tab.url || DEFAULT_URL, {
      isIncognito: tab.isIncognito,
      afterId: id
    })
  }

  toggleMuteTab(id: string): void {
    const tab = this.tabs.get(id)
    if (!tab || tab.view.webContents.isDestroyed()) return
    const muted = tab.view.webContents.isAudioMuted()
    tab.view.webContents.setAudioMuted(!muted)
    this.emitTabs()
  }

  showTabContextMenu(tabId: string): void {
    const tab = this.tabs.get(tabId)
    if (!tab || this.window.isDestroyed()) return

    const hasOthers = this.tabs.size > 1
    const isMuted =
      !tab.view.webContents.isDestroyed() && tab.view.webContents.isAudioMuted()
    const menu = Menu.buildFromTemplate([
      {
        label: 'Close tab',
        click: () => this.closeTab(tabId)
      },
      {
        label: 'Close every other tab',
        enabled: hasOthers,
        click: () => this.closeOtherTabs(tabId)
      },
      { type: 'separator' },
      {
        label: 'New tab to the right',
        click: () =>
          this.createTab(DEFAULT_URL, {
            isIncognito: tab.isIncognito,
            afterId: tabId
          })
      },
      {
        label: 'Duplicate',
        click: () => this.duplicateTab(tabId)
      },
      { type: 'separator' },
      {
        label: 'Refresh',
        click: () => this.reload(tabId)
      },
      {
        label: isMuted ? 'Unmute this tab' : 'Mute this tab',
        click: () => this.toggleMuteTab(tabId)
      }
    ])

    menu.popup({ window: this.window })
  }

  reorderTab(fromId: string, toId: string, position: 'before' | 'after'): void {
    if (fromId === toId) return
    if (!this.tabs.has(fromId) || !this.tabs.has(toId)) return

    const ordered = [...this.tabs.entries()]
    const fromIndex = ordered.findIndex(([tabId]) => tabId === fromId)
    if (fromIndex < 0) return

    const [moved] = ordered.splice(fromIndex, 1)
    let toIndex = ordered.findIndex(([tabId]) => tabId === toId)
    if (toIndex < 0) return

    if (position === 'after') toIndex += 1
    ordered.splice(toIndex, 0, moved)

    this.tabs = new Map(ordered)
    this.emitTabs()
  }

  beginSplitDrag(tabId: string): void {
    if (!this.tabs.has(tabId)) return
    if (tabId === this.activeTabId) return
    this.chromeExpanded = true
    this.setPageViewsHidden(true)
    this.layoutChrome()
  }

  endSplitDrag(): void {
    this.chromeExpanded = false
    this.setPageViewsHidden(false)
    this.layoutViews()
  }

  setAppMenuOpen(open: boolean): void {
    if (this.appMenuOpen === open) return
    this.appMenuOpen = open
    this.layoutChrome()
  }

  setAiSidebarOpen(open: boolean): void {
    if (this.aiSidebarOpen === open) return
    this.aiSidebarOpen = open
    if (open) {
      const view = this.ensureAiSidebarView()
      // Warm the resize overlay so the first drag does not race page load.
      this.ensureAiResizeOverlay()
      this.layoutViews()
      this.broadcastAiSidebarWidth()
      if (!view.webContents.isDestroyed()) {
        view.webContents.focus()
      }
    } else {
      this.isResizingAiSidebar = false
      if (this.aiSidebarView && !this.aiSidebarView.webContents.isDestroyed()) {
        this.aiSidebarView.setVisible(false)
      }
      this.hideAiResizeOverlay()
      this.layoutViews()
      this.getActiveTab()?.view.webContents.focus()
    }
    this.broadcastAiSidebarOpen()
  }

  private broadcastAiSidebarOpen(): void {
    if (this.chromeView.webContents.isDestroyed()) return
    this.chromeView.webContents.send(IpcChannels.AI_SIDEBAR_OPEN_CHANGED, this.aiSidebarOpen)
  }

  getAiSidebarWidth(): number {
    return this.aiSidebarWidth
  }

  startAiSidebarResize(): void {
    if (!this.aiSidebarOpen || this.isResizingAiSidebar) return
    this.isResizingAiSidebar = true
    this.layoutViews()
    const overlay = this.aiResizeOverlay
    if (overlay && !overlay.webContents.isDestroyed()) {
      overlay.webContents.focus()
    }
  }

  moveAiSidebarResize(screenX: number): void {
    if (!this.aiSidebarOpen || !this.isResizingAiSidebar) return
    if (typeof screenX !== 'number' || !Number.isFinite(screenX)) return

    const [width] = this.window.getContentSize()
    const contentBounds = this.window.getContentBounds()
    const clientX = Math.round(screenX - contentBounds.x)
    const minPage = 200
    const maxSidebar = Math.min(AI_SIDEBAR_MAX_WIDTH, Math.max(width - minPage, AI_SIDEBAR_MIN_WIDTH))
    const next = Math.min(Math.max(width - clientX, AI_SIDEBAR_MIN_WIDTH), maxSidebar)
    if (next === this.aiSidebarWidth) return
    this.aiSidebarWidth = next
    // Avoid full layoutViews() here — re-parenting views mid-drag drops events.
    this.layoutAiResizeDrag()
    this.broadcastAiSidebarWidth()
  }

  endAiSidebarResize(): void {
    if (!this.isResizingAiSidebar) return
    this.isResizingAiSidebar = false
    this.layoutViews()
    this.broadcastAiSidebarWidth()
  }

  private broadcastAiSidebarWidth(): void {
    if (!this.aiSidebarView || this.aiSidebarView.webContents.isDestroyed()) return
    this.aiSidebarView.webContents.send(IpcChannels.AI_SIDEBAR_WIDTH_CHANGED, this.aiSidebarWidth)
  }

  setFindOpen(open: boolean): void {
    if (this.findOpen === open) return
    this.findOpen = open
    if (!open) {
      this.findQuery = ''
      this.stopFindInPage()
    }
    this.layoutChrome()
  }

  setTabSearchOpen(open: boolean): void {
    if (this.tabSearchOpen === open) return
    this.tabSearchOpen = open
    this.layoutChrome()
    if (!open) {
      this.getActiveTab()?.view.webContents.focus()
    }
  }

  getClosedTabs(): ClosedTabInfo[] {
    return this.closedTabs.map((tab) => ({ ...tab }))
  }

  reopenClosedTab(index: number): void {
    if (index < 0 || index >= this.closedTabs.length) return
    const [closed] = this.closedTabs.splice(index, 1)
    if (!closed) return
    this.emitClosedTabs()
    this.createTab(closed.url || DEFAULT_URL, {
      title: closed.title,
      favicon: closed.favicon
    })
    if (this.tabSearchOpen) this.closeTabSearch()
  }

  findInPage(query: string): void {
    const tab = this.getActiveTab()
    if (!tab || tab.view.webContents.isDestroyed()) return

    this.findQuery = query
    if (!query) {
      tab.view.webContents.stopFindInPage('clearSelection')
      this.emitFindResult({ activeMatchOrdinal: 0, matches: 0, finalUpdate: true })
      return
    }

    tab.view.webContents.findInPage(query)
  }

  findNext(): void {
    this.findStep(true)
  }

  findPrevious(): void {
    this.findStep(false)
  }

  stopFindInPage(): void {
    for (const tab of this.tabs.values()) {
      if (tab.view.webContents.isDestroyed()) continue
      tab.view.webContents.stopFindInPage('clearSelection')
    }
    this.emitFindResult({ activeMatchOrdinal: 0, matches: 0, finalUpdate: true })
  }

  enterSplit(tabId: string, side: SplitSide): void {
    const currentId = this.activeTabId
    if (!currentId || tabId === currentId) return
    if (!this.tabs.has(tabId) || !this.tabs.has(currentId)) return

    this.split =
      side === 'left'
        ? { leftId: tabId, rightId: currentId }
        : { leftId: currentId, rightId: tabId }

    this.splitRatio = 0.5
    this.isResizingSplit = false
    this.chromeExpanded = false
    this.activeTabId = tabId
    this.pageViewsHidden = false
    this.layoutViews()
    this.emitTabs()
    this.emitNav()
    this.syncScreenTime()
    this.tabs.get(tabId)?.view.webContents.focus()
  }

  goBack(): void {
    const tab = this.getActiveTab()
    if (tab?.view.webContents.navigationHistory.canGoBack()) {
      tab.view.webContents.navigationHistory.goBack()
    }
  }

  goForward(): void {
    const tab = this.getActiveTab()
    if (tab?.view.webContents.navigationHistory.canGoForward()) {
      tab.view.webContents.navigationHistory.goForward()
    }
  }

  reload(id?: string): void {
    const tab = id ? this.tabs.get(id) : this.getActiveTab()
    if (!tab || tab.view.webContents.isDestroyed()) return

    if (tab.errorUrl) {
      const retryUrl = tab.errorUrl
      tab.errorUrl = null
      void tab.view.webContents.loadURL(retryUrl)
      return
    }

    tab.view.webContents.reload()
  }

  printPage(): void {
    const tab = this.getActiveTab()
    if (!tab || tab.view.webContents.isDestroyed()) return
    tab.view.webContents.print({})
  }

  async captureActivePageForAi(includeScreenshot = true): Promise<{
    title: string
    url: string
    imageBase64: string | null
    mediaType: 'image/jpeg'
    pageText: string | null
    selectionText: string | null
  } | null> {
    const tab = this.getActiveTab()
    if (!tab || tab.view.webContents.isDestroyed()) return null

    const url = tab.url || ''
    const title = tab.title || ''
    const shownUrl = displayUrl(url) || url
    const canCapture = shouldCapturePageForAi(url)

    let pageText: string | null = null
    let selectionText: string | null = null
    if (canCapture) {
      try {
        const extracted = (await tab.view.webContents.executeJavaScript(
          `(() => {
            const normalize = (value) =>
              String(value || '')
                .replace(/\\u00a0/g, ' ')
                .replace(/[ \\t]+\\n/g, '\\n')
                .replace(/\\n{3,}/g, '\\n\\n')
                .replace(/[ \\t]{2,}/g, ' ')
                .trim();
            const selection = normalize(window.getSelection && window.getSelection().toString());
            const root =
              document.querySelector('article') ||
              document.querySelector('main') ||
              document.querySelector('[role="main"]') ||
              document.body;
            const page = normalize(root && root.innerText ? root.innerText : '');
            const max = 12000;
            return {
              selection: selection ? selection.slice(0, max) : '',
              pageText: page ? page.slice(0, max) : ''
            };
          })()`,
          true
        )) as { selection?: string; pageText?: string } | null

        selectionText =
          typeof extracted?.selection === 'string' && extracted.selection.trim()
            ? extracted.selection.trim()
            : null
        pageText =
          typeof extracted?.pageText === 'string' && extracted.pageText.trim()
            ? extracted.pageText.trim()
            : null
      } catch {
        pageText = null
        selectionText = null
      }
    }

    let imageBase64: string | null = null
    if (includeScreenshot && canCapture) {
      try {
        let image = await tab.view.webContents.capturePage()
        if (!image.isEmpty()) {
          const size = image.getSize()
          const maxWidth = 1280
          if (size.width > maxWidth && size.width > 0) {
            const height = Math.max(1, Math.round((size.height * maxWidth) / size.width))
            image = image.resize({ width: maxWidth, height, quality: 'better' })
          }
          imageBase64 = image.toJPEG(70).toString('base64')
        }
      } catch {
        imageBase64 = null
      }
    }

    return {
      title,
      url: shownUrl,
      imageBase64,
      mediaType: 'image/jpeg',
      pageText,
      selectionText
    }
  }

  isPictureInPictureActive(): boolean {
    return this.pictureInPictureActive
  }

  setPictureInPictureActive(active: boolean): void {
    // Ignore leave events fired mid-toggle (exit-then-enter).
    if (this.pipToggleInFlight && !active) return
    this.pictureInPictureActive = active
  }

  async togglePictureInPicture(
    options: {
      x?: number
      y?: number
      srcURL?: string
      webContents?: WebContents
    } = {}
  ): Promise<void> {
    const contents =
      options.webContents && !options.webContents.isDestroyed()
        ? options.webContents
        : this.getActiveTab()?.view.webContents

    if (!contents || contents.isDestroyed()) return

    const target = {
      x: typeof options.x === 'number' ? options.x : null,
      y: typeof options.y === 'number' ? options.y : null,
      srcURL: typeof options.srcURL === 'string' && options.srcURL ? options.srcURL : null
    }

    const script = `(() => {
      const target = ${JSON.stringify(target)};

      const collectVideos = (root, out) => {
        for (const video of root.querySelectorAll('video')) out.push(video);
        for (const el of root.querySelectorAll('*')) {
          if (el.shadowRoot) collectVideos(el.shadowRoot, out);
        }
      };

      const videos = [];
      collectVideos(document, videos);

      const pickTargeted = () => {
        if (target.x != null && target.y != null) {
          let node = document.elementFromPoint(target.x, target.y);
          while (node) {
            if (node instanceof HTMLVideoElement) return node;
            node = node.parentElement;
          }
        }
        if (target.srcURL) {
          const match = videos.find(
            (v) => v.currentSrc === target.srcURL || v.src === target.srcURL
          );
          if (match) return match;
        }
        return null;
      };

      const pickUntargeted = () => {
        const playing = videos.find((v) => !v.paused && v.readyState >= 2);
        if (playing) return playing;
        let best = null;
        let bestArea = 0;
        for (const v of videos) {
          if (v.readyState < 2) continue;
          const area = (v.clientWidth || 0) * (v.clientHeight || 0);
          if (area >= bestArea) {
            best = v;
            bestArea = area;
          }
        }
        return best || videos[0] || null;
      };

      const video = pickTargeted() || pickUntargeted();
      if (!video) return { ok: false, reason: 'no-video' };
      if (!document.pictureInPictureEnabled) return { ok: false, reason: 'disabled' };

      if (document.pictureInPictureElement === video) {
        return document.exitPictureInPicture().then(() => ({ ok: true, action: 'exit' }));
      }
      if (document.pictureInPictureElement) {
        return document
          .exitPictureInPicture()
          .then(() => video.requestPictureInPicture())
          .then(() => ({ ok: true, action: 'enter' }));
      }
      return video.requestPictureInPicture().then(() => ({ ok: true, action: 'enter' }));
    })()`

    this.pipToggleInFlight = true
    try {
      const result = (await contents.executeJavaScript(script, true)) as {
        ok?: boolean
        action?: string
      } | null

      if (result?.ok && result.action === 'enter') {
        this.pictureInPictureActive = true
      } else if (result?.ok && result.action === 'exit') {
        this.pictureInPictureActive = false
      }
    } catch {
      // Sites may block PiP or lack a usable <video>; fail quietly.
    } finally {
      this.pipToggleInFlight = false
    }
  }

  private attachKeyboardShortcuts(webContents: WebContents): void {
    webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return

      const key = input.key.toLowerCase()
      const mod = input.control || input.meta

      if (key === 'escape' && this.tabSearchOpen) {
        event.preventDefault()
        this.closeTabSearch()
        return
      }

      if (key === 'escape' && this.findOpen) {
        event.preventDefault()
        this.closeFind()
        return
      }

      if (!mod || input.alt) return

      if (key === 'e' && !input.shift) {
        event.preventDefault()
        if (this.tabSearchOpen) this.closeTabSearch()
        else this.openTabSearch()
        return
      }

      if (key === 'f' && !input.shift) {
        event.preventDefault()
        this.openFind()
        return
      }

      if (key === 'p') {
        event.preventDefault()
        if (input.shift) void this.togglePictureInPicture()
        else this.printPage()
        return
      }

      if (key === 'g') {
        event.preventDefault()
        if (input.shift) this.findPrevious()
        else this.findNext()
        return
      }

      if (key === 'n') {
        event.preventDefault()
        if (input.shift) this.createTab(DEFAULT_URL, { isIncognito: true })
        else this.createTab()
        return
      }

      if (input.shift) return

      if (key === 'r') {
        event.preventDefault()
        this.reload()
      }
    })
  }

  private openFind(): void {
    if (this.chromeView.webContents.isDestroyed()) return
    if (this.tabSearchOpen) this.closeTabSearch()
    this.findOpen = true
    this.layoutChrome()
    this.chromeView.webContents.focus()
    this.chromeView.webContents.send(IpcChannels.FIND_OPEN, true)
    setTimeout(() => {
      if (!this.chromeView.webContents.isDestroyed()) {
        this.chromeView.webContents.focus()
      }
    }, 50)
  }

  private closeFind(): void {
    if (!this.findOpen) return
    this.findOpen = false
    this.findQuery = ''
    this.stopFindInPage()
    this.layoutChrome()
    if (!this.chromeView.webContents.isDestroyed()) {
      this.chromeView.webContents.send(IpcChannels.FIND_OPEN, false)
    }
    this.getActiveTab()?.view.webContents.focus()
  }

  private openTabSearch(): void {
    if (this.chromeView.webContents.isDestroyed()) return
    if (this.findOpen) this.closeFind()
    this.tabSearchOpen = true
    this.layoutChrome()
    this.chromeView.webContents.focus()
    this.chromeView.webContents.send(IpcChannels.TAB_SEARCH_OPEN, true)
    setTimeout(() => {
      if (!this.chromeView.webContents.isDestroyed()) {
        this.chromeView.webContents.focus()
      }
    }, 50)
  }

  private closeTabSearch(): void {
    if (!this.tabSearchOpen) return
    this.tabSearchOpen = false
    this.layoutChrome()
    if (!this.chromeView.webContents.isDestroyed()) {
      this.chromeView.webContents.send(IpcChannels.TAB_SEARCH_OPEN, false)
    }
    this.getActiveTab()?.view.webContents.focus()
  }

  private findStep(forward: boolean): void {
    const tab = this.getActiveTab()
    if (!tab || tab.view.webContents.isDestroyed()) return
    if (!this.findQuery) {
      this.openFind()
      return
    }

    tab.view.webContents.findInPage(this.findQuery, {
      forward,
      findNext: true
    })
  }

  private emitFindResult(result: FindResult): void {
    if (this.chromeView.webContents.isDestroyed()) return
    this.chromeView.webContents.send(IpcChannels.FIND_RESULT, result)
  }

  navigate(rawUrl: string): void {
    const tab = this.getActiveTab()
    if (!tab) return

    tab.errorUrl = null
    const url = normalizeUrl(rawUrl)
    void tab.view.webContents.loadURL(url)
  }

  getTabInfos(): TabInfo[] {
    return [...this.tabs.values()].map((tab) => ({
      id: tab.id,
      title: tab.title,
      url: displayUrl(tab.url),
      favicon: tab.favicon,
      active: tab.id === this.activeTabId,
      splitSide: this.getSplitSide(tab.id),
      lastAccessed: tab.lastAccessed,
      isIncognito: tab.isIncognito,
      isMuted: !tab.view.webContents.isDestroyed() && tab.view.webContents.isAudioMuted()
    }))
  }

  isChromeWebContents(webContents: WebContents): boolean {
    return (
      !this.chromeView.webContents.isDestroyed() &&
      this.chromeView.webContents.id === webContents.id
    )
  }

  beginExternalLinkDrag(url: string, isIncognito: boolean): void {
    const trimmed = url.trim()
    if (!trimmed) return
    this.externalLinkDrag = { url: trimmed, isIncognito, handled: false }
  }

  markExternalLinkDragHandled(): void {
    if (this.externalLinkDrag) {
      this.externalLinkDrag.handled = true
    }
  }

  finishExternalLinkDragAt(screenX: number, screenY: number): void {
    const drag = this.externalLinkDrag
    this.externalLinkDrag = null
    if (!drag || drag.handled) return
    if (!this.isScreenPointInTabStrip(screenX, screenY)) return
    this.openLinkInNewTab(drag.url, { isIncognito: drag.isIncognito })
  }

  openLinkInNewTab(
    rawUrl: string,
    options: { isIncognito?: boolean; placement?: { tabId: string; position: 'before' | 'after' } }
  ): void {
    const url = normalizeUrl(rawUrl)
    if (!url || url === DEFAULT_URL) return
    this.createTab(url, {
      isIncognito: options.isIncognito === true,
      placement: options.placement
    })
  }

  private isScreenPointInTabStrip(screenX: number, screenY: number): boolean {
    if (this.window.isDestroyed()) return false
    const bounds = this.window.getContentBounds()
    const localX = screenX - bounds.x
    const localY = screenY - bounds.y
    return (
      localX >= 0 &&
      localX <= bounds.width &&
      localY >= 0 &&
      localY <= TAB_ROW_HEIGHT
    )
  }

  getPageWebContents(): WebContents[] {
    const contents: WebContents[] = []
    for (const tab of Array.from(this.tabs.values())) {
      if (!tab.view.webContents.isDestroyed()) {
        contents.push(tab.view.webContents)
      }
    }
    return contents
  }

  getNavState(): NavState {
    const tab = this.getActiveTab()
    if (!tab) {
      return { url: '', canGoBack: false, canGoForward: false }
    }

    const { webContents } = tab.view
    const url = tab.errorUrl || webContents.getURL() || tab.url
    return {
      url: displayUrl(isErrorInterstitialUrl(url) ? tab.url : url),
      canGoBack: webContents.navigationHistory.canGoBack(),
      canGoForward: webContents.navigationHistory.canGoForward()
    }
  }

  private createSplitterView(): WebContentsView {
    const view = new WebContentsView({
      webPreferences: {
        preload: join(__dirname, '../preload/splitter.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })

    // Transparent so pane resizes stay visible under the full-width drag overlay.
    view.setBackgroundColor('#00000000')
    view.setBounds({ x: 0, y: this.chromeHeight(), width: SPLIT_GAP, height: 0 })
    view.setVisible(false)

    void view.webContents.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(SPLITTER_PAGE_HTML)}`
    )

    return view
  }

  private aiPanelUrl(): string {
    const base = this.chromeView.webContents.getURL()
    try {
      const url = new URL(base)
      url.searchParams.set('panel', 'ai')
      url.hash = ''
      return url.toString()
    } catch {
      const joinChar = base.includes('?') ? '&' : '?'
      return `${base}${joinChar}panel=ai`
    }
  }

  private createAiSidebarView(): WebContentsView {
    const view = new WebContentsView({
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })
    view.setBackgroundColor('#ffffffff')
    view.setBounds({ x: 0, y: this.chromeHeight(), width: 0, height: 0 })
    view.setVisible(false)
    void view.webContents.loadURL(this.aiPanelUrl())
    return view
  }

  private ensureAiSidebarView(): WebContentsView {
    if (!this.aiSidebarView || this.aiSidebarView.webContents.isDestroyed()) {
      this.aiSidebarView = this.createAiSidebarView()
    }

    const attached = this.window.contentView.children.includes(this.aiSidebarView)
    if (!attached) {
      this.window.contentView.addChildView(this.aiSidebarView)
    }

    return this.aiSidebarView
  }

  private layoutAiSidebar(pageWidth: number, contentHeight: number, windowWidth: number): void {
    if (!this.aiSidebarOpen) {
      if (this.aiSidebarView && !this.aiSidebarView.webContents.isDestroyed()) {
        this.aiSidebarView.setVisible(false)
      }
      this.hideAiResizeOverlay()
      return
    }

    const view = this.ensureAiSidebarView()
    const sidebarWidth = Math.max(windowWidth - pageWidth, 0)
    view.setBackgroundColor('#ffffffff')
    view.setVisible(true)
    // Keep the sidebar view right-aligned always — never expand it leftward
    // during drag (that caused a one-frame flash of the panel on the left).
    view.setBounds({
      x: pageWidth,
      y: this.chromeHeight(),
      width: sidebarWidth,
      height: contentHeight
    })
    this.window.contentView.addChildView(view)

    if (this.isResizingAiSidebar) {
      const overlay = this.ensureAiResizeOverlay()
      overlay.setVisible(true)
      overlay.setBounds({
        x: 0,
        y: this.chromeHeight(),
        width: windowWidth,
        height: contentHeight
      })
      this.window.contentView.addChildView(overlay)
    } else {
      this.hideAiResizeOverlay()
    }
  }

  private createAiResizeOverlay(): WebContentsView {
    const view = new WebContentsView({
      webPreferences: {
        preload: join(__dirname, '../preload/ai-resize.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })
    view.setBackgroundColor('#00000000')
    view.setBounds({ x: 0, y: this.chromeHeight(), width: 0, height: 0 })
    view.setVisible(false)
    void view.webContents.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(AI_RESIZE_OVERLAY_HTML)}`
    )
    return view
  }

  private ensureAiResizeOverlay(): WebContentsView {
    if (!this.aiResizeOverlay || this.aiResizeOverlay.webContents.isDestroyed()) {
      this.aiResizeOverlay = this.createAiResizeOverlay()
    }
    const attached = this.window.contentView.children.includes(this.aiResizeOverlay)
    if (!attached) {
      this.window.contentView.addChildView(this.aiResizeOverlay)
    }
    return this.aiResizeOverlay
  }

  private hideAiResizeOverlay(): void {
    if (!this.aiResizeOverlay || this.aiResizeOverlay.webContents.isDestroyed()) return
    this.aiResizeOverlay.setVisible(false)
    this.aiResizeOverlay.setBounds({ x: 0, y: this.chromeHeight(), width: 0, height: 0 })
  }

  /** Update page + sidebar bounds mid-drag without re-stacking the overlay. */
  private layoutAiResizeDrag(): void {
    if (this.window.isDestroyed() || !this.aiSidebarOpen) return

    const [width, height] = this.window.getContentSize()
    const contentHeight = Math.max(height - this.chromeHeight(), 0)
    const pageWidth = this.pageContentWidth(width)
    const chromeY = this.chromeHeight()

    if (this.split) {
      const left = this.tabs.get(this.split.leftId)
      const right = this.tabs.get(this.split.rightId)
      if (left && right) {
        const available = Math.max(pageWidth - SPLIT_GAP, 0)
        const minWidth = Math.min(
          Math.max(200, Math.round(pageWidth * 0.2)),
          Math.floor(available / 2)
        )
        const leftWidth = Math.min(
          Math.max(Math.round(this.splitRatio * available), minWidth),
          available - minWidth
        )
        this.splitRatio = available > 0 ? leftWidth / available : 0.5
        left.view.setBounds({
          x: 0,
          y: chromeY,
          width: leftWidth,
          height: contentHeight
        })
        right.view.setBounds({
          x: leftWidth + SPLIT_GAP,
          y: chromeY,
          width: Math.max(pageWidth - leftWidth - SPLIT_GAP, 0),
          height: contentHeight
        })
        if (this.splitterView && !this.splitterView.webContents.isDestroyed() && !this.isResizingSplit) {
          this.splitterView.setBounds({
            x: leftWidth,
            y: chromeY,
            width: SPLIT_GAP,
            height: contentHeight
          })
        }
      }
    } else {
      const active = this.getActiveTab()
      if (active) {
        active.view.setBounds({
          x: 0,
          y: chromeY,
          width: pageWidth,
          height: contentHeight
        })
      }
    }

    if (this.aiSidebarView && !this.aiSidebarView.webContents.isDestroyed()) {
      this.aiSidebarView.setBounds({
        x: pageWidth,
        y: chromeY,
        width: Math.max(width - pageWidth, 0),
        height: contentHeight
      })
    }
  }

  private ensureSplitter(): WebContentsView {
    if (!this.splitterView) {
      this.splitterView = this.createSplitterView()
    }

    const attached = this.window.contentView.children.includes(this.splitterView)
    if (!attached) {
      this.window.contentView.addChildView(this.splitterView)
    }

    return this.splitterView
  }

  private syncSplitterBar(): void {
    if (!this.splitterView || this.splitterView.webContents.isDestroyed()) return

    const [width] = this.window.getContentSize()
    const available = Math.max(width - SPLIT_GAP, 0)
    const leftWidth = Math.round(this.splitRatio * available)

    void this.splitterView.webContents
      .executeJavaScript(
        `(() => { const bar = document.querySelector('.bar'); if (bar) bar.style.left = '${leftWidth}px'; })()`,
        true
      )
      .catch(() => {})
  }

  private detachSplitter(): void {
    this.isResizingSplit = false
    if (!this.splitterView) return

    this.splitterView.setVisible(false)
    this.splitterView.setBounds({ x: 0, y: this.chromeHeight(), width: 0, height: 0 })

    if (this.window.contentView.children.includes(this.splitterView)) {
      this.window.contentView.removeChildView(this.splitterView)
    }
  }

  private getSplitSide(id: string): SplitSide | null {
    if (!this.split) return null
    if (this.split.leftId === id) return 'left'
    if (this.split.rightId === id) return 'right'
    return null
  }

  private getActiveTab(): Tab | undefined {
    if (!this.activeTabId) return undefined
    return this.tabs.get(this.activeTabId)
  }

  private pageContentWidth(windowWidth: number): number {
    if (!this.aiSidebarOpen) return windowWidth
    const sidebar = Math.min(
      Math.max(this.aiSidebarWidth, AI_SIDEBAR_MIN_WIDTH),
      AI_SIDEBAR_MAX_WIDTH,
      Math.max(windowWidth - 200, AI_SIDEBAR_MIN_WIDTH)
    )
    this.aiSidebarWidth = sidebar
    return Math.max(windowWidth - sidebar, 200)
  }

  private layoutChrome(): void {
    if (this.window.isDestroyed() || this.chromeView.webContents.isDestroyed()) return

    const [width, height] = this.window.getContentSize()
    const chromeHeight = this.chromeExpanded
      ? height
      : this.appMenuOpen
        ? this.chromeHeight() + APP_MENU_OVERLAY
        : this.tabSearchOpen
          ? this.chromeHeight() + TAB_SEARCH_OVERLAY
          : this.findOpen
            ? this.chromeHeight() + FIND_BAR_OVERLAY
            : this.chromeHeight()

    this.chromeView.setBounds({
      x: 0,
      y: 0,
      width,
      height: chromeHeight
    })
    this.window.contentView.addChildView(this.chromeView)
  }

  private setPageViewsHidden(hidden: boolean): void {
    this.pageViewsHidden = hidden
    if (hidden) {
      for (const tab of this.tabs.values()) {
        tab.view.setVisible(false)
      }
      this.splitterView?.setVisible(false)
      return
    }
    this.layoutViews()
  }

  private layoutViews(): void {
    if (this.window.isDestroyed()) return

    const [width, height] = this.window.getContentSize()
    const contentHeight = Math.max(height - this.chromeHeight(), 0)
    const pageWidth = this.pageContentWidth(width)

    this.layoutChrome()

    if (this.pageViewsHidden) {
      for (const tab of this.tabs.values()) {
        tab.view.setVisible(false)
      }
      this.splitterView?.setVisible(false)
      if (this.aiSidebarView && !this.aiSidebarView.webContents.isDestroyed()) {
        this.aiSidebarView.setVisible(false)
      }
      this.hideAiResizeOverlay()
      this.layoutChrome()
      return
    }

    if (this.split) {
      const left = this.tabs.get(this.split.leftId)
      const right = this.tabs.get(this.split.rightId)

      if (!left || !right) {
        this.split = null
        this.detachSplitter()
        this.layoutViews()
        return
      }

      const available = Math.max(pageWidth - SPLIT_GAP, 0)
      const minWidth = Math.min(
        Math.max(200, Math.round(pageWidth * 0.2)),
        Math.floor(available / 2)
      )
      const leftWidth = Math.min(
        Math.max(Math.round(this.splitRatio * available), minWidth),
        available - minWidth
      )
      this.splitRatio = available > 0 ? leftWidth / available : 0.5

      for (const [tabId, tab] of this.tabs) {
        const visible = tabId === this.split.leftId || tabId === this.split.rightId
        tab.view.setVisible(visible)
      }

      left.view.setBounds({
        x: 0,
        y: this.chromeHeight(),
        width: leftWidth,
        height: contentHeight
      })
      right.view.setBounds({
        x: leftWidth + SPLIT_GAP,
        y: this.chromeHeight(),
        width: Math.max(pageWidth - leftWidth - SPLIT_GAP, 0),
        height: contentHeight
      })

      const splitter = this.ensureSplitter()
      splitter.setVisible(true)

      if (this.isResizingSplit) {
        splitter.setBounds({
          x: 0,
          y: this.chromeHeight(),
          width: pageWidth,
          height: contentHeight
        })
      } else {
        splitter.setBounds({
          x: leftWidth,
          y: this.chromeHeight(),
          width: SPLIT_GAP,
          height: contentHeight
        })
      }

      this.window.contentView.addChildView(splitter)
      this.layoutAiSidebar(pageWidth, contentHeight, width)
      this.layoutChrome()
      return
    }

    this.detachSplitter()

    const active = this.getActiveTab()
    for (const [tabId, tab] of this.tabs) {
      tab.view.setVisible(tabId === this.activeTabId)
    }

    if (active) {
      active.view.setBounds({
        x: 0,
        y: this.chromeHeight(),
        width: pageWidth,
        height: contentHeight
      })
    }

    this.layoutAiSidebar(pageWidth, contentHeight, width)
    this.layoutChrome()
  }

  private emitTabs(): void {
    this.onTabsChanged(this.getTabInfos())
    if (!this.restoring) this.persistSession()
  }

  private emitClosedTabs(): void {
    this.onClosedTabsChanged(this.getClosedTabs())
  }

  private pushClosedTab(tab: Tab): void {
    if (tab.isIncognito) return
    const url = tab.errorUrl || tab.url
    if (isBlankUrl(url) || isErrorInterstitialUrl(url)) return

    this.closedTabs.unshift({
      url,
      title: tab.title || 'New Tab',
      favicon: tab.favicon,
      closedAt: Date.now()
    })
    if (this.closedTabs.length > MAX_CLOSED_TABS) {
      this.closedTabs.length = MAX_CLOSED_TABS
    }
    this.emitClosedTabs()
  }

  private emitNav(): void {
    this.onNavChanged(this.getNavState())
  }

  private focusOmnibox(): void {
    if (this.chromeView.webContents.isDestroyed()) return
    this.chromeView.webContents.focus()
    setTimeout(() => {
      if (!this.chromeView.webContents.isDestroyed()) {
        this.chromeView.webContents.focus()
        this.chromeView.webContents.send(IpcChannels.FOCUS_OMNIBOX)
      }
    }, 50)
  }
}

const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/

/** Host portion of a schemeless address bar input (strips path/query/hash/port). */
function hostFromSchemelessInput(input: string): string {
  const withoutPath = input.split(/[/?#]/, 1)[0] ?? input
  if (withoutPath.startsWith('[')) {
    const end = withoutPath.indexOf(']')
    return end === -1 ? withoutPath : withoutPath.slice(1, end)
  }
  const colon = withoutPath.lastIndexOf(':')
  if (colon !== -1 && /^\d+$/.test(withoutPath.slice(colon + 1))) {
    return withoutPath.slice(0, colon)
  }
  return withoutPath
}

function looksLikeUrl(input: string): boolean {
  if (input.includes(' ') || !input.includes('.')) return false

  const host = hostFromSchemelessInput(input)
  if (!host || host.includes(' ')) return false
  if (IPV4_RE.test(host)) return true

  const labels = host.split('.')
  if (labels.length < 2 || labels.some((label) => !label)) return false

  const tld = labels[labels.length - 1]!
  return isValidTld(tld)
}

export function normalizeUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return DEFAULT_URL

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return trimmed
  }

  if (!looksLikeUrl(trimmed)) {
    return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`
  }

  return `https://${trimmed}`
}
