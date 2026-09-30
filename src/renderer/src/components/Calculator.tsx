import { useEffect, useRef, useState } from 'react'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onBeforeOpen: () => void
}

type AngleMode = 'deg' | 'rad'
type HistoryItem = { id: string; expression: string; result: string }

type PersistedState = {
  expression: string
  result: string
  ans: number
  angleMode: AngleMode
  history: HistoryItem[]
}

const STORAGE_KEY = 'lockin.calculator.scientific'
const MAX_HISTORY = 8

type Token =
  | { kind: 'number'; value: number }
  | { kind: 'op'; value: string }
  | { kind: 'func'; value: string }
  | { kind: 'const'; value: string }
  | { kind: 'paren'; value: '(' | ')' }
  | { kind: 'post'; value: '!' | '%' }

const FUNC_NAMES = [
  'asin',
  'acos',
  'atan',
  'sin',
  'cos',
  'tan',
  'ln',
  'log',
  'sqrt',
  'exp10',
  'exp'
] as const

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return 'Error'
  const abs = Math.abs(value)
  if (abs !== 0 && (abs >= 1e12 || abs < 1e-9)) {
    return value
      .toExponential(8)
      .replace(/(\.\d*?)0+e/, '$1e')
      .replace(/\.e/, 'e')
  }
  const rounded = Number(value.toPrecision(12))
  if (!Number.isFinite(rounded)) return 'Error'
  return String(rounded)
}

function formatGrouped(raw: string): string {
  if (raw === 'Error' || raw.includes('e') || raw.includes('E')) return raw
  const negative = raw.startsWith('-')
  const body = negative ? raw.slice(1) : raw
  const [intPart, fracPart] = body.split('.')
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const withFrac = fracPart !== undefined ? `${grouped}.${fracPart}` : grouped
  return negative ? `-${withFrac}` : withFrac
}

function factorial(n: number): number {
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n) || n > 170) return Number.NaN
  let result = 1
  for (let i = 2; i <= n; i += 1) result *= i
  return result
}

function toRadians(value: number, mode: AngleMode): number {
  return mode === 'deg' ? (value * Math.PI) / 180 : value
}

function fromRadians(value: number, mode: AngleMode): number {
  return mode === 'deg' ? (value * 180) / Math.PI : value
}

function tokenize(input: string): Token[] | null {
  const src = input
    .replace(/π/g, 'pi')
    .replace(/√/g, 'sqrt')
    .replace(/÷/g, '/')
    .replace(/×/g, '*')
    .replace(/−/g, '-')
    .replace(/\s+/g, '')

  const tokens: Token[] = []
  let i = 0

  while (i < src.length) {
    const ch = src[i]

    if (/[0-9.]/.test(ch)) {
      let end = i + 1
      while (end < src.length && /[0-9.]/.test(src[end])) end += 1
      if (src.slice(i, end).split('.').length > 2) return null
      const value = Number(src.slice(i, end))
      if (!Number.isFinite(value)) return null
      tokens.push({ kind: 'number', value })
      i = end
      continue
    }

    if (ch === '(' || ch === ')') {
      tokens.push({ kind: 'paren', value: ch })
      i += 1
      continue
    }

    if (ch === '!' || ch === '%') {
      tokens.push({ kind: 'post', value: ch })
      i += 1
      continue
    }

    if ('+-*/^'.includes(ch)) {
      tokens.push({ kind: 'op', value: ch })
      i += 1
      continue
    }

    let matched = false
    for (const name of FUNC_NAMES) {
      if (src.startsWith(name, i)) {
        tokens.push({ kind: 'func', value: name })
        i += name.length
        matched = true
        break
      }
    }
    if (matched) continue

    if (src.startsWith('pi', i)) {
      tokens.push({ kind: 'const', value: 'pi' })
      i += 2
      continue
    }

    if (src.startsWith('ans', i)) {
      tokens.push({ kind: 'const', value: 'ans' })
      i += 3
      continue
    }

    if (ch === 'e' && (i + 1 >= src.length || !/[a-z]/i.test(src[i + 1]))) {
      tokens.push({ kind: 'const', value: 'e' })
      i += 1
      continue
    }

    return null
  }

  return tokens
}

