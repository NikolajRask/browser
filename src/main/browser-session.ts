import { session, type Session, type WebContents } from 'electron'

export const INCOGNITO_PARTITION = 'temp:lockin-incognito'

/** Strip the Electron token so sites (e.g. Google) treat the app as Chromium. */
export function stripElectronFromUserAgent(userAgent: string): string {
  return userAgent.replace(/\sElectron\/\S+/g, '')
}

export function getBrowserSession(): Session {
  return session.defaultSession
}

export function getIncognitoSession(): Session {
  return session.fromPartition(INCOGNITO_PARTITION)
}

export function isIncognitoSession(ses: Session): boolean {
  return ses === getIncognitoSession()
}

export function isIncognitoWebContents(webContents: WebContents): boolean {
  return isIncognitoSession(webContents.session)
}

/** Configure the persistent browsing session (UA). Call after app.whenReady(). */
export function configureBrowserSession(): void {
  const ses = getBrowserSession()
  ses.setUserAgent(stripElectronFromUserAgent(ses.getUserAgent()))
}

/** Apply UA strip to the ephemeral Incognito partition. Safe to call repeatedly. */
export function configureIncognitoSession(): void {
  const ses = getIncognitoSession()
  ses.setUserAgent(stripElectronFromUserAgent(ses.getUserAgent()))
}

export function flushBrowserSession(): void {
  getBrowserSession().flushStorageData()
}

/** Wipe cookies, storage, and cache for the shared Incognito partition. */
export async function clearIncognitoSession(): Promise<void> {
  const ses = getIncognitoSession()
  try {
    await ses.clearStorageData()
  } catch {
    // Partition may already be torn down.
  }
  try {
    await ses.clearCache()
  } catch {
    // Ignore cache clear failures.
  }
  try {
    await ses.clearAuthCache()
  } catch {
    // Ignore auth cache clear failures.
  }
}
