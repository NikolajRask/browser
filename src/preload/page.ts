import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

// Channel names inlined so the sandboxed preload has no shared runtime chunks.
const IpcChannels = {
  HISTORY_LIST: 'history:list',
  HISTORY_REMOVE: 'history:remove',
  HISTORY_CLEAR: 'history:clear',
  HISTORY_OPEN: 'history:open',
  DOWNLOADS_LIST: 'downloads:list',
  DOWNLOADS_UPDATED: 'downloads:updated',
  DOWNLOADS_CANCEL: 'downloads:cancel',
  DOWNLOADS_PAUSE: 'downloads:pause',
  DOWNLOADS_RESUME: 'downloads:resume',
  DOWNLOADS_OPEN: 'downloads:open',
  DOWNLOADS_SHOW: 'downloads:show',
  DOWNLOADS_REMOVE: 'downloads:remove',
  DOWNLOADS_CLEAR: 'downloads:clear',
  PASSWORDS_LOGIN_DETECTED: 'passwords:login-detected',
  PASSWORDS_FOR_ORIGIN: 'passwords:for-origin',
  PASSWORDS_LIST: 'passwords:list',
  PASSWORDS_REMOVE: 'passwords:remove',
  PASSWORDS_CLEAR: 'passwords:clear',
  PASSWORDS_REVEAL: 'passwords:reveal',
  PASSWORDS_COPY: 'passwords:copy'
} as const

export type HistoryEntry = {
  id: string
  url: string
  title: string
  favicon: string | null
  visitedAt: number
}

export type HistoryClearRange = 'hour' | 'day' | 'week' | 'month' | 'all'

export type DownloadState = 'progressing' | 'completed' | 'cancelled' | 'interrupted'

export type DownloadEntry = {
  id: string
  url: string
  filename: string
  savePath: string
  mimeType: string
  totalBytes: number
  receivedBytes: number
  state: DownloadState
  startedAt: number
  endedAt: number | null
  canResume: boolean
  paused: boolean
}

export type DownloadsUpdatedPayload = {
  entries: DownloadEntry[]
  changedId: string | null
}

export type CredentialListItem = {
  id: string
  origin: string
  username: string
  createdAt: number
  updatedAt: number
}

export type CredentialAutofillItem = {
  id: string
  origin: string
  username: string
  password: string
}

contextBridge.exposeInMainWorld('lockinHistory', {
  list: (): Promise<HistoryEntry[]> => ipcRenderer.invoke(IpcChannels.HISTORY_LIST),
  remove: (id: string): Promise<boolean> => ipcRenderer.invoke(IpcChannels.HISTORY_REMOVE, id),
  clear: (range?: HistoryClearRange): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.HISTORY_CLEAR, range ?? 'all'),
  open: (url: string): Promise<void> => ipcRenderer.invoke(IpcChannels.HISTORY_OPEN, url)
})

contextBridge.exposeInMainWorld('lockinDownloads', {
  list: (): Promise<DownloadEntry[]> => ipcRenderer.invoke(IpcChannels.DOWNLOADS_LIST),
  cancel: (id: string): Promise<boolean> => ipcRenderer.invoke(IpcChannels.DOWNLOADS_CANCEL, id),
  pause: (id: string): Promise<boolean> => ipcRenderer.invoke(IpcChannels.DOWNLOADS_PAUSE, id),
  resume: (id: string): Promise<boolean> => ipcRenderer.invoke(IpcChannels.DOWNLOADS_RESUME, id),
  open: (id: string): Promise<boolean> => ipcRenderer.invoke(IpcChannels.DOWNLOADS_OPEN, id),
  showInFolder: (id: string): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannels.DOWNLOADS_SHOW, id),
  remove: (id: string): Promise<boolean> => ipcRenderer.invoke(IpcChannels.DOWNLOADS_REMOVE, id),
  clear: (): Promise<void> => ipcRenderer.invoke(IpcChannels.DOWNLOADS_CLEAR),
  onUpdated: (callback: (payload: DownloadsUpdatedPayload) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, payload: DownloadsUpdatedPayload): void => {
      callback(payload)
    }
    ipcRenderer.on(IpcChannels.DOWNLOADS_UPDATED, listener)
    return () => {
      ipcRenderer.removeListener(IpcChannels.DOWNLOADS_UPDATED, listener)
    }
  }
})

