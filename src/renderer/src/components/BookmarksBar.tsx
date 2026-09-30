import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { BookmarkNode, BookmarksState } from '../../../shared/ipc'

function barChildren(state: BookmarksState | null): BookmarkNode[] {
  if (!state) return []
  const bar = state.nodes[state.barId]
  if (!bar || bar.type !== 'folder') return []
  return bar.children
    .map((id) => state.nodes[id])
    .filter((node): node is BookmarkNode => Boolean(node))
}

function folderChildren(state: BookmarksState, folderId: string): BookmarkNode[] {
  const folder = state.nodes[folderId]
  if (!folder || folder.type !== 'folder') return []
  return folder.children
    .map((id) => state.nodes[id])
    .filter((node): node is BookmarkNode => Boolean(node))
}

function Favicon({ node }: { node: BookmarkNode }): React.JSX.Element {
  if (node.type === 'folder') {
    return (
      <span className="bookmarks-bar-folder-icon" aria-hidden="true">
        <svg width="12" height="12" viewBox="0 0 16 16">
          <path
            d="M2 4.5A1.5 1.5 0 0 1 3.5 3H6l1.2 1.2H12.5A1.5 1.5 0 0 1 14 5.7v5.8A1.5 1.5 0 0 1 12.5 13h-9A1.5 1.5 0 0 1 2 11.5v-7Z"
            fill="currentColor"
            opacity="0.7"
          />
        </svg>
      </span>
    )
  }
  if (node.favicon) {
    return <img className="bookmarks-bar-favicon" src={node.favicon} alt="" />
  }
  const letter = (node.title || node.url).trim().charAt(0).toUpperCase() || '?'
  return (
    <span className="bookmarks-bar-favicon-fallback" aria-hidden="true">
      {letter}
    </span>
  )
}

type FolderMenuProps = {
  state: BookmarksState
  folderId: string
  path: string[]
  openPath: string[]
  onOpenPath: (path: string[]) => void
  onNavigate: (url: string) => void
  depth: number
}

function FolderMenu({
  state,
  folderId,
  path,
  openPath,
  onOpenPath,
  onNavigate,
  depth
}: FolderMenuProps): React.JSX.Element {
  const children = folderChildren(state, folderId)
  return (
    <div className="bookmarks-folder-menu" role="menu" style={{ zIndex: 60 + depth }}>
      {children.length === 0 ? (
        <div className="bookmarks-folder-empty">Empty folder</div>
      ) : (
        children.map((node) => {
          if (node.type === 'bookmark') {
            return (
              <button
                key={node.id}
                type="button"
                role="menuitem"
                className="bookmarks-folder-item"
                onClick={() => {
                  onOpenPath([])
                  onNavigate(node.url)
                }}
              >
                <Favicon node={node} />
                <span className="bookmarks-bar-label">{node.title || node.url}</span>
              </button>
            )
          }

          const childPath = [...path, node.id]
          const isOpen =
            openPath.length >= childPath.length &&
            childPath.every((id, index) => openPath[index] === id)

          return (
            <div key={node.id} className="bookmarks-folder-item-wrap">
              <button
                type="button"
                role="menuitem"
                className={`bookmarks-folder-item${isOpen ? ' is-open' : ''}`}
                onClick={() => onOpenPath(isOpen ? path : childPath)}
                onMouseEnter={() => onOpenPath(childPath)}
              >
                <Favicon node={node} />
                <span className="bookmarks-bar-label">{node.title}</span>
                <span className="bookmarks-folder-chevron" aria-hidden="true">
                  ›
                </span>
              </button>
              {isOpen ? (
                <div className="bookmarks-folder-flyout">
                  <FolderMenu
                    state={state}
                    folderId={node.id}
                    path={childPath}
                    openPath={openPath}
                    onOpenPath={onOpenPath}
                    onNavigate={onNavigate}
                    depth={depth + 1}
                  />
                </div>
              ) : null}
            </div>
          )
        })
      )}
    </div>
  )
}

type Props = {
  onNavigate: (url: string) => void
}

export function BookmarksBar({ onNavigate }: Props): React.JSX.Element | null {
  const [state, setState] = useState<BookmarksState | null>(null)
  const [openPath, setOpenPath] = useState<string[]>([])
  const barRef = useRef<HTMLDivElement>(null)
  const items = barChildren(state)
  const menuOpen = openPath.length > 0

  useEffect(() => {
    void window.lockin.getBookmarksState().then(setState)
    return window.lockin.onBookmarksUpdated(setState)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('bookmarks-bar-visible', items.length > 0)
    return () => {
      document.documentElement.classList.remove('bookmarks-bar-visible')
    }
  }, [items.length])

  useLayoutEffect(() => {
    if (menuOpen) {
      document.documentElement.classList.add('app-menu-open')
      void window.lockin.setAppMenuOpen(true)
      return () => {
        const navStillOpen = document.querySelector(
          '.app-menu-dropdown, .downloads-dropdown, .omnibox-suggestions'
        )
        const passwordOpen = document.documentElement.classList.contains('password-save-open')
        if (!navStillOpen && !passwordOpen) {
          document.documentElement.classList.remove('app-menu-open')
          void window.lockin.setAppMenuOpen(false)
        }
      }
    }
    return undefined
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return

    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (barRef.current?.contains(target)) return
      setOpenPath([])
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpenPath([])
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  if (items.length === 0) {
    return null
  }

  return (
    <>
      <div className="bookmarks-bar" ref={barRef}>
        <div className="bookmarks-bar-items">
          {items.map((node) => {
            if (node.type === 'bookmark') {
              return (
                <button
                  key={node.id}
                  type="button"
                  className="bookmarks-bar-item"
                  title={node.url}
                  onClick={() => {
                    setOpenPath([])
                    onNavigate(node.url)
                  }}
                >
                  <Favicon node={node} />
                  <span className="bookmarks-bar-label">{node.title || node.url}</span>
                </button>
              )
            }

            const isOpen = openPath[0] === node.id
            return (
              <div key={node.id} className="bookmarks-bar-folder">
                <button
                  type="button"
                  className={`bookmarks-bar-item${isOpen ? ' is-open' : ''}`}
                  aria-haspopup="menu"
                  aria-expanded={isOpen}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setOpenPath(isOpen ? [] : [node.id])}
                >
                  <Favicon node={node} />
                  <span className="bookmarks-bar-label">{node.title}</span>
                </button>
                {isOpen && state ? (
                  <FolderMenu
                    state={state}
                    folderId={node.id}
                    path={[node.id]}
                    openPath={openPath}
                    onOpenPath={setOpenPath}
                    onNavigate={onNavigate}
                    depth={0}
                  />
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
      {menuOpen ? (
        <button
          type="button"
          className="app-menu-backdrop"
          aria-label="Close bookmarks menu"
          onClick={() => setOpenPath([])}
        />
      ) : null}
    </>
  )
}
