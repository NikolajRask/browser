import { useEffect, useRef, useState } from 'react'
import type { NavState, SplitSide, TabInfo } from '../../shared/ipc'
import { TabBar } from './components/TabBar'
import { NavBar } from './components/NavBar'
import { FindBar } from './components/FindBar'
import { SavePasswordPrompt } from './components/SavePasswordPrompt'
import { SplitDropOverlay } from './components/SplitDropOverlay'

const emptyNav: NavState = {
  url: '',
  canGoBack: false,
  canGoForward: false
}

export default function App(): React.JSX.Element {
  const [tabs, setTabs] = useState<TabInfo[]>([])
  const [nav, setNav] = useState<NavState>(emptyNav)
  const [findOpen, setFindOpen] = useState(false)
  const [findFocusKey, setFindFocusKey] = useState(0)
  const [splitDraggingId, setSplitDraggingId] = useState<string | null>(null)
  const splitDraggingIdRef = useRef<string | null>(null)

  useEffect(() => {
    document.documentElement.dataset.platform = window.lockin.platform

    void window.lockin.getTabs().then(setTabs)

    const offTabs = window.lockin.onTabsUpdated(setTabs)
    const offNav = window.lockin.onNavState(setNav)
    const offFind = window.lockin.onOpenFind((open) => {
      document.documentElement.classList.toggle('find-open', open)
      setFindOpen(open)
      if (open) setFindFocusKey((key) => key + 1)
    })

    return () => {
      offTabs()
      offNav()
      offFind()
    }
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('split-drag-active', Boolean(splitDraggingId))
  }, [splitDraggingId])

  useEffect(() => {
    document.documentElement.classList.toggle('find-open', findOpen)
  }, [findOpen])

  const beginSplitDrag = (id: string): void => {
    splitDraggingIdRef.current = id
    setSplitDraggingId(id)
    void window.lockin.beginSplitDrag(id)
  }

  const endSplitDrag = (): void => {
    splitDraggingIdRef.current = null
    setSplitDraggingId(null)
    void window.lockin.endSplitDrag()
  }

  const enterSplit = (side: SplitSide): void => {
    const tabId = splitDraggingIdRef.current
    if (!tabId) return
    void window.lockin.enterSplit(tabId, side)
    splitDraggingIdRef.current = null
    setSplitDraggingId(null)
  }

  return (
    <div className="chrome">
      <header className="chrome-header">
        <TabBar
          tabs={tabs}
          onCreate={() => void window.lockin.createTab()}
          onActivate={(id) => void window.lockin.activateTab(id)}
          onClose={(id) => void window.lockin.closeTab(id)}
          onReorder={(fromId, toId, position) =>
            void window.lockin.reorderTab(fromId, toId, position)
          }
          onSplitDragStart={beginSplitDrag}
          onSplitDragEnd={endSplitDrag}
        />
      </header>
      <NavBar
        url={nav.url}
        canGoBack={nav.canGoBack}
        canGoForward={nav.canGoForward}
        onBack={() => void window.lockin.goBack()}
        onForward={() => void window.lockin.goForward()}
        onReload={() => void window.lockin.reload()}
        onNavigate={(url) => void window.lockin.navigate(url)}
      />
      <SavePasswordPrompt />
      <FindBar open={findOpen} focusKey={findFocusKey} onClose={() => setFindOpen(false)} />
      {splitDraggingId ? <SplitDropOverlay onDropSide={enterSplit} /> : null}
    </div>
  )
}