contextBridge.exposeInMainWorld('lockinPasswords', {
  list: (): Promise<CredentialListItem[]> => ipcRenderer.invoke(IpcChannels.PASSWORDS_LIST),
  remove: (id: string): Promise<boolean> => ipcRenderer.invoke(IpcChannels.PASSWORDS_REMOVE, id),
  clear: (): Promise<void> => ipcRenderer.invoke(IpcChannels.PASSWORDS_CLEAR),
  reveal: (id: string): Promise<string | null> =>
    ipcRenderer.invoke(IpcChannels.PASSWORDS_REVEAL, id),
  copy: (id: string): Promise<boolean> => ipcRenderer.invoke(IpcChannels.PASSWORDS_COPY, id)
})

const USERNAME_TYPES = new Set(['text', 'email', 'tel', 'url', 'search', ''])
const USERNAME_HINTS = /user|email|login|account|name|phone|id/i

function pageOrigin(): string | null {
  try {
    const { origin, protocol } = window.location
    if (protocol !== 'http:' && protocol !== 'https:') return null
    return origin
  } catch {
    return null
  }
}

function isPasswordInput(el: Element | null): el is HTMLInputElement {
  return el instanceof HTMLInputElement && el.type === 'password'
}

function isUsernameInput(el: Element | null): el is HTMLInputElement {
  if (!(el instanceof HTMLInputElement)) return false
  if (el.type === 'password' || el.type === 'hidden' || el.type === 'submit' || el.type === 'button') {
    return false
  }
  if (!USERNAME_TYPES.has(el.type)) return false
  const hint = `${el.name} ${el.id} ${el.autocomplete} ${el.placeholder} ${el.getAttribute('aria-label') ?? ''}`
  if (el.type === 'email' || el.autocomplete === 'username' || el.autocomplete === 'email') {
    return true
  }
  return USERNAME_HINTS.test(hint) || el.type === 'text' || el.type === ''
}

function findUsernameInForm(form: HTMLFormElement, passwordInput: HTMLInputElement): string {
  const inputs = Array.from(form.querySelectorAll('input')).filter(
    (input): input is HTMLInputElement => input instanceof HTMLInputElement
  )
  const passwordIndex = inputs.indexOf(passwordInput)
  for (let i = passwordIndex - 1; i >= 0; i -= 1) {
    if (isUsernameInput(inputs[i])) return inputs[i].value.trim()
  }
  for (const input of inputs) {
    if (input === passwordInput) continue
    if (isUsernameInput(input) && input.value.trim()) return input.value.trim()
  }
  return ''
}

