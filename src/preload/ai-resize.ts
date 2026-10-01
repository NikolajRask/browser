import { contextBridge, ipcRenderer } from 'electron'

const AI_SIDEBAR_RESIZE_MOVE = 'chrome:ai-sidebar-resize-move'
const AI_SIDEBAR_RESIZE_END = 'chrome:ai-sidebar-resize-end'

contextBridge.exposeInMainWorld('aiSidebarResize', {
  move: (screenX: number) => ipcRenderer.send(AI_SIDEBAR_RESIZE_MOVE, screenX),
  end: () => ipcRenderer.send(AI_SIDEBAR_RESIZE_END)
})
