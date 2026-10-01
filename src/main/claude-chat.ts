import type {
  AiChatMessage,
  AiChatResponse,
  AiChatError,
  AiChatScreenshot
} from '../shared/ipc'
import type { ApiKeyStore } from './api-key-store'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const CLAUDE_MODEL = 'claude-sonnet-4-5'
const CLAUDE_ROUTER_MODEL = 'claude-haiku-4-5'
const ANTHROPIC_VERSION = '2023-06-01'

export type AiPageContext = {
  title: string
  url: string
  images: Array<{ imageBase64: string; mediaType: 'image/jpeg' }>
  pageText?: string | null
  selectionText?: string | null
}

export type AiPageContextMode = 'none' | 'text' | 'image'

const MIN_PAGE_TEXT_CHARS = 80

const VISUAL_CONTEXT_RE =
  /\b(screenshot|layout|diagram|chart|graph|figure|ui|ux|visual|handwriting|scan(?:ned)?|image|photo|looks?\s+like|what\s+do\s+you\s+see|tegning|figur|billede|skærmbillede)\b/i

type TextBlock = { type: 'text'; text: string }
type ImageBlock = {
  type: 'image'
  source: { type: 'base64'; media_type: 'image/jpeg'; data: string }
}
type ApiContent = string | Array<TextBlock | ImageBlock>
type ApiMessage = { role: 'user' | 'assistant'; content: ApiContent }

type StreamDelta = {
  type?: unknown
  delta?: { type?: unknown; text?: unknown }
  error?: { message?: unknown }
}

type PageMeta = {
  title: string
  url: string
}

export function hasEnoughPageText(capture: {
  pageText?: string | null
  selectionText?: string | null
} | null): boolean {
  if (!capture) return false
  const selection = capture.selectionText?.trim() ?? ''
  if (selection.length >= MIN_PAGE_TEXT_CHARS) return true
  const page = capture.pageText?.trim() ?? ''
  return page.length >= MIN_PAGE_TEXT_CHARS
}

export function messageLooksVisual(messages: AiChatMessage[]): boolean {
  const latestUser = [...messages]
    .reverse()
    .find(
      (message) =>
        message.role === 'user' && typeof message.content === 'string' && message.content.trim()
    )
  if (!latestUser) return false
  return VISUAL_CONTEXT_RE.test(latestUser.content)
}

/**
 * Prefer page text over screenshots whenever readable text is available,
 * unless the user explicitly asked about something visual.
 */
export function resolvePageContextMode(
  mode: AiPageContextMode,
  capture: { pageText?: string | null; selectionText?: string | null } | null,
  messages: AiChatMessage[]
): AiPageContextMode {
  if (mode === 'none') return 'none'

  const enoughText = hasEnoughPageText(capture)
  if (mode === 'text') {
    return enoughText ? 'text' : 'image'
  }

  // mode === 'image'
  if (enoughText && !messageLooksVisual(messages)) {
    return 'text'
  }
  return 'image'
}

function buildUserContent(text: string, pageContext?: AiPageContext | null): ApiContent {
  if (!pageContext) return text

  const metaLines: string[] = []
  if (pageContext.title || pageContext.url) {
    metaLines.push(`Current page: ${pageContext.title || 'Untitled'}`)
    metaLines.push(`URL: ${pageContext.url || '(none)'}`)
  }
  if (pageContext.images.length > 1) {
    metaLines.push(`Attached screenshots: ${pageContext.images.length}`)
  }

  const selection = pageContext.selectionText?.trim()
  if (selection) {
    metaLines.push(`Selected text:\n${selection}`)
  }

  const pageText = pageContext.pageText?.trim()
  if (pageText) {
    // Avoid duplicating the selection when it is the only meaningful excerpt.
    if (!selection || pageText !== selection) {
      metaLines.push(`Page text:\n${pageText}`)
    }
  }

  const combined = metaLines.length > 0 ? `${metaLines.join('\n\n')}\n\n${text}` : text

  if (pageContext.images.length === 0) return combined

  const blocks: Array<TextBlock | ImageBlock> = pageContext.images.map((image) => ({
    type: 'image',
    source: {
      type: 'base64',
      media_type: image.mediaType,
      data: image.imageBase64
    }
  }))
  blocks.push({ type: 'text', text: combined })
  return blocks
}