function insertImplicitMultiply(tokens: Token[]): Token[] {
  const out: Token[] = []
  for (let i = 0; i < tokens.length; i += 1) {
    const prev = out[out.length - 1]
    const curr = tokens[i]
    if (
      prev &&
      curr &&
      ((prev.kind === 'number' ||
        prev.kind === 'const' ||
        prev.kind === 'post' ||
        (prev.kind === 'paren' && prev.value === ')')) &&
        (curr.kind === 'number' ||
          curr.kind === 'const' ||
          curr.kind === 'func' ||
          (curr.kind === 'paren' && curr.value === '(')))
    ) {
      out.push({ kind: 'op', value: '*' })
    }
    out.push(curr)
  }
  return out
}

function precedence(op: string): number {
  if (op === '+' || op === '-') return 1
  if (op === '*' || op === '/') return 2
  if (op === '^') return 3
  if (op === 'u-') return 4
  return 0
}

function isRightAssociative(op: string): boolean {
  return op === '^' || op === 'u-'
}

function toRpn(tokens: Token[]): Token[] | null {
  const output: Token[] = []
  const stack: Token[] = []

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]
    const prev = tokens[i - 1]

    if (token.kind === 'number' || token.kind === 'const') {
      output.push(token)
      continue
    }

    if (token.kind === 'func') {
      stack.push(token)
      continue
    }

    if (token.kind === 'post') {
      output.push(token)
      continue
    }

    if (token.kind === 'op') {
      let op = token.value
      const unary =
        op === '-' &&
        (!prev ||
          prev.kind === 'op' ||
          (prev.kind === 'paren' && prev.value === '(') ||
          prev.kind === 'func')
      if (unary) op = 'u-'
      if (op === '+' && unary) continue

      while (stack.length > 0) {
        const top = stack[stack.length - 1]
        if (!top || top.kind !== 'op') break
        const topOp = top.value
        const shouldPop = isRightAssociative(op)
          ? precedence(op) < precedence(topOp)
          : precedence(op) <= precedence(topOp)
        if (!shouldPop) break
        output.push(stack.pop() as Token)
      }
      stack.push({ kind: 'op', value: op })
      continue
    }

    if (token.kind === 'paren' && token.value === '(') {
      stack.push(token)
      continue
    }

    if (token.kind === 'paren' && token.value === ')') {
      let found = false
      while (stack.length > 0) {
        const top = stack.pop()
        if (!top) break
        if (top.kind === 'paren' && top.value === '(') {
          found = true
          break
        }
        output.push(top)
      }
      if (!found) return null
      const maybeFunc = stack[stack.length - 1]
      if (maybeFunc?.kind === 'func') {
        output.push(stack.pop() as Token)
      }
    }
  }

  while (stack.length > 0) {
    const top = stack.pop()
    if (!top || top.kind === 'paren') return null
    output.push(top)
  }

  return output
}

function applyFunc(name: string, value: number, mode: AngleMode): number {
  switch (name) {
    case 'sin':
      return Math.sin(toRadians(value, mode))
    case 'cos':
      return Math.cos(toRadians(value, mode))
    case 'tan':
      return Math.tan(toRadians(value, mode))
    case 'asin':
      return fromRadians(Math.asin(value), mode)
    case 'acos':
      return fromRadians(Math.acos(value), mode)
    case 'atan':
      return fromRadians(Math.atan(value), mode)
    case 'ln':
      return Math.log(value)
    case 'log':
      return Math.log10(value)
    case 'sqrt':
      return Math.sqrt(value)
    case 'exp':
      return Math.exp(value)
    case 'exp10':
      return 10 ** value
    default:
      return Number.NaN
  }
}

