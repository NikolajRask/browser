import type { LockinApi } from '../../shared/ipc'

declare global {
  interface Window {
    lockin: LockinApi
  }
}

export {}
