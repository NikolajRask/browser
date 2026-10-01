import { app, BaseWindow, WebContentsView, shell, protocol, type Session } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { registerIpc, unregisterIpc } from './ipc'
import { TabManager } from './tab-manager'
import { HistoryStore } from './history-store'
import { BookmarkStore } from './bookmark-store'
import { TodoStore } from './todo-store'
import { DownloadsStore } from './downloads-store'
import { DownloadManager } from './download-manager'
import { PasswordStore } from './password-store'
import { PasswordManager } from './password-manager'
import { ApiKeyStore } from './api-key-store'
import { AiChatStore } from './ai-chat-store'
import { SessionStore } from './session-store'
import { ScreenTimeStore } from './screentime-store'
import { ScreenTimeTracker } from './screentime-tracker'
import { HISTORY_PAGE_HTML } from './history-page'
import { DOWNLOADS_PAGE_HTML } from './downloads-page'
import { PASSWORDS_PAGE_HTML } from './passwords-page'
import { SCREENTIME_PAGE_HTML } from './screentime-page'
import { BOOKMARKS_PAGE_HTML } from './bookmarks-page'
import { TODOS_PAGE_HTML } from './todos-page'
import { SETTINGS_PAGE_HTML } from './settings-page'
import { NEWTAB_PAGE_HTML } from './newtab-page'
import { INCOGNITO_NEWTAB_PAGE_HTML } from './incognito-newtab-page'
import {
  configureBrowserSession,
  configureIncognitoSession,
  flushBrowserSession,
  clearIncognitoSession,
  getBrowserSession,
  getIncognitoSession,
  stripElectronFromUserAgent
} from './browser-session'
import { CHROME_HEIGHT, IpcChannels, type BookmarksState, type TodosState } from '../shared/ipc'

// Apply before ready so new WebContents inherit a Chromium-like UA (no Electron token).
app.userAgentFallback = stripElectronFromUserAgent(app.userAgentFallback)
app.setName('Lockin')

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'lockin',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true
    }
  }
])

let mainWindow: BaseWindow | null = null
let chromeView: WebContentsView | null = null
let tabManager: TabManager | null = null
let historyStore: HistoryStore | null = null
let bookmarkStore: BookmarkStore | null = null
let todoStore: TodoStore | null = null
let downloadsStore: DownloadsStore | null = null
let downloadManager: DownloadManager | null = null
let passwordStore: PasswordStore | null = null
let passwordManager: PasswordManager | null = null
let apiKeyStore: ApiKeyStore | null = null
let aiChatStore: AiChatStore | null = null
let sessionStore: SessionStore | null = null
let screenTimeStore: ScreenTimeStore | null = null
let screenTimeTracker: ScreenTimeTracker | null = null

function registerLockinProtocolOnSession(ses: Session, options: { incognito: boolean }): void {
  ses.protocol.handle('lockin', (request) => {
    let hostname = ''
    try {
      hostname = new URL(request.url).hostname
    } catch {
      return new Response('Bad Request', { status: 400, headers: { 'content-type': 'text/plain' } })
    }

    if (hostname === 'history') {
      return new Response(HISTORY_PAGE_HTML, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      })
    }

    if (hostname === 'downloads') {
      return new Response(DOWNLOADS_PAGE_HTML, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      })
    }

    if (hostname === 'passwords') {
      return new Response(PASSWORDS_PAGE_HTML, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      })
    }

    if (hostname === 'screentime') {
      return new Response(SCREENTIME_PAGE_HTML, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      })
    }

    if (hostname === 'bookmarks') {
      return new Response(BOOKMARKS_PAGE_HTML, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      })
    }

    if (hostname === 'todos') {
      return new Response(TODOS_PAGE_HTML, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      })
    }

    if (hostname === 'settings') {
      return new Response(SETTINGS_PAGE_HTML, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      })
    }

    if (hostname === 'newtab') {
      return new Response(options.incognito ? INCOGNITO_NEWTAB_PAGE_HTML : NEWTAB_PAGE_HTML, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      })
    }

    return new Response('Not Found', { status: 404, headers: { 'content-type': 'text/plain' } })
  })
}

function registerLockinProtocol(): void {
  // Prefer session-scoped handlers so Incognito's temp partition can load lockin:// pages.
  // Fall back to the global protocol API if a session rejects a second registration.
  try {
    protocol.unhandle('lockin')
  } catch {
    // Not registered globally yet.
  }

  registerLockinProtocolOnSession(getBrowserSession(), { incognito: false })
  registerLockinProtocolOnSession(getIncognitoSession(), { incognito: true })
}