function evaluateRpn(rpn: Token[], ans: number, mode: AngleMode): number {
  const stack: number[] = []

  for (const token of rpn) {
    if (token.kind === 'number') {
      stack.push(token.value)
      continue
    }

    if (token.kind === 'const') {
      if (token.value === 'pi') stack.push(Math.PI)
      else if (token.value === 'e') stack.push(Math.E)
      else if (token.value === 'ans') stack.push(ans)
      else return Number.NaN
      continue
    }

    if (token.kind === 'post') {
      const value = stack.pop()
      if (value === undefined) return Number.NaN
      stack.push(token.value === '!' ? factorial(value) : value / 100)
      continue
    }

    if (token.kind === 'func') {
      const value = stack.pop()
      if (value === undefined) return Number.NaN
      stack.push(applyFunc(token.value, value, mode))
      continue
    }

    if (token.kind === 'op') {
      if (token.value === 'u-') {
        const value = stack.pop()
        if (value === undefined) return Number.NaN
        stack.push(-value)
        continue
      }

      const right = stack.pop()
      const left = stack.pop()
      if (left === undefined || right === undefined) return Number.NaN

      switch (token.value) {
        case '+':
          stack.push(left + right)
          break
        case '-':
          stack.push(left - right)
          break
        case '*':
          stack.push(left * right)
          break
        case '/':
          stack.push(right === 0 ? Number.NaN : left / right)
          break
        case '^':
          stack.push(left ** right)
          break
        default:
          return Number.NaN
      }
    }
  }

  if (stack.length !== 1) return Number.NaN
  return stack[0]
}

function evaluateExpression(input: string, ans: number, mode: AngleMode): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const tokens = tokenize(trimmed)
  if (!tokens) return Number.NaN
  const withImplicit = insertImplicitMultiply(tokens)
  const rpn = toRpn(withImplicit)
  if (!rpn) return Number.NaN
  return evaluateRpn(rpn, ans, mode)
}

function loadState(): PersistedState {
  const fallback: PersistedState = {
    expression: '',
    result: '0',
    ans: 0,
    angleMode: 'deg',
    history: []
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<PersistedState>
    return {
      expression: typeof parsed.expression === 'string' ? parsed.expression : '',
      result: typeof parsed.result === 'string' ? parsed.result : '0',
      ans: typeof parsed.ans === 'number' && Number.isFinite(parsed.ans) ? parsed.ans : 0,
      angleMode: parsed.angleMode === 'rad' ? 'rad' : 'deg',
      history: Array.isArray(parsed.history)
        ? parsed.history
            .filter(
              (item): item is HistoryItem =>
                !!item &&
                typeof item.id === 'string' &&
                typeof item.expression === 'string' &&
                typeof item.result === 'string'
            )
            .slice(0, MAX_HISTORY)
        : []
    }
  } catch {
    return fallback
  }
}

type KeyDef = {
  id: string
  label: string
  insert?: string
  action?: 'ac' | 'equals' | 'backspace' | 'ans' | 'inv' | 'deg' | 'rad' | 'exp'
  className?: string
  invLabel?: string
  invInsert?: string
}

