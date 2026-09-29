import { app, BaseWindow, WebContentsView, shell, protocol } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { registerIpc, unregisterIpc } from './ipc'
import { TabManager } from './tab-manager'
import { HistoryStore } from './history-store'
import { DownloadsStore } from './downloads-store'
import { DownloadManager } from './download-manager'
import { PasswordStore } from './password-store'
import { PasswordManager } from './password-manager'
import { HISTORY_PAGE_HTML } from './history-page'
import { DOWNLOADS_PAGE_HTML } from './downloads-page'
import { PASSWORDS_PAGE_HTML } from './passwords-page'
import {
  configureBrowserSession,
  flushBrowserSession,
  stripElectronFromUserAgent
} from './browser-session'
import { CHROME_HEIGHT, IpcChannels } from '../shared/ipc'

// Apply before ready so new WebContents inherit a Chromium-like UA (no Electron token).
app.userAgentFallback = stripElectronFromUserAgent(app.userAgentFallback)

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
let downloadsStore: DownloadsStore | null = null
let downloadManager: DownloadManager | null = null
let passwordStore: PasswordStore | null = null
let passwordManager: PasswordManager | null = null

function registerLockinProtocol(): void {
  protocol.handle('lockin', (request) => {
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

    return new Response('Not Found', { status: 404, headers: { 'content-type': 'text/plain' } })
  })
}

function createWindow(): void {
  const isMac = process.platform === 'darwin'

  mainWindow = new BaseWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Lockin',
    show: false,
    backgroundColor: '#dee1e6',
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    trafficLightPosition: isMac ? { x: 14, y: 12 } : undefined,
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

  historyStore = new HistoryStore()
  downloadsStore = new DownloadsStore()
  passwordStore = new PasswordStore()

  tabManager = new TabManager(mainWindow, chromeView, historyStore, {
    onTabsChanged: (tabs) => {
      if (chromeView && !chromeView.webContents.isDestroyed()) {
        chromeView.webContents.send(IpcChannels.TABS_UPDATED, tabs)
      }
    },
    onNavChanged: (state) => {
      if (chromeView && !chromeView.webContents.isDestroyed()) {
        chromeView.webContents.send(IpcChannels.NAV_STATE, state)
      }
    }
  })

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

  registerIpc(tabManager, historyStore, downloadManager, passwordManager)

  mainWindow.on('resize', () => {
    tabManager?.relayout()
  })

  chromeView.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    unregisterIpc()
    tabManager = null
    chromeView = null
    mainWindow = null
    historyStore = null
    downloadsStore = null
    downloadManager = null
    passwordStore = null
    passwordManager = null
  })

  chromeView.webContents.once('did-finish-load', () => {
    mainWindow?.show()
    tabManager?.createTab()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void chromeView.webContents.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void chromeView.webContents.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  app.setName('Lockin')
  if (process.platform === 'darwin') {
    app.configureWebAuthn({ platformPasskeys: true })
  }
  configureBrowserSession()
  registerLockinProtocol()
  createWindow()

  app.on('activate', () => {
    if (BaseWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', () => {
  flushBrowserSession()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
