import {
  ClipboardItem,
  Menu,
  clipboard,
  nativeImage,
  type BaseWindow,
  type ContextMenuParams,
  type MenuItemConstructorOptions,
  type WebContents
} from 'electron'

type ContextMenuHandlers = {
  openInNewTab: (url: string) => void
  goBack: () => void
  goForward: () => void
  reload: () => void
}

export function attachPageContextMenu(
  webContents: WebContents,
  window: BaseWindow,
  handlers: ContextMenuHandlers
): void {
  webContents.on('context-menu', (_event, params) => {
    const menu = buildPageContextMenu(webContents, params, handlers)
    menu.popup({
      window,
      frame: params.frame ?? undefined,
      x: params.x,
      y: params.y
    })
  })
}

function buildPageContextMenu(
  webContents: WebContents,
  params: ContextMenuParams,
  handlers: ContextMenuHandlers
): Menu {
  const items: MenuItemConstructorOptions[] = []
  const hasLink = Boolean(params.linkURL)
  const hasSelection = Boolean(params.selectionText?.trim())
  const isImage = params.mediaType === 'image'
  const canGoBack = webContents.navigationHistory.canGoBack()
  const canGoForward = webContents.navigationHistory.canGoForward()

  if (!hasLink && !isImage && !params.isEditable && !hasSelection) {
    items.push(
      {
        label: 'Back',
        enabled: canGoBack,
        click: () => handlers.goBack()
      },
      {
        label: 'Forward',
        enabled: canGoForward,
        click: () => handlers.goForward()
      },
      {
        label: 'Reload',
        click: () => handlers.reload()
      },
      { type: 'separator' }
    )
  }

  if (hasLink) {
    items.push(
      {
        label: 'Open Link in New Tab',
        click: () => handlers.openInNewTab(params.linkURL)
      },
      {
        label: 'Save Link As…',
        click: () => {
          webContents.downloadURL(params.linkURL)
        }
      },
      {
        label: 'Copy Link Address',
        click: () => {
          void clipboard.writeText(params.linkURL)
        }
      },
      { type: 'separator' }
    )
  }

  if (isImage) {
    const imageUrl = params.srcURL
    items.push(
      {
        label: 'Open Image in New Tab',
        enabled: Boolean(imageUrl),
        click: () => {
          if (imageUrl) handlers.openInNewTab(imageUrl)
        }
      },
      {
        label: 'Save Image As…',
        enabled: Boolean(imageUrl),
        click: () => {
          if (imageUrl) webContents.downloadURL(imageUrl)
        }
      },
      {
        label: 'Copy Image',
        click: () => {
          if (params.hasImageContents) {
            webContents.copyImageAt(params.x, params.y)
          } else if (imageUrl) {
            void copyImageFromUrl(imageUrl)
          }
        }
      },
      {
        label: 'Copy Image Address',
        enabled: Boolean(imageUrl),
        click: () => {
          if (imageUrl) void clipboard.writeText(imageUrl)
        }
      },
      { type: 'separator' }
    )
  }

  if (params.isEditable) {
    items.push(
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut', enabled: params.editFlags.canCut },
      { role: 'copy', enabled: params.editFlags.canCopy },
      { role: 'paste', enabled: params.editFlags.canPaste },
      { role: 'delete', enabled: params.editFlags.canDelete },
      { type: 'separator' },
      { role: 'selectAll', enabled: params.editFlags.canSelectAll }
    )
  } else {
    items.push(
      {
        role: 'copy',
        enabled: params.editFlags.canCopy || hasSelection
      },
      {
        role: 'selectAll',
        enabled: params.editFlags.canSelectAll
      }
    )
  }

  items.push(
    { type: 'separator' },
    {
      label: 'Inspect',
      click: () => {
        webContents.inspectElement(params.x, params.y)
        if (!webContents.isDevToolsOpened()) {
          webContents.openDevTools({ mode: 'detach' })
        }
      }
    }
  )

  return Menu.buildFromTemplate(compactSeparators(items))
}

function compactSeparators(items: MenuItemConstructorOptions[]): MenuItemConstructorOptions[] {
  const result: MenuItemConstructorOptions[] = []

  for (const item of items) {
    if (item.type === 'separator') {
      if (result.length === 0) continue
      if (result[result.length - 1]?.type === 'separator') continue
    }
    result.push(item)
  }

  if (result[result.length - 1]?.type === 'separator') {
    result.pop()
  }

  return result
}

async function copyImageFromUrl(url: string): Promise<void> {
  try {
    const response = await fetch(url)
    const buffer = Buffer.from(await response.arrayBuffer())
    const image = nativeImage.createFromBuffer(buffer)
    if (!image.isEmpty()) {
      const png = image.toPNG()
      const blob = new Blob([png], { type: 'image/png' })
      await clipboard.write([new ClipboardItem({ 'image/png': blob })])
      return
    }
  } catch {
    // Fall through to copy the URL as text.
  }
  await clipboard.writeText(url)
}