function buildApiMessages(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  pageContext?: AiPageContext | null
): ApiMessage[] {
  return messages.map((message, index) => {
    const isLatestUser = message.role === 'user' && index === messages.length - 1
    return {
      role: message.role,
      content: isLatestUser ? buildUserContent(message.content, pageContext) : message.content
    }
  })
}

function cleanMessages(
  messages: AiChatMessage[]
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return messages
    .filter(
      (message) =>
        (message.role === 'user' || message.role === 'assistant') &&
        typeof message.content === 'string' &&
        message.content.trim().length > 0
    )
    .map((message) => ({
      role: message.role as 'user' | 'assistant',
      content: message.content.trim()
    }))
}

export function sanitizeScreenshots(value: unknown): AiChatScreenshot[] {
  if (!Array.isArray(value)) return []
  const screenshots: AiChatScreenshot[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const imageBase64 = (item as AiChatScreenshot).imageBase64
    if (typeof imageBase64 !== 'string' || imageBase64.length < 32) continue
    screenshots.push({
      id:
        typeof (item as AiChatScreenshot).id === 'string' && (item as AiChatScreenshot).id
          ? (item as AiChatScreenshot).id
          : `shot-${screenshots.length + 1}`,
      imageBase64,
      mediaType: 'image/jpeg',
      title:
        typeof (item as AiChatScreenshot).title === 'string'
          ? (item as AiChatScreenshot).title
          : '',
      url: typeof (item as AiChatScreenshot).url === 'string' ? (item as AiChatScreenshot).url : '',
      capturedAt:
        typeof (item as AiChatScreenshot).capturedAt === 'number'
          ? (item as AiChatScreenshot).capturedAt
          : Date.now()
    })
  }
  return screenshots.slice(0, 6)
}

export function pageContextFromScreenshots(screenshots: AiChatScreenshot[]): AiPageContext {
  const first = screenshots[0]
  return {
    title: first?.title ?? '',
    url: first?.url ?? '',
    images: screenshots.map((shot) => ({
      imageBase64: shot.imageBase64,
      mediaType: shot.mediaType
    }))
  }
}

export function pageContextFromCapture(
  capture: {
    title: string
    url: string
    imageBase64: string | null
    mediaType: 'image/jpeg'
    pageText?: string | null
    selectionText?: string | null
  } | null,
  options?: { includeScreenshot?: boolean }
): AiPageContext | null {
  if (!capture) return null
  const includeScreenshot = options?.includeScreenshot !== false
  const images =
    includeScreenshot && capture.imageBase64
      ? [{ imageBase64: capture.imageBase64, mediaType: capture.mediaType }]
      : []
  const pageText = capture.pageText?.trim() || null
  const selectionText = capture.selectionText?.trim() || null
  if (images.length === 0 && !pageText && !selectionText && !capture.title && !capture.url) {
    return null
  }
  return {
    title: capture.title,
    url: capture.url,
    images,
    pageText,
    selectionText
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: { message?: string } }
    if (typeof payload?.error?.message === 'string' && payload.error.message) {
      return payload.error.message
    }
  } catch {
    // Fall through to status text.
  }
  return `Claude API error (${response.status})`
}

function extractText(content: unknown): string {
  if (!Array.isArray(content)) return ''
  const parts: string[] = []
  for (const block of content) {
    if (!block || typeof block !== 'object') continue
    const item = block as { type?: unknown; text?: unknown }
    if (item.type === 'text' && typeof item.text === 'string') {
      parts.push(item.text)
    }
  }
  return parts.join('\n').trim()
}

async function consumeSseStream(
  body: ReadableStream<Uint8Array>,
  onChunk: (text: string) => void
): Promise<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''

  const handleEventData = (data: string): void => {
    if (!data || data === '[DONE]') return

    let parsed: StreamDelta
    try {
      parsed = JSON.parse(data) as StreamDelta
    } catch {
      return
    }

    if (parsed.type === 'error') {
      const message =
        typeof parsed.error?.message === 'string' && parsed.error.message
          ? parsed.error.message
          : 'Claude stream error.'
      throw new Error(message)
    }

    if (
      parsed.type === 'content_block_delta' &&
      parsed.delta?.type === 'text_delta' &&
      typeof parsed.delta.text === 'string' &&
      parsed.delta.text.length > 0
    ) {
      fullText += parsed.delta.text
      onChunk(parsed.delta.text)
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n')
    buffer = parts.pop() ?? ''

    for (const line of parts) {
      const trimmed = line.trimEnd()
      if (trimmed.startsWith('data:')) {
        handleEventData(trimmed.slice(5).trimStart())
      }
    }
  }

  if (buffer.trim()) {
    const trimmed = buffer.trim()
    if (trimmed.startsWith('data:')) {
      handleEventData(trimmed.slice(5).trimStart())
    }
  }

  return fullText.trim()
}

