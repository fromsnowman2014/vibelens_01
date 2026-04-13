import { app, BrowserWindow, Menu, shell, nativeTheme } from 'electron'
import { join } from 'path'
import { registerIpc } from './ipc/registerIpc'
import { buildAppMenu } from './menu'
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
      webSecurity: true
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

app.whenReady().then(async () => {
  nativeTheme.themeSource = 'dark'

  registerIpc()

  mainWindow = createWindow()

  Menu.setApplicationMenu(
    buildAppMenu({
      openRepo: () => mainWindow?.webContents.send('menu:openRepo'),
      cloneRepo: () => mainWindow?.webContents.send('menu:cloneRepo'),
      closeRepo: () => mainWindow?.webContents.send('menu:closeRepo'),
      openSettings: () => mainWindow?.webContents.send('menu:openSettings'),
      toggleLanguage: () => mainWindow?.webContents.send('menu:toggleLanguage'),
      refreshAnalysis: () => mainWindow?.webContents.send('menu:refreshAnalysis')
    })
  )

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
