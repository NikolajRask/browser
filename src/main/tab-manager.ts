import { join } from 'path'
import { WebContentsView, type BaseWindow, type WebContents } from 'electron'
import { randomUUID } from 'crypto'
import {
  CHROME_HEIGHT,
  APP_MENU_OVERLAY,
  FIND_BAR_OVERLAY,
  IpcChannels,
  SPLIT_GAP,
  type FindResult,
  type NavState,
  type SplitSide,
  type TabInfo
} from '../shared/ipc'
import { attachPageContextMenu } from './page-context-menu'
import { SPLITTER_PAGE_HTML } from './splitter-page'
import { HistoryStore, shouldRecordHistoryUrl } from './history-store'

const DEFAULT_URL = 'about:blank'
const PAGE_PRELOAD = join(__dirname, '../preload/page.js')

function displayUrl(url: string): string {
  return !url || url === 'about:blank' ? '' : url
}

function isBlankUrl(url: string): boolean {
  return !url || url === 'about:blank'
}

function lockinPageTitle(url: string): string {
  try {
    const hostname = new URL(url).hostname
    if (hostname === 'history') return 'History'
    if (hostname === 'downloads') return 'Downloads'
  } catch {
    // Fall through.
  }
  return 'Lockin'
}

type Tab = {
  id: string
  title: string
  url: string
  favicon: string | null
  view: WebContentsView
}

type SplitState = {
  leftId: string
  rightId: string
}

export class TabManager {
  private window: BaseWindow
  private chromeView: WebContentsView
  private history: HistoryStore
  private tabs = new Map<string, Tab>()
  private activeTabId: string | null = null
  private split: SplitState | null = null
  private splitRatio = 0.5
  private isResizingSplit = false
  private pageViewsHidden = false
  private chromeExpanded = false
  private appMenuOpen = false
  private findOpen = false
  private findQuery = ''
  private splitterView: WebContentsView | null = null
  private onTabsChanged: (tabs: TabInfo[]) => void
  private onNavChanged: (state: NavState) => void

  constructor(
    window: BaseWindow,
    chromeView: WebContentsView,
    history: HistoryStore,
    handlers: {
      onTabsChanged: (tabs: TabInfo[]) => void
      onNavChanged: (state: NavState) => void
    }
  ) {
    this.window = window
    this.chromeView = chromeView
    this.history = history
    this.onTabsChanged = handlers.onTabsChanged
    this.onNavChanged = handlers.onNavChanged
    this.attachKeyboardShortcuts(chromeView.webContents)
  }

