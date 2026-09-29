import { contextBridge, ipcRenderer } from 'electron'

// Channel names inlined so the sandboxed preload has no shared runtime chunks.
const SPLIT_RESIZE_START = 'split:resize-start'
const SPLIT_RESIZE_MOVE = 'split:resize-move'
const SPLIT_RESIZE_END = 'split:resize-end'

contextBridge.exposeInMainWorld('splitResize', {
  start: () => ipcRenderer.send(SPLIT_RESIZE_START),
  move: (screenX: number) => ipcRenderer.send(SPLIT_RESIZE_MOVE, screenX),
  end: () => ipcRenderer.send(SPLIT_RESIZE_END)
})