function findUsernameNearPassword(passwordInput: HTMLInputElement): string {
  if (passwordInput.form) return findUsernameInForm(passwordInput.form, passwordInput)

  const root = passwordInput.getRootNode()
  const scope = root instanceof Document || root instanceof ShadowRoot ? root : document
  const inputs = Array.from(scope.querySelectorAll('input')).filter(
    (input): input is HTMLInputElement => input instanceof HTMLInputElement
  )
  const passwordIndex = inputs.indexOf(passwordInput)
  for (let i = passwordIndex - 1; i >= 0; i -= 1) {
    if (isUsernameInput(inputs[i])) return inputs[i].value.trim()
  }
  return ''
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const proto = Object.getPrototypeOf(input) as HTMLInputElement
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value')
  if (descriptor?.set) {
    descriptor.set.call(input, value)
  } else {
    input.value = value
  }
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

function fillCredential(
  usernameInput: HTMLInputElement | null,
  passwordInput: HTMLInputElement,
  credential: CredentialAutofillItem
): void {
  if (usernameInput && !usernameInput.value.trim()) {
    setInputValue(usernameInput, credential.username)
  }
  if (!passwordInput.value.trim()) {
    setInputValue(passwordInput, credential.password)
  }
}

function findUsernameInputForPassword(passwordInput: HTMLInputElement): HTMLInputElement | null {
  const form = passwordInput.form
  if (form) {
    const inputs = Array.from(form.querySelectorAll('input')).filter(
      (input): input is HTMLInputElement => input instanceof HTMLInputElement
    )
    for (const input of inputs) {
      if (isUsernameInput(input)) return input
    }
  }

  const root = passwordInput.getRootNode()
  const scope = root instanceof Document || root instanceof ShadowRoot ? root : document
  const inputs = Array.from(scope.querySelectorAll('input')).filter(
    (input): input is HTMLInputElement => input instanceof HTMLInputElement
  )
  const passwordIndex = inputs.indexOf(passwordInput)
  for (let i = passwordIndex - 1; i >= 0; i -= 1) {
    if (isUsernameInput(inputs[i])) return inputs[i]
  }
  return null
}

function collectLoginForms(root: ParentNode = document): Array<{
  usernameInput: HTMLInputElement | null
  passwordInput: HTMLInputElement
}> {
  const passwordInputs = Array.from(root.querySelectorAll('input[type="password"]')).filter(
    (input): input is HTMLInputElement => input instanceof HTMLInputElement
  )
  const seen = new Set<HTMLInputElement>()
  const forms: Array<{ usernameInput: HTMLInputElement | null; passwordInput: HTMLInputElement }> =
    []

  for (const passwordInput of passwordInputs) {
    if (seen.has(passwordInput)) continue
    seen.add(passwordInput)
    forms.push({
      usernameInput: findUsernameInputForPassword(passwordInput),
      passwordInput
    })
  }
  return forms
}

type PickerState = {
  host: HTMLElement
  shadow: ShadowRoot
  list: HTMLElement
  anchor: HTMLInputElement | null
}

let picker: PickerState | null = null
let pickerSeq = 0
let credentialsCache: CredentialAutofillItem[] | null = null
let credentialsCacheOrigin: string | null = null
let autoFillSeq = 0
const autoFilledPasswords = new WeakSet<HTMLInputElement>()

async function credentialsForPage(): Promise<CredentialAutofillItem[]> {
  const origin = pageOrigin()
  if (!origin) return []
  if (credentialsCache && credentialsCacheOrigin === origin) return credentialsCache

  const credentials = (await ipcRenderer.invoke(
    IpcChannels.PASSWORDS_FOR_ORIGIN,
    origin
  )) as CredentialAutofillItem[]
  if (!Array.isArray(credentials)) {
    credentialsCache = []
    credentialsCacheOrigin = origin
    return []
  }
  credentialsCache = credentials
  credentialsCacheOrigin = origin
  return credentials
}

async function tryAutoFillPage(): Promise<void> {
  const origin = pageOrigin()
  if (!origin) return

  const seq = ++autoFillSeq
  const credentials = await credentialsForPage()
  if (seq !== autoFillSeq) return
  if (credentials.length === 0) return

  // Prefer the most recently updated credential.
  const credential = credentials[0]
  for (const { usernameInput, passwordInput } of collectLoginForms()) {
    if (autoFilledPasswords.has(passwordInput)) continue
    if (passwordInput.value.trim() || (usernameInput?.value.trim() ?? '')) continue

    fillCredential(usernameInput, passwordInput, credential)
    autoFilledPasswords.add(passwordInput)
  }
}

function ensurePicker(): PickerState {
  if (picker && document.contains(picker.host)) return picker

  const host = document.createElement('div')
  host.id = 'lockin-password-autofill-host'
  host.style.all = 'initial'
  host.style.position = 'absolute'
  host.style.zIndex = '2147483646'
  host.style.display = 'none'
  const shadow = host.attachShadow({ mode: 'closed' })

  const style = document.createElement('style')
  style.textContent = `
    :host { all: initial; }
    .panel {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      min-width: 220px;
      max-width: 320px;
      background: #ffffff;
      color: #1f2328;
      border: 1px solid #d7dce3;
      border-radius: 10px;
      box-shadow: 0 8px 28px rgba(31, 35, 40, 0.18);
      overflow: hidden;
    }
    .item {
      display: block;
      width: 100%;
      text-align: left;
      border: 0;
      background: transparent;
      padding: 10px 12px;
      cursor: pointer;
      font: inherit;
      font-size: 13px;
    }
    .item:hover, .item:focus {
      background: #f3f6f8;
      outline: none;
    }
    .user {
      font-weight: 600;
      display: block;
    }
    .origin {
      color: #5f6b76;
      font-size: 11px;
      margin-top: 2px;
      display: block;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `
  const list = document.createElement('div')
  list.className = 'panel'
  list.setAttribute('role', 'listbox')
  shadow.append(style, list)

  const mount = (): void => {
    if (!document.documentElement.contains(host)) {
      ;(document.body || document.documentElement).appendChild(host)
    }
  }
  if (document.body) mount()
  else document.addEventListener('DOMContentLoaded', mount, { once: true })

  picker = { host, shadow, list, anchor: null }
  return picker
}

function hidePicker(): void {
  if (!picker) return
  picker.host.style.display = 'none'
  picker.list.replaceChildren()
  picker.anchor = null
}

function positionPicker(anchor: HTMLInputElement): void {
  const state = ensurePicker()
  const rect = anchor.getBoundingClientRect()
  const top = window.scrollY + rect.bottom + 4
  const left = window.scrollX + rect.left
  state.host.style.top = `${Math.max(0, top)}px`
  state.host.style.left = `${Math.max(0, left)}px`
  state.host.style.display = 'block'
}

function showPicker(
  anchor: HTMLInputElement,
  credentials: CredentialAutofillItem[],
  usernameInput: HTMLInputElement | null,
  passwordInput: HTMLInputElement
): void {
  if (!credentials.length) {
    hidePicker()
    return
  }

  const state = ensurePicker()
  state.anchor = anchor
  state.list.replaceChildren()

  for (const credential of credentials) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'item'
    button.setAttribute('role', 'option')
    const user = document.createElement('span')
    user.className = 'user'
    user.textContent = credential.username
    const origin = document.createElement('span')
    origin.className = 'origin'
    origin.textContent = credential.origin
    button.append(user, origin)
    button.addEventListener('mousedown', (event) => {
      event.preventDefault()
      event.stopPropagation()
      if (usernameInput) setInputValue(usernameInput, credential.username)
      setInputValue(passwordInput, credential.password)
      autoFilledPasswords.add(passwordInput)
      hidePicker()
    })
    state.list.appendChild(button)
  }

  positionPicker(anchor)
}