/**
 * Cheap Haiku check: how should we attach the current tab?
 * Defaults toward TEXT (or IMAGE if no URL) on failure so page-dependent questions still work.
 */
export async function decidePageContextMode(
  apiKeys: ApiKeyStore,
  messages: AiChatMessage[],
  pageMeta?: PageMeta | null
): Promise<AiPageContextMode> {
  const apiKey = apiKeys.getClaudeKey()
  const hasUrl = Boolean(pageMeta?.url?.trim())
  if (!apiKey) return hasUrl ? 'text' : 'image'

  const cleaned = cleanMessages(messages)
  const latestUser = [...cleaned].reverse().find((message) => message.role === 'user')
  if (!latestUser) return 'none'

  const recent = cleaned.slice(-4)
  const transcript = recent
    .map((message) => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}`)
    .join('\n')

  const pageLine =
    pageMeta && (pageMeta.title || pageMeta.url)
      ? `Current tab title: ${pageMeta.title || 'Untitled'}\nCurrent tab URL: ${pageMeta.url || '(none)'}`
      : 'Current tab: (unknown / empty)'

  const prompt = `${pageLine}

Recent chat:
${transcript}

Decide what page context the assistant needs for the latest user message.

Reply with exactly one word: NONE, TEXT, or IMAGE.

Prefer TEXT whenever the answer can come from the page's readable text (articles, homework, exercises, problems, definitions, "solve this", "explain this page", summarizing).
Use IMAGE only when the answer depends on visuals that text cannot capture: diagrams, charts, layout, UI, handwriting, scanned worksheets, or "what does this look like".
Use NONE for general knowledge, math typed in the chat, pasted code, or chit-chat that does not need the open webpage.

Default when unsure: TEXT if a webpage is open, otherwise IMAGE.`

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION
      },
      body: JSON.stringify({
        model: CLAUDE_ROUTER_MODEL,
        max_tokens: 8,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    if (!response.ok) return hasUrl ? 'text' : 'image'

    const payload = (await response.json()) as { content?: unknown }
    const raw = extractText(payload.content).toUpperCase()
    const token = raw.trim().split(/\s+/)[0]?.replace(/[^A-Z]/g, '') ?? ''
    if (token === 'NONE') return 'none'
    if (token === 'TEXT') return 'text'
    if (token === 'IMAGE' || token === 'SCREENSHOT') return 'image'
    if (/\bNONE\b/.test(raw) && !/\bTEXT\b/.test(raw) && !/\bIMAGE\b/.test(raw)) return 'none'
    if (/\bTEXT\b/.test(raw) && !/\bIMAGE\b/.test(raw)) return 'text'
    if (/\bIMAGE\b/.test(raw) || /\bSCREENSHOT\b/.test(raw)) return 'image'
    return hasUrl ? 'text' : 'image'
  } catch {
    return hasUrl ? 'text' : 'image'
  }
}

export async function sendClaudeChat(
  apiKeys: ApiKeyStore,
  messages: AiChatMessage[],
  pageContext?: AiPageContext | null,
  onChunk?: (text: string) => void
): Promise<AiChatResponse | AiChatError> {
  const apiKey = apiKeys.getClaudeKey()
  if (!apiKey) {
    return { error: 'Add your Claude API key in Settings to use the AI assistant.' }
  }

  const cleaned = cleanMessages(messages)

  if (cleaned.length === 0) {
    return { error: 'Message cannot be empty.' }
  }

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 2048,
        stream: true,
        messages: buildApiMessages(cleaned, pageContext)
      })
    })

    if (!response.ok) {
      return { error: await readErrorMessage(response) }
    }

    if (!response.body) {
      return { error: 'Claude returned an empty stream.' }
    }

    const text = await consumeSseStream(response.body, (chunk) => {
      onChunk?.(chunk)
    })

    if (!text) {
      return { error: 'Claude returned an empty response.' }
    }

    return { text }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reach Claude API.'
    return { error: message }
  }
}
