import { session, type Session } from 'electron'

/** Strip the Electron token so sites (e.g. Google) treat the app as Chromium. */
export function stripElectronFromUserAgent(userAgent: string): string {
  return userAgent.replace(/\sElectron\/\S+/g, '')
}

export function getBrowserSession(): Session {
  return session.defaultSession
}

/** Configure the persistent browsing session (UA). Call after app.whenReady(). */
export function configureBrowserSession(): void {
  const ses = getBrowserSession()
  ses.setUserAgent(stripElectronFromUserAgent(ses.getUserAgent()))
}

export function flushBrowserSession(): void {
  getBrowserSession().flushStorageData()
}
