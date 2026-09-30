import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { TodoItem, TodosState } from '../../../shared/ipc'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onBeforeOpen: () => void
}

const EMPTY_STATE: TodosState = {
  version: 1,
  folders: {},
  todos: {},
  folderOrder: []
}

function sortTodos(items: TodoItem[]): TodoItem[] {
  return [...items].sort((a, b) => b.createdAt - a.createdAt)
}

export function TodosMenu({ open, onOpenChange, onBeforeOpen }: Props): React.JSX.Element {
  const [state, setState] = useState<TodosState>(EMPTY_STATE)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void window.lockin.getTodosState().then(setState)
    return window.lockin.onTodosUpdated(setState)
  }, [])

  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open])

  const { openTodos, completedTodos, openCount } = useMemo(() => {
    const all = Object.values(state.todos)
    const openItems = sortTodos(all.filter((todo) => !todo.completed))
    const completedItems = sortTodos(all.filter((todo) => todo.completed)).slice(0, 8)
    return {
      openTodos: openItems,
      completedTodos: completedItems,
      openCount: openItems.length
    }
  }, [state.todos])

  const defaultFolderId = state.folderOrder[0] ?? Object.keys(state.folders)[0] ?? null
  const statusLabel = openCount === 0 ? 'All done' : `${openCount} open`
  const statusClass = openCount === 0 ? 'is-done' : 'is-active'

  const submitTodo = (): void => {
    const title = draft.trim()
    if (!title || !defaultFolderId) return
    setDraft('')
    void window.lockin.addTodo({ folderId: defaultFolderId, title })
  }

  const onSubmit = (event: FormEvent): void => {
    event.preventDefault()
    submitTodo()
  }

  const onDraftKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onOpenChange(false)
    }
  }

  return (
    <div className="todos-menu">
      <button
        type="button"
        className={`todos-button${open ? ' is-open' : ''}${openCount > 0 ? ' is-active' : ''}`}
        aria-label={openCount > 0 ? `Todos, ${openCount} open` : 'Todos'}
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
            x="2.5"
            y="2.5"
            width="11"
            height="11"
            rx="2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path
            d="M5 8.1 6.9 10l4.1-4.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {openCount > 0 ? <span className="todos-badge">{openCount > 99 ? '99+' : openCount}</span> : null}
      </button>
      {open ? (
        <div className="todos-dropdown" role="dialog" aria-label="Todos">
          <div className="todos-header">
            <span className="todos-title">Todos</span>
            <span className={`todos-status ${statusClass}`}>
              <span className="todos-status-dot" aria-hidden="true" />
              {statusLabel}
            </span>
          </div>

          <form className="todos-composer" onSubmit={onSubmit}>
            <input
              ref={inputRef}
              className="todos-input"
              type="text"
              value={draft}
              placeholder="Add a todo"
              spellCheck={false}
              autoComplete="off"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onDraftKeyDown}
            />
            <button
              type="submit"
              className="todos-add"
              disabled={!draft.trim() || !defaultFolderId}
            >
              Add
            </button>
          </form>

          {openTodos.length === 0 && completedTodos.length === 0 ? (
            <div className="todos-empty">No todos yet</div>
          ) : (
            <ul className="todos-list">
              {openTodos.map((todo) => (
                <li key={todo.id} className="todos-item">
                  <button
                    type="button"
                    className="todos-check"
                    aria-label={`Mark "${todo.title}" complete`}
                    onClick={() => void window.lockin.toggleTodo(todo.id)}
                  />
                  <span className="todos-item-title">{todo.title}</span>
                  <button
                    type="button"
                    className="todos-remove"
                    aria-label={`Remove "${todo.title}"`}
                    onClick={() => void window.lockin.removeTodo(todo.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
              {completedTodos.map((todo) => (
                <li key={todo.id} className="todos-item is-completed">
                  <button
                    type="button"
                    className="todos-check is-checked"
                    aria-label={`Mark "${todo.title}" incomplete`}
                    onClick={() => void window.lockin.toggleTodo(todo.id)}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                      <path
                        d="M2 5.2 4.1 7.2 8 2.8"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <span className="todos-item-title">{todo.title}</span>
                  <button
                    type="button"
                    className="todos-remove"
                    aria-label={`Remove "${todo.title}"`}
                    onClick={() => void window.lockin.removeTodo(todo.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            className="todos-footer"
            onClick={() => {
              onOpenChange(false)
              void window.lockin.openTodosPage()
            }}
          >
            Open todos
          </button>
        </div>
      ) : null}
    </div>
  )
}