function createWindow(): void {
  const isMac = process.platform === 'darwin'

  const trafficLightPosition = { x: 14, y: 12 }

  mainWindow = new BaseWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Lockin',
    show: false,
    backgroundColor: '#dee1e6',
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    trafficLightPosition: isMac ? trafficLightPosition : undefined,
    titleBarOverlay: isMac
      ? undefined
      : {
          color: '#dee1e6',
          symbolColor: '#3c4043',
          height: 38
        }
  })

  chromeView = new WebContentsView({
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  chromeView.setBackgroundColor('#00000000')

  const [width] = mainWindow.getContentSize()
  chromeView.setBounds({ x: 0, y: 0, width, height: CHROME_HEIGHT })
  mainWindow.contentView.addChildView(chromeView)

  const isWindowFullScreen = (): boolean => {
    if (!mainWindow || mainWindow.isDestroyed()) return false
    return mainWindow.isFullScreen() || (isMac && mainWindow.isSimpleFullScreen())
  }

  const broadcastFullScreen = (fullScreen: boolean): void => {
    if (!chromeView || chromeView.webContents.isDestroyed()) return
    chromeView.webContents.send(IpcChannels.WINDOW_FULLSCREEN, fullScreen)
  }

  const exitSimpleFullScreen = (): void => {
    if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isSimpleFullScreen()) return
    mainWindow.setSimpleFullScreen(false)
    mainWindow.setWindowButtonVisibility(true)
    mainWindow.setWindowButtonPosition(trafficLightPosition)
    broadcastFullScreen(false)
  }

  const enterSimpleFullScreen = (): void => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.setSimpleFullScreen(true)
    mainWindow.setWindowButtonVisibility(false)
    broadcastFullScreen(true)
  }

  const toggleFullScreen = (): void => {
    if (!mainWindow || mainWindow.isDestroyed()) return

    // Leaving any fullscreen mode.
    if (mainWindow.isSimpleFullScreen()) {
      exitSimpleFullScreen()
      return
    }
    if (mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false)
      return
    }

    // Entering fullscreen: keep PiP visible by filling the screen in-place
    // instead of macOS Space fullscreen when a PiP window is already open.
    if (isMac && tabManager?.isPictureInPictureActive()) {
      enterSimpleFullScreen()
      return
    }

    mainWindow.setFullScreen(true)
  }

  // macOS native fullscreen hides the system traffic lights. Keep the window in
  // native fullscreen (no bounce) and paint HTML controls in the tab strip instead.
  // When PiP is already active, toggleFullScreen uses simple fullscreen instead.
  if (isMac) {
    mainWindow.on('enter-full-screen', () => {
      if (!mainWindow || mainWindow.isDestroyed()) return
      mainWindow.setWindowButtonVisibility(false)
      broadcastFullScreen(true)
    })

    mainWindow.on('leave-full-screen', () => {
      if (!mainWindow || mainWindow.isDestroyed()) return
      if (mainWindow.isSimpleFullScreen()) {
        mainWindow.setWindowButtonVisibility(false)
        broadcastFullScreen(true)
        return
      }
      mainWindow.setWindowButtonVisibility(true)
      mainWindow.setWindowButtonPosition(trafficLightPosition)
      broadcastFullScreen(false)
    })
  } else {
    mainWindow.on('enter-full-screen', () => {
      broadcastFullScreen(true)
    })
    mainWindow.on('leave-full-screen', () => {
      broadcastFullScreen(false)
    })
  }

  historyStore = new HistoryStore()
  bookmarkStore = new BookmarkStore()
  todoStore = new TodoStore()
  downloadsStore = new DownloadsStore()
  passwordStore = new PasswordStore()
  apiKeyStore = new ApiKeyStore()
  aiChatStore = new AiChatStore()
  sessionStore = new SessionStore()
  screenTimeStore = new ScreenTimeStore()
  screenTimeTracker = new ScreenTimeTracker(screenTimeStore, mainWindow)
  screenTimeTracker.start()

  const syncBookmarksBar = (state: BookmarksState): void => {
    const bar = state.nodes[state.barId]
    const visible = Boolean(bar && bar.type === 'folder' && bar.children.length > 0)
    tabManager?.setBookmarksBarVisible(visible)
  }

  const broadcastBookmarks = (state: BookmarksState): void => {
    syncBookmarksBar(state)
    if (chromeView && !chromeView.webContents.isDestroyed()) {
      chromeView.webContents.send(IpcChannels.BOOKMARKS_UPDATED, state)
    }
    for (const contents of tabManager?.getPageWebContents() ?? []) {
      contents.send(IpcChannels.BOOKMARKS_UPDATED, state)
    }
  }
  bookmarkStore.setOnUpdated(broadcastBookmarks)

  const broadcastTodos = (state: TodosState): void => {
    if (chromeView && !chromeView.webContents.isDestroyed()) {
      chromeView.webContents.send(IpcChannels.TODOS_UPDATED, state)
    }
    for (const contents of tabManager?.getPageWebContents() ?? []) {
      contents.send(IpcChannels.TODOS_UPDATED, state)
    }
  }
  todoStore.setOnUpdated(broadcastTodos)

  tabManager = new TabManager(
    mainWindow,
    chromeView,
    historyStore,
    sessionStore,
    {
      onTabsChanged: (tabs) => {
        if (chromeView && !chromeView.webContents.isDestroyed()) {
          chromeView.webContents.send(IpcChannels.TABS_UPDATED, tabs)
        }
      },
      onNavChanged: (state) => {
        if (chromeView && !chromeView.webContents.isDestroyed()) {
          chromeView.webContents.send(IpcChannels.NAV_STATE, state)
        }
      },
      onClosedTabsChanged: (tabs) => {
        if (chromeView && !chromeView.webContents.isDestroyed()) {
          chromeView.webContents.send(IpcChannels.TABS_CLOSED_UPDATED, tabs)
        }
      }
    },
    screenTimeTracker,
    bookmarkStore
  )

  // Apply initial bar visibility once TabManager exists (store may already have items).
  syncBookmarksBar(bookmarkStore.getState())

  downloadManager = new DownloadManager(downloadsStore, {
    onUpdated: (entries, changedId) => {
      const payload = { entries, changedId }
      if (chromeView && !chromeView.webContents.isDestroyed()) {
        chromeView.webContents.send(IpcChannels.DOWNLOADS_UPDATED, payload)
      }
      for (const contents of tabManager?.getPageWebContents() ?? []) {
        contents.send(IpcChannels.DOWNLOADS_UPDATED, payload)
      }
    },
    openDownloadsPage: () => {
      tabManager?.createTab('lockin://downloads')
    }
  })
  downloadManager.attach()

  passwordManager = new PasswordManager(passwordStore, {
    onSavePrompt: (prompt) => {
      if (chromeView && !chromeView.webContents.isDestroyed()) {
        chromeView.webContents.send(IpcChannels.PASSWORDS_SAVE_PROMPT, prompt)
      }
    }
  })

  registerIpc(
    tabManager,
    historyStore,
    downloadManager,
    passwordManager,
    screenTimeStore,
    bookmarkStore,
    todoStore,
    apiKeyStore,
    aiChatStore,
    screenTimeTracker,
    {
      isFullScreen: isWindowFullScreen,
      close: () => {
        mainWindow?.close()
      },
      minimize: () => {
        if (!mainWindow || mainWindow.isDestroyed() || isWindowFullScreen()) return
        mainWindow.minimize()
      },
      toggleFullScreen
    }
  )

  mainWindow.on('resize', () => {
    tabManager?.relayout()
  })

  chromeView.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    screenTimeTracker?.stop()
    tabManager?.persistSession()
    unregisterIpc()
    tabManager = null
    chromeView = null
    mainWindow = null
    historyStore = null
    bookmarkStore = null
    todoStore = null
    downloadsStore = null
    downloadManager = null
    passwordStore = null
    passwordManager = null
    apiKeyStore = null
    aiChatStore = null
    sessionStore = null
    screenTimeStore = null
    screenTimeTracker = null
  })

  chromeView.webContents.once('did-finish-load', () => {
    mainWindow?.show()
    tabManager?.restoreSession()
    broadcastFullScreen(isWindowFullScreen())
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void chromeView.webContents.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void chromeView.webContents.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.configureWebAuthn({ platformPasskeys: true })
  }
  configureBrowserSession()
  configureIncognitoSession()
  registerLockinProtocol()
  createWindow()

  app.on('activate', () => {
    if (BaseWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', () => {
  screenTimeTracker?.flush(false)
  tabManager?.persistSession()
  flushBrowserSession()
  void clearIncognitoSession()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