async function maybeShowAutofill(target: HTMLInputElement): Promise<void> {
  const origin = pageOrigin()
  if (!origin) return

  const passwordField = target.type === 'password'
  const usernameField = !passwordField && isUsernameInput(target)
  if (!passwordField && !usernameField) return

  const seq = ++pickerSeq
  const credentials = await credentialsForPage()
  if (seq !== pickerSeq) return
  if (credentials.length === 0) {
    hidePicker()
    return
  }

  let passwordInput: HTMLInputElement
  let usernameInput: HTMLInputElement | null

  if (passwordField) {
    passwordInput = target
    usernameInput = findUsernameInputForPassword(target)
  } else {
    usernameInput = target
    const form = target.form
    const passwordCandidate = form
      ? form.querySelector('input[type="password"]')
      : document.querySelector('input[type="password"]')
    if (!isPasswordInput(passwordCandidate)) return
    passwordInput = passwordCandidate
  }

  // If fields are empty, fill immediately with the newest saved account.
  if (!passwordInput.value.trim() && !(usernameInput?.value.trim() ?? '')) {
    fillCredential(usernameInput, passwordInput, credentials[0])
    autoFilledPasswords.add(passwordInput)
  }

  // Offer a picker when multiple accounts exist so the user can switch.
  if (credentials.length > 1) {
    showPicker(target, credentials, usernameInput, passwordInput)
  } else {
    hidePicker()
  }
}

function captureLoginFromPassword(passwordInput: HTMLInputElement): void {
  const origin = pageOrigin()
  if (!origin) return
  const password = passwordInput.value
  if (!password) return
  const username = findUsernameNearPassword(passwordInput)
  if (!username) return
  void ipcRenderer.invoke(IpcChannels.PASSWORDS_LOGIN_DETECTED, {
    origin,
    username,
    password
  })
}

function onSubmit(event: Event): void {
  const form = event.target
  if (!(form instanceof HTMLFormElement)) return
  const passwordInput = form.querySelector('input[type="password"]')
  if (!isPasswordInput(passwordInput)) return
  captureLoginFromPassword(passwordInput)
}

function onFocusIn(event: Event): void {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  void maybeShowAutofill(target)
}

function onPointerDown(event: Event): void {
  if (!picker || picker.host.style.display === 'none') return
  const target = event.target
  if (target instanceof Node && picker.host.contains(target)) return
  hidePicker()
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') hidePicker()
}

function onScrollOrResize(): void {
  if (!picker || !picker.anchor || picker.host.style.display === 'none') return
  positionPicker(picker.anchor)
}

function scheduleAutoFill(): void {
  void tryAutoFillPage()
}

function installPasswordHooks(): void {
  if (window.location.protocol === 'lockin:') return

  document.addEventListener('submit', onSubmit, true)
  document.addEventListener('focusin', onFocusIn, true)
  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('scroll', onScrollOrResize, true)
  window.addEventListener('resize', onScrollOrResize)

  // Also catch password fields that submit via button click without a form submit
  // (common SPA pattern): listen for Enter in password fields.
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Enter') return
      const target = event.target
      if (!(target instanceof HTMLInputElement) || target.type !== 'password') return
      // Defer so the field value is final.
      queueMicrotask(() => captureLoginFromPassword(target))
    },
    true
  )

  scheduleAutoFill()

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== 'childList') continue
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue
        if (
          node.matches?.('input[type="password"], form') ||
          node.querySelector?.('input[type="password"]')
        ) {
          scheduleAutoFill()
          return
        }
      }
    }
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installPasswordHooks, { once: true })
} else {
  installPasswordHooks()
}