const KEYS: KeyDef[] = [
  { id: 'deg', label: 'Deg', action: 'deg', className: 'is-mode' },
  { id: 'rad', label: 'Rad', action: 'rad', className: 'is-mode' },
  { id: 'fact', label: 'x!', insert: '!' },
  { id: '(', label: '(', insert: '(' },
  { id: ')', label: ')', insert: ')' },
  { id: '%', label: '%', insert: '%' },
  { id: 'ac', label: 'AC', action: 'ac', className: 'is-muted' },

  {
    id: 'inv',
    label: 'Inv',
    action: 'inv',
    className: 'is-mode'
  },
  {
    id: 'sin',
    label: 'sin',
    insert: 'sin(',
    invLabel: 'sin⁻¹',
    invInsert: 'asin('
  },
  {
    id: 'ln',
    label: 'ln',
    insert: 'ln(',
    invLabel: 'eˣ',
    invInsert: 'exp('
  },
  { id: '7', label: '7', insert: '7' },
  { id: '8', label: '8', insert: '8' },
  { id: '9', label: '9', insert: '9' },
  { id: '÷', label: '÷', insert: '÷', className: 'is-op' },

  { id: 'pi', label: 'π', insert: 'π' },
  {
    id: 'cos',
    label: 'cos',
    insert: 'cos(',
    invLabel: 'cos⁻¹',
    invInsert: 'acos('
  },
  {
    id: 'log',
    label: 'log',
    insert: 'log(',
    invLabel: '10ˣ',
    invInsert: '10^'
  },
  { id: '4', label: '4', insert: '4' },
  { id: '5', label: '5', insert: '5' },
  { id: '6', label: '6', insert: '6' },
  { id: '×', label: '×', insert: '×', className: 'is-op' },

  { id: 'e', label: 'e', insert: 'e' },
  {
    id: 'tan',
    label: 'tan',
    insert: 'tan(',
    invLabel: 'tan⁻¹',
    invInsert: 'atan('
  },
  {
    id: 'sqrt',
    label: '√',
    insert: '√(',
    invLabel: 'x²',
    invInsert: '^(2)'
  },
  { id: '1', label: '1', insert: '1' },
  { id: '2', label: '2', insert: '2' },
  { id: '3', label: '3', insert: '3' },
  { id: '−', label: '−', insert: '−', className: 'is-op' },

  { id: 'ans', label: 'Ans', action: 'ans', className: 'is-muted' },
  { id: 'exp', label: 'EXP', action: 'exp', className: 'is-muted' },
  {
    id: 'pow',
    label: 'xʸ',
    insert: '^',
    invLabel: 'ʸ√x',
    invInsert: '^(1÷'
  },
  { id: '0', label: '0', insert: '0' },
  { id: '.', label: '.', insert: '.' },
  { id: '=', label: '=', action: 'equals', className: 'is-equals' },
  { id: '+', label: '+', insert: '+', className: 'is-op' }
]

