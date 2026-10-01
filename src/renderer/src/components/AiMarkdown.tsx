import { useMemo } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import type { PluggableList } from 'unified'
import 'katex/dist/katex.min.css'

type Props = {
  content: string
  /** While streaming, avoid unclosed $$ eating the rest of the message. */
  streaming?: boolean
}

const remarkPlugins: PluggableList = [remarkGfm, remarkMath]
const rehypePlugins: PluggableList = [
  [rehypeKatex, { throwOnError: false, strict: 'ignore', errorColor: '#b45309' }]
]

const components: Components = {
  a: ({ href, children }) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault()
        if (!href) return
        void window.lockin.createTab(href)
      }}
    >
      {children}
    </a>
  )
}

/**
 * Claude often emits \(...\) / \[...\] and also glues $$ to content:
 *   $$\begin{cases}...\end{cases}$$
 * remark-math only treats $$ as display math when the fences are on their
 * own lines — otherwise the block never closes and KaTeX paints everything red.
 */
function normalizeMathDelimiters(markdown: string, streaming: boolean): string {
  const parts = markdown.split(/(```[\s\S]*?```|`[^`\n]+`)/g)
  const normalized = parts
    .map((part, index) => {
      if (index % 2 === 1) return part

      let text = part
        .replace(/\\\[([\s\S]*?)\\\]/g, (_match, expr: string) => `$$\n${expr.trim()}\n$$`)
        .replace(/\\\(([\s\S]*?)\\\)/g, (_match, expr: string) => `$${expr.trim()}$`)

      // Keep $$ fences on their own lines (remark-math display-math requirement).
      // Use a function replacer — in replacement strings "$$" means a literal "$".
      text = text.replace(/\$\$([^\n$])/g, (_match, ch: string) => `$$\n${ch}`)
      text = text.replace(/([^\n$])\$\$/g, (_match, ch: string) => `${ch}\n$$`)

      return text
    })
    .join('')

  if (!streaming) return normalized

  // Unclosed display-math fence: close it so prose after isn't swallowed.
  const dollars = normalized.match(/\$\$/g)
  if (dollars && dollars.length % 2 === 1) {
    return `${normalized}\n$$`
  }
  return normalized
}

export function AiMarkdown({ content, streaming = false }: Props): React.JSX.Element {
  const source = useMemo(
    () => normalizeMathDelimiters(content, streaming),
    [content, streaming]
  )

  return (
    <div className="ai-markdown">
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {source}
      </ReactMarkdown>
    </div>
  )
}
