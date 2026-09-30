import { useEffect, useRef, useState } from 'react'
import type { NavState, SplitSide, TabInfo } from '../../shared/ipc'
import { TabBar } from './components/TabBar'
import { NavBar } from './components/NavBar'
import { BookmarksBar } from './components/BookmarksBar'
import { FindBar } from './components/FindBar'
import { TabSearcher } from './components/TabSearcher'
import { SavePasswordPrompt } from './components/SavePasswordPrompt'
import { SplitDropOverlay } from './components/SplitDropOverlay'
import { WindowControls } from './components/WindowControls'

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
  const [tabSearchOpen, setTabSearchOpen] = useState(false)
  const [tabSearchFocusKey, setTabSearchFocusKey] = useState(0)
  const [splitDraggingId, setSplitDraggingId] = useState<string | null>(null)
  const [fullScreen, setFullScreen] = useState(false)
  const splitDraggingIdRef = useRef<string | null>(null)
  const isMac = window.lockin.platform === 'darwin'

  useEffect(() => {
    document.documentElement.dataset.platform = window.lockin.platform

    void window.lockin.getTabs().then(setTabs)
    void window.lockin.isFullScreen().then(setFullScreen)

    const offTabs = window.lockin.onTabsUpdated(setTabs)
    const offNav = window.lockin.onNavState(setNav)
    const offFullScreen = window.lockin.onFullScreenChanged(setFullScreen)
    const offFind = window.lockin.onOpenFind((open) => {
      document.documentElement.classList.toggle('find-open', open)
      setFindOpen(open)
      if (open) {
        setTabSearchOpen(false)
        document.documentElement.classList.remove('tab-search-open')
        setFindFocusKey((key) => key + 1)
      }
    })
    const offTabSearch = window.lockin.onOpenTabSearch((open) => {
      document.documentElement.classList.toggle('tab-search-open', open)
      setTabSearchOpen(open)
      if (open) {
        setFindOpen(false)
        document.documentElement.classList.remove('find-open')
        setTabSearchFocusKey((key) => key + 1)
      }
    })

    return () => {
      offTabs()
      offNav()
      offFullScreen()
      offFind()
      offTabSearch()
    }
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('split-drag-active', Boolean(splitDraggingId))
  }, [splitDraggingId])

  useEffect(() => {
    document.documentElement.classList.toggle('find-open', findOpen)
  }, [findOpen])

  useEffect(() => {
    document.documentElement.classList.toggle('tab-search-open', tabSearchOpen)
  }, [tabSearchOpen])

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

  const openTabSearch = (): void => {
    document.documentElement.classList.add('tab-search-open')
    setTabSearchOpen(true)
    setTabSearchFocusKey((key) => key + 1)
  }

  const closeTabSearch = (): void => {
    document.documentElement.classList.remove('tab-search-open')
    setTabSearchOpen(false)
  }

  const toggleTabSearch = (): void => {
    if (tabSearchOpen) {
      void window.lockin.setTabSearchOpen(false)
      closeTabSearch()
      return
    }
    openTabSearch()
  }

  const activeTab = tabs.find((tab) => tab.active)

  return (
    <div className="chrome">
      <header className="chrome-header">
        {isMac ? <WindowControls visible={fullScreen} /> : null}
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
          onSearchTabs={toggleTabSearch}
          searchTabsOpen={tabSearchOpen}
        />
      </header>
      <NavBar
        url={nav.url}
        title={activeTab?.title ?? ''}
        favicon={activeTab?.favicon ?? null}
        canGoBack={nav.canGoBack}
        canGoForward={nav.canGoForward}
        onBack={() => void window.lockin.goBack()}
        onForward={() => void window.lockin.goForward()}
        onReload={() => void window.lockin.reload()}
        onNavigate={(url) => void window.lockin.navigate(url)}
      />
      <BookmarksBar onNavigate={(url) => void window.lockin.navigate(url)} />
      <SavePasswordPrompt />
      <FindBar open={findOpen} focusKey={findFocusKey} onClose={() => setFindOpen(false)} />
      <TabSearcher
        open={tabSearchOpen}
        focusKey={tabSearchFocusKey}
        tabs={tabs}
        onClose={closeTabSearch}
      />
      {splitDraggingId ? <SplitDropOverlay onDropSide={enterSplit} /> : null}
    </div>
  )
}