export function Calculator({ open, onOpenChange, onBeforeOpen }: Props): React.JSX.Element {
  const initial = useRef(loadState()).current
  const [expression, setExpression] = useState(initial.expression)
  const [result, setResult] = useState(initial.result)
  const [ans, setAns] = useState(initial.ans)
  const [angleMode, setAngleMode] = useState<AngleMode>(initial.angleMode)
  const [inverse, setInverse] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>(initial.history)
  const [pressedKey, setPressedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [justEvaluated, setJustEvaluated] = useState(false)
  const pressTimer = useRef<number | null>(null)
  const copyTimer = useRef<number | null>(null)
  const stateRef = useRef({ expression, result, ans, angleMode, justEvaluated })

  stateRef.current = { expression, result, ans, angleMode, justEvaluated }

  useEffect(() => {
    const state: PersistedState = { expression, result, ans, angleMode, history }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Ignore quota / private-mode failures.
    }
  }, [expression, result, ans, angleMode, history])

  useEffect(() => {
    return () => {
      if (pressTimer.current) window.clearTimeout(pressTimer.current)
      if (copyTimer.current) window.clearTimeout(copyTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!expression.trim()) {
      setResult('0')
      return
    }
    const value = evaluateExpression(expression, ans, angleMode)
    if (value === null) {
      setResult('0')
      return
    }
    setResult(formatNumber(value))
  }, [expression, ans, angleMode])

  const flashKey = (id: string): void => {
    setPressedKey(id)
    if (pressTimer.current) window.clearTimeout(pressTimer.current)
    pressTimer.current = window.setTimeout(() => setPressedKey(null), 110)
  }

  const clearAll = (): void => {
    setExpression('')
    setResult('0')
    setJustEvaluated(false)
    setInverse(false)
  }

  const pushHistory = (expr: string, value: string): void => {
    if (value === 'Error') return
    setHistory((items) => {
      const next: HistoryItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        expression: expr,
        result: value
      }
      return [next, ...items].slice(0, MAX_HISTORY)
    })
  }

  const insertText = (text: string): void => {
    setExpression((current) => {
      if (stateRef.current.justEvaluated) {
        if (/^[0-9.]/.test(text) || text === 'π' || text === 'e' || text === 'Ans') {
          return text === 'Ans' ? 'Ans' : text
        }
        if (
          text.startsWith('sin') ||
          text.startsWith('cos') ||
          text.startsWith('tan') ||
          text.startsWith('ln') ||
          text.startsWith('log') ||
          text.startsWith('√') ||
          text.startsWith('asin') ||
          text.startsWith('acos') ||
          text.startsWith('atan') ||
          text.startsWith('exp')
        ) {
          return text
        }
        return `Ans${text}`
      }
      return current + text
    })
    setJustEvaluated(false)
  }

  const backspace = (): void => {
    flashKey('⌫')
    if (stateRef.current.justEvaluated) {
      clearAll()
      return
    }
    setExpression((current) => current.slice(0, -1))
  }

  const equals = (): void => {
    flashKey('=')
    const expr = stateRef.current.expression.trim()
    if (!expr) return
    const value = evaluateExpression(expr, stateRef.current.ans, stateRef.current.angleMode)
    const text = formatNumber(value ?? Number.NaN)
    setResult(text)
    if (text !== 'Error' && value !== null && Number.isFinite(value)) {
      setAns(value)
      pushHistory(expr, text)
      setExpression(text)
      setJustEvaluated(true)
    } else {
      setJustEvaluated(false)
    }
    setInverse(false)
  }

  const handleKey = (key: KeyDef): void => {
    flashKey(key.id)

    if (key.action === 'ac') {
      clearAll()
      return
    }
    if (key.action === 'equals') {
      equals()
      return
    }
    if (key.action === 'ans') {
      insertText('Ans')
      return
    }
    if (key.action === 'inv') {
      setInverse((value) => !value)
      return
    }
    if (key.action === 'deg') {
      setAngleMode('deg')
      return
    }
    if (key.action === 'rad') {
      setAngleMode('rad')
      return
    }
    if (key.action === 'exp') {
      insertText('×10^')
      return
    }

    const text = inverse && key.invInsert ? key.invInsert : key.insert
    if (text) {
      insertText(text)
      if (inverse && key.invInsert) setInverse(false)
    }
  }

  const reuseHistory = (item: HistoryItem): void => {
    setExpression(item.result === 'Error' ? '' : item.result)
    setResult(item.result)
    setJustEvaluated(true)
  }

  const copyResult = async (): Promise<void> => {
    if (result === 'Error') return
    try {
      await navigator.clipboard.writeText(result)
      setCopied(true)
      if (copyTimer.current) window.clearTimeout(copyTimer.current)
      copyTimer.current = window.setTimeout(() => setCopied(false), 1200)
    } catch {
      // Clipboard may be unavailable.
    }
  }

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const key = event.key

      if (key === 'Escape') {
        onOpenChange(false)
        return
      }

      if (/^[0-9]$/.test(key)) {
        event.preventDefault()
        flashKey(key)
        insertText(key)
        return
      }

      if (key === '.' || key === ',') {
        event.preventDefault()
        flashKey('.')
        insertText('.')
        return
      }

      if (key === '+') {
        event.preventDefault()
        flashKey('+')
        insertText('+')
        return
      }

      if (key === '-') {
        event.preventDefault()
        flashKey('−')
        insertText('−')
        return
      }

      if (key === '*' || key === 'x' || key === 'X') {
        event.preventDefault()
        flashKey('×')
        insertText('×')
        return
      }

      if (key === '/') {
        event.preventDefault()
        flashKey('÷')
        insertText('÷')
        return
      }

      if (key === '^') {
        event.preventDefault()
        flashKey('pow')
        insertText('^')
        return
      }

      if (key === '(' || key === ')') {
        event.preventDefault()
        flashKey(key)
        insertText(key)
        return
      }

      if (key === '%') {
        event.preventDefault()
        flashKey('%')
        insertText('%')
        return
      }

      if (key === '!' ) {
        event.preventDefault()
        flashKey('fact')
        insertText('!')
        return
      }

      if (key === 'Enter' || key === '=') {
        event.preventDefault()
        equals()
        return
      }

      if (key === 'Backspace') {
        event.preventDefault()
        backspace()
        return
      }

      if (key.toLowerCase() === 'c' || key === 'Delete') {
        event.preventDefault()
        flashKey('ac')
        clearAll()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onOpenChange])

  const livePreview = result === 'Error' && expression.trim() ? '…' : formatGrouped(result)

  return (
    <div className="calculator">
      <button
        type="button"
        className={`calculator-button${open ? ' is-open' : ''}`}
        aria-label="Calculator"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (open) {
            onOpenChange(false)
            return
          }
          onBeforeOpen()
          onOpenChange(true)
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <rect
            x="3"
            y="1.75"
            width="10"
            height="12.5"
            rx="2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <rect x="5" y="3.75" width="6" height="2.2" rx="0.6" fill="currentColor" opacity="0.9" />
          <circle cx="5.4" cy="8.2" r="0.85" fill="currentColor" />
          <circle cx="8" cy="8.2" r="0.85" fill="currentColor" />
          <circle cx="10.6" cy="8.2" r="0.85" fill="currentColor" />
          <circle cx="5.4" cy="11.1" r="0.85" fill="currentColor" />
          <circle cx="8" cy="11.1" r="0.85" fill="currentColor" />
          <circle cx="10.6" cy="11.1" r="0.85" fill="currentColor" />
        </svg>
      </button>
      {open ? (
        <div className="calculator-dropdown is-scientific" role="dialog" aria-label="Calculator">
          <div className="calculator-header">
            <span className="calculator-title">Calculator</span>
            <div className="calculator-header-actions">
              <button
                type="button"
                className="calculator-backspace"
                aria-label="Backspace"
                onClick={backspace}
              >
                ⌫
              </button>
              <button
                type="button"
                className={`calculator-copy${copied ? ' is-copied' : ''}`}
                onClick={() => void copyResult()}
                aria-label={copied ? 'Copied' : 'Copy result'}
                title={copied ? 'Copied' : 'Copy result'}
              >
                {copied ? (
                  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      d="M3.8 8.2 6.6 11l5.6-6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                    <rect
                      x="5.2"
                      y="5.2"
                      width="7.3"
                      height="7.3"
                      rx="1.4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />
                    <path
                      d="M3.5 10.2V3.8A1.3 1.3 0 0 1 4.8 2.5h6.4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="calculator-screen">
            <div className="calculator-expression" aria-live="polite">
              {expression || '\u00a0'}
            </div>
            <div className="calculator-display">{livePreview}</div>
          </div>

          {history.length > 0 ? (
            <div className="calculator-history" aria-label="Recent calculations">
              {history.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="calculator-history-item"
                  onClick={() => reuseHistory(item)}
                  title="Use result"
                >
                  <span>{item.expression}</span>
                  <strong>{formatGrouped(item.result)}</strong>
                </button>
              ))}
            </div>
          ) : null}

          <div className="calculator-pad is-scientific" role="group" aria-label="Calculator keys">
            {KEYS.map((key) => {
              const label = inverse && key.invLabel ? key.invLabel : key.label
              const isActive =
                (key.action === 'deg' && angleMode === 'deg') ||
                (key.action === 'rad' && angleMode === 'rad') ||
                (key.action === 'inv' && inverse)

              return (
                <button
                  key={key.id}
                  type="button"
                  className={`calculator-key${key.className ? ` ${key.className}` : ''}${
                    isActive ? ' is-active' : ''
                  }${pressedKey === key.id ? ' is-pressed' : ''}`}
                  onClick={() => handleKey(key)}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
