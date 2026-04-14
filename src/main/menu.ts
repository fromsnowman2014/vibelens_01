import { Menu, MenuItemConstructorOptions, app } from 'electron'
import type { RecentRepo } from '@shared/types'

interface MenuActions {
  openRepo: () => void
  cloneRepo: () => void
  closeRepo: () => void
  openSettings: () => void
  toggleLanguage: () => void
  refreshAnalysis: () => void
  openRecentRepo: (path: string) => void
  clearRecentRepos: () => void
}

export function buildAppMenu(actions: MenuActions, recentRepos: RecentRepo[] = []): Menu {
  const isMac = process.platform === 'darwin'

  // Build Open Recent submenu dynamically
  const recentItems: MenuItemConstructorOptions[] = recentRepos.slice(0, 10).map((repo) => ({
    label: repo.name,
    sublabel: repo.path,
    click: () => actions.openRecentRepo(repo.path)
  }))

  const openRecentSubmenu: MenuItemConstructorOptions[] =
    recentItems.length > 0
      ? [
          ...recentItems,
          { type: 'separator' as const },
          {
            label: 'Clear Recent',
            click: () => actions.clearRecentRepos()
          }
        ]
      : [{ label: 'No Recent Repositories', enabled: false }]

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              {
                label: 'Settings…',
                accelerator: 'Cmd+,',
                click: () => actions.openSettings()
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Repository…',
          accelerator: 'CmdOrCtrl+O',
          click: () => actions.openRepo()
        },
        {
          label: 'Clone Repository…',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => actions.cloneRepo()
        },
        {
          label: 'Open Recent',
          submenu: openRecentSubmenu
        },
        { type: 'separator' },
        {
          label: 'Close Repository',
          click: () => actions.closeRepo()
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'Analysis',
      submenu: [
        {
          label: 'Refresh Analysis',
          accelerator: 'CmdOrCtrl+R',
          click: () => actions.refreshAnalysis()
        },
        {
          label: 'Toggle Language (Ko/En)',
          accelerator: 'CmdOrCtrl+L',
          click: () => actions.toggleLanguage()
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'front' }]
    }
  ]

  return Menu.buildFromTemplate(template)
}

