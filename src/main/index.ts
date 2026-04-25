import { app, BrowserWindow, Menu, shell, nativeTheme, ipcMain, session } from 'electron'
import { join } from 'path'
import { registerIpc } from './ipc/registerIpc'
import { buildAppMenu } from './menu'
import { clearRecentRepos, getSettings } from './services/settingsService'
import { logger } from './utils/logger'

let mainWindow: BrowserWindow | null = null

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1000,
    minHeight: 640,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#1E1E2E',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,  // Disable web security to allow localhost loading
      webviewTag: true  // Enable <webview> tag support
    }
  })

  win.on('ready-to-show', () => {
    win.show()
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  if (!app.isPackaged) {
    win.webContents.openDevTools({ mode: 'detach' })
  }

  return win
}

/** Rebuild the native menu with the latest recentRepos from settings */
export function rebuildMenu(): void {
  if (!mainWindow) return
  const settings = getSettings()
  Menu.setApplicationMenu(
    buildAppMenu(
      {
        openRepo: () => mainWindow?.webContents.send('menu:openRepo'),
        cloneRepo: () => mainWindow?.webContents.send('menu:cloneRepo'),
        closeRepo: () => mainWindow?.webContents.send('menu:closeRepo'),
        openSettings: () => mainWindow?.webContents.send('menu:openSettings'),
        toggleLanguage: () => mainWindow?.webContents.send('menu:toggleLanguage'),
        refreshAnalysis: () => mainWindow?.webContents.send('menu:refreshAnalysis'),
        openRecentRepo: (path: string) =>
          mainWindow?.webContents.send('menu:openRecentRepo', path),
        clearRecentRepos: () => {
          clearRecentRepos()
          rebuildMenu()
        }
      },
      settings.recentRepos
    )
  )
}

app.whenReady().then(async () => {
  nativeTheme.themeSource = 'dark'

  // Configure webview session to allow localhost connections
  const webappSession = session.fromPartition('persist:webapp')

  // Disable CORS for localhost to allow webview to load dev servers
  webappSession.webRequest.onBeforeSendHeaders((details, callback) => {
    callback({ requestHeaders: { ...details.requestHeaders } })
  })

  webappSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = details.responseHeaders || {}
    callback({
      responseHeaders: {
        ...headers,
        'Access-Control-Allow-Origin': ['*'],
        'Access-Control-Allow-Methods': ['*'],
        'Access-Control-Allow-Headers': ['*']
      }
    })
  })

  registerIpc()

  mainWindow = createWindow()

  // Initial menu build
  rebuildMenu()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
  })

  logger.info('VibeLens main ready')
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

process.on('uncaughtException', (err) => {
  logger.error('uncaughtException', err)
})
process.on('unhandledRejection', (err) => {
  logger.error('unhandledRejection', err)
})