  relayout(): void {
    this.layoutViews()
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
    const contentHeight = Math.max(height - CHROME_HEIGHT, 0)
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
      y: CHROME_HEIGHT,
      width: leftWidth,
      height: contentHeight
    })
    right.view.setBounds({
      x: leftWidth + SPLIT_GAP,
      y: CHROME_HEIGHT,
      width: Math.max(width - leftWidth - SPLIT_GAP, 0),
      height: contentHeight
    })
  }

  endSplitResize(): void {
    if (!this.isResizingSplit) return
    this.isResizingSplit = false
    this.layoutViews()
  }

  createTab(url = DEFAULT_URL): string {
    const id = randomUUID()
    const view = new WebContentsView({
      webPreferences: {
        preload: PAGE_PRELOAD,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    const tab: Tab = {
      id,
      title: 'New Tab',
      url,
      favicon: null,
      view
    }

    this.tabs.set(id, tab)

    const [width, height] = this.window.getContentSize()
    view.setBounds({
      x: 0,
      y: CHROME_HEIGHT,
      width,
      height: Math.max(height - CHROME_HEIGHT, 0)
    })
    this.window.contentView.addChildView(view)

    const { webContents } = view

    const recordVisit = (navigatedUrl: string): void => {
      if (!shouldRecordHistoryUrl(navigatedUrl)) return
      this.history.add({
        url: navigatedUrl,
        title: isBlankUrl(navigatedUrl) ? navigatedUrl : webContents.getTitle() || tab.title,
        favicon: tab.favicon,
        visitedAt: Date.now()
      })
    }

    webContents.on('page-title-updated', (_event, title) => {
      tab.title = isBlankUrl(webContents.getURL()) ? 'New Tab' : title || 'New Tab'
      this.history.updateMeta(webContents.getURL() || tab.url, { title: tab.title })
      this.emitTabs()
    })

    webContents.on('page-favicon-updated', (_event, favicons) => {
      tab.favicon = favicons.at(-1) ?? favicons[0] ?? null
      this.history.updateMeta(webContents.getURL() || tab.url, { favicon: tab.favicon })
      this.emitTabs()
    })

    webContents.on('did-start-navigation', (_event, _url, isInPlace, isMainFrame) => {
      if (!isMainFrame || isInPlace) return
      tab.favicon = null
      this.emitTabs()
    })

    webContents.on('did-navigate', (_event, navigatedUrl) => {
      tab.url = navigatedUrl
      if (navigatedUrl.startsWith('lockin://')) {
        tab.title = lockinPageTitle(navigatedUrl)
        tab.favicon = null
      }
      recordVisit(navigatedUrl)
      this.emitTabs()
      if (this.activeTabId === id) this.emitNav()
    })

    webContents.on('did-navigate-in-page', (_event, navigatedUrl, isMainFrame) => {
      if (!isMainFrame) return
      tab.url = navigatedUrl
      recordVisit(navigatedUrl)
      this.emitTabs()
      if (this.activeTabId === id) this.emitNav()
    })

    webContents.on('did-finish-load', () => {
      tab.url = webContents.getURL()
      if (tab.url.startsWith('lockin://')) {
        tab.title = lockinPageTitle(tab.url)
      } else {
        tab.title = isBlankUrl(tab.url) ? 'New Tab' : webContents.getTitle() || tab.title
      }
      this.history.updateMeta(tab.url, { title: tab.title, favicon: tab.favicon })
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
      this.createTab(openUrl)
      return { action: 'deny' }
    })

    attachPageContextMenu(webContents, this.window, {
      openInNewTab: (openUrl) => this.createTab(openUrl),
      goBack: () => this.goBack(),
      goForward: () => this.goForward(),
      reload: () => this.reload()
    })

    this.attachKeyboardShortcuts(webContents)

    void webContents.loadURL(url)
    this.activateTab(id)
    return id
  }

  activateTab(id: string): void {
    const tab = this.tabs.get(id)
    if (!tab) return

    if (this.split && (id === this.split.leftId || id === this.split.rightId)) {
      this.activeTabId = id
      this.layoutViews()
      this.emitTabs()
      this.emitNav()
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

    const splitPartner =
      this.split?.leftId === id
        ? this.split.rightId
        : this.split?.rightId === id
          ? this.split.leftId
          : null

    this.window.contentView.removeChildView(tab.view)
    tab.view.webContents.close()
    this.tabs.delete(id)

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

  setFindOpen(open: boolean): void {
    if (this.findOpen === open) return
    this.findOpen = open
    if (!open) {
      this.findQuery = ''
      this.stopFindInPage()
    }
    this.layoutChrome()
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

  reload(): void {
    this.getActiveTab()?.view.webContents.reload()
  }

  private attachKeyboardShortcuts(webContents: WebContents): void {
    webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return

      const key = input.key.toLowerCase()
      const mod = input.control || input.meta

      if (key === 'escape' && this.findOpen) {
        event.preventDefault()
        this.closeFind()
        return
      }

      if (!mod || input.alt) return

      if (key === 'f' && !input.shift) {
        event.preventDefault()
        this.openFind()
        return
      }

      if (key === 'g') {
        event.preventDefault()
        if (input.shift) this.findPrevious()
        else this.findNext()
        return
      }

      if (input.shift) return

      if (key === 'r') {
        event.preventDefault()
        this.reload()
      } else if (key === 'n') {
        event.preventDefault()
        this.createTab()
      }
    })
  }

  private openFind(): void {
    if (this.chromeView.webContents.isDestroyed()) return
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
      splitSide: this.getSplitSide(tab.id)
    }))
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
    return {
      url: displayUrl(webContents.getURL() || tab.url),
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
    view.setBounds({ x: 0, y: CHROME_HEIGHT, width: SPLIT_GAP, height: 0 })
    view.setVisible(false)

    void view.webContents.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(SPLITTER_PAGE_HTML)}`
    )

    return view
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
    this.splitterView.setBounds({ x: 0, y: CHROME_HEIGHT, width: 0, height: 0 })

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

  private layoutChrome(): void {
    if (this.window.isDestroyed() || this.chromeView.webContents.isDestroyed()) return

    const [width, height] = this.window.getContentSize()
    const chromeHeight = this.chromeExpanded
      ? height
      : this.appMenuOpen
        ? CHROME_HEIGHT + APP_MENU_OVERLAY
        : this.findOpen
          ? CHROME_HEIGHT + FIND_BAR_OVERLAY
          : CHROME_HEIGHT

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
    const contentHeight = Math.max(height - CHROME_HEIGHT, 0)

    this.layoutChrome()

    if (this.pageViewsHidden) {
      for (const tab of this.tabs.values()) {
        tab.view.setVisible(false)
      }
      this.splitterView?.setVisible(false)
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

      const available = Math.max(width - SPLIT_GAP, 0)
      const minWidth = Math.min(
        Math.max(200, Math.round(width * 0.2)),
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
        y: CHROME_HEIGHT,
        width: leftWidth,
        height: contentHeight
      })
      right.view.setBounds({
        x: leftWidth + SPLIT_GAP,
        y: CHROME_HEIGHT,
        width: Math.max(width - leftWidth - SPLIT_GAP, 0),
        height: contentHeight
      })

      const splitter = this.ensureSplitter()
      splitter.setVisible(true)

      if (this.isResizingSplit) {
        splitter.setBounds({
          x: 0,
          y: CHROME_HEIGHT,
          width,
          height: contentHeight
        })
      } else {
        splitter.setBounds({
          x: leftWidth,
          y: CHROME_HEIGHT,
          width: SPLIT_GAP,
          height: contentHeight
        })
      }

      this.window.contentView.addChildView(splitter)
      this.layoutChrome()
      return
    }

    this.detachSplitter()

    const active = this.getActiveTab()
    for (const [tabId, tab] of this.tabs) {
      tab.view.setVisible(tabId === this.activeTabId)
    }

    if (!active) return

    active.view.setBounds({
      x: 0,
      y: CHROME_HEIGHT,
      width,
      height: contentHeight
    })

    this.layoutChrome()
  }

  private emitTabs(): void {
    this.onTabsChanged(this.getTabInfos())
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

export function normalizeUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return DEFAULT_URL

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return trimmed
  }

  if (trimmed.includes(' ') || !trimmed.includes('.')) {
    return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`
  }

  return `https://${trimmed}`
}
