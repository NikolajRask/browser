export const HISTORY_PAGE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: https: http:;"
    />
    <title>History</title>
    <style>
      :root {
        color-scheme: light;
        --bg-top: #eef6f4;
        --bg-bottom: #f4f6f8;
        --surface: #ffffff;
        --border: #d7dce3;
        --text: #1f2328;
        --text-muted: #5f6b76;
        --hover: #f3f6f8;
        --danger: #d93025;
        --accent: #0f766e;
        --accent-soft: #d8f3ef;
        --font: 'Segoe UI', 'SF Pro Text', system-ui, sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        min-height: 100%;
        color: var(--text);
        font-family: var(--font);
        background:
          radial-gradient(1200px 480px at 12% -10%, var(--bg-top), transparent 60%),
          linear-gradient(180deg, #f7fafb 0%, var(--bg-bottom) 100%);
      }

      body {
        padding: 40px 24px 64px;
      }

      .shell {
        max-width: 880px;
        margin: 0 auto;
      }

      header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 28px;
      }

      .heading {
        min-width: 0;
      }

      h1 {
        margin: 0;
        font-size: 32px;
        font-weight: 650;
        letter-spacing: -0.03em;
      }

      .subtitle {
        margin: 6px 0 0;
        color: var(--text-muted);
        font-size: 14px;
      }

      .clear-menu {
        position: relative;
        flex-shrink: 0;
      }

      .clear-btn {
        appearance: none;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border: 1px solid var(--border);
        background: var(--surface);
        color: var(--text);
        border-radius: 999px;
        padding: 9px 14px 9px 16px;
        font: inherit;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        box-shadow: 0 1px 2px rgba(31, 35, 40, 0.04);
      }

      .clear-btn:hover:not(:disabled),
      .clear-btn[aria-expanded='true'] {
        background: var(--hover);
        border-color: #c5ccd5;
      }

      .clear-btn:disabled {
        opacity: 0.45;
        cursor: default;
      }

      .clear-btn svg {
        width: 12px;
        height: 12px;
        color: var(--text-muted);
      }

      .clear-dropdown {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        z-index: 20;
        min-width: 188px;
        padding: 6px;
        border: 1px solid var(--border);
        border-radius: 12px;
        background: var(--surface);
        box-shadow: 0 10px 30px rgba(31, 35, 40, 0.12);
      }

      .clear-dropdown button {
        appearance: none;
        display: block;
        width: 100%;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: var(--text);
        text-align: left;
        padding: 9px 12px;
        font: inherit;
        font-size: 13px;
        cursor: pointer;
      }

      .clear-dropdown button:hover {
        background: var(--accent-soft);
        color: var(--accent);
      }

      .clear-dropdown button.danger:hover {
        background: #fce8e6;
        color: var(--danger);
      }

      .empty {
        padding: 56px 20px;
        text-align: center;
        color: var(--text-muted);
        font-size: 14px;
        background: rgba(255, 255, 255, 0.72);
        border: 1px dashed #d0d7de;
        border-radius: 16px;
      }

      .day-block {
        margin-bottom: 22px;
      }

      .day-block:last-child {
        margin-bottom: 0;
      }

      .day-label {
        margin: 0 0 10px 4px;
        font-size: 12px;
        font-weight: 650;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--text-muted);
      }

      .list {
        list-style: none;
        margin: 0;
        padding: 4px;
        background: rgba(255, 255, 255, 0.88);
        border: 1px solid rgba(199, 203, 209, 0.9);
        border-radius: 16px;
        box-shadow: 0 8px 24px rgba(31, 35, 40, 0.04);
        backdrop-filter: blur(8px);
      }

      .item {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 4px;
        padding: 2px;
        border-radius: 12px;
      }

      .item:hover {
        background: var(--hover);
      }

      .open {
        display: grid;
        grid-template-columns: 28px minmax(0, 1fr) auto;
        align-items: center;
        gap: 12px;
        min-width: 0;
        padding: 10px 8px 10px 10px;
        border: 0;
        background: transparent;
        font: inherit;
        color: inherit;
        text-align: left;
        cursor: pointer;
        border-radius: 12px;
      }

      .favicon,
      .favicon-fallback {
        width: 18px;
        height: 18px;
        border-radius: 4px;
      }

      .favicon {
        object-fit: contain;
      }

      .favicon-fallback {
        display: grid;
        place-items: center;
        background: #e8eef1;
        color: var(--text-muted);
        font-size: 10px;
        font-weight: 700;
      }

      .meta {
        min-width: 0;
      }

      .title {
        font-size: 14px;
        font-weight: 560;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .url {
        margin-top: 2px;
        font-size: 12px;
        color: var(--text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .time {
        font-size: 12px;
        color: var(--text-muted);
        white-space: nowrap;
        padding-right: 4px;
      }

      .delete {
        appearance: none;
        width: 30px;
        height: 30px;
        border: 0;
        border-radius: 50%;
        background: transparent;
        color: var(--text-muted);
        font-size: 18px;
        line-height: 1;
        cursor: pointer;
      }

      .delete:hover {
        background: #fce8e6;
        color: var(--danger);
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <header>
        <div class="heading">
          <h1>History</h1>
          <p class="subtitle" id="subtitle">Your recently visited pages</p>
        </div>
        <div class="clear-menu">
          <button type="button" class="clear-btn" id="clear" disabled aria-haspopup="menu" aria-expanded="false">
            Clear history
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M2.5 4.5 L6 8 L9.5 4.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <div class="clear-dropdown" id="clear-menu" role="menu" hidden>
            <button type="button" role="menuitem" data-range="hour">Last hour</button>
            <button type="button" role="menuitem" data-range="day">Last 24 hours</button>
            <button type="button" role="menuitem" data-range="week">Last week</button>
            <button type="button" role="menuitem" data-range="month">Last month</button>
            <button type="button" role="menuitem" data-range="all" class="danger">All time</button>
          </div>
        </div>
      </header>
      <div id="content">
        <div class="empty">Loading…</div>
      </div>
    </div>
    <script>
      const content = document.getElementById('content')
      const subtitle = document.getElementById('subtitle')
      const clearBtn = document.getElementById('clear')
      const clearMenu = document.getElementById('clear-menu')
      const api = window.lockinHistory

      const escapeHtml = (value) =>
        String(value)
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;')

      const startOfDay = (date) => {
        const next = new Date(date)
        next.setHours(0, 0, 0, 0)
        return next.getTime()
      }

      const dayLabel = (ts) => {
        const today = startOfDay(new Date())
        const day = startOfDay(ts)
        const dayMs = 24 * 60 * 60 * 1000
        if (day === today) return 'Today'
        if (day === today - dayMs) return 'Yesterday'
        try {
          return new Intl.DateTimeFormat(undefined, {
            weekday: 'long',
            month: 'short',
            day: 'numeric'
          }).format(new Date(ts))
        } catch {
          return new Date(ts).toLocaleDateString()
        }
      }

      const formatTime = (ts) => {
        try {
          return new Intl.DateTimeFormat(undefined, {
            hour: 'numeric',
            minute: '2-digit'
          }).format(new Date(ts))
        } catch {
          return new Date(ts).toLocaleTimeString()
        }
      }

      const faviconHtml = (entry) => {
        if (entry.favicon) {
          return '<img class="favicon" alt="" src="' + escapeHtml(entry.favicon) + '" />'
        }
        const letter = (entry.title || entry.url || '?').trim().charAt(0).toUpperCase() || '?'
        return '<span class="favicon-fallback" aria-hidden="true">' + escapeHtml(letter) + '</span>'
      }

      const groupByDay = (entries) => {
        const groups = []
        const indexByKey = new Map()
        for (const entry of entries) {
          const key = String(startOfDay(entry.visitedAt))
          let group = indexByKey.get(key)
          if (!group) {
            group = { key, label: dayLabel(entry.visitedAt), entries: [] }
            indexByKey.set(key, group)
            groups.push(group)
          }
          group.entries.push(entry)
        }
        return groups
      }

      const setMenuOpen = (open) => {
        clearMenu.hidden = !open
        clearBtn.setAttribute('aria-expanded', open ? 'true' : 'false')
      }

      const render = (entries) => {
        clearBtn.disabled = entries.length === 0
        if (entries.length === 0) setMenuOpen(false)
        subtitle.textContent =
          entries.length === 0
            ? 'Your recently visited pages'
            : entries.length === 1
              ? '1 page in your browsing history'
              : entries.length + ' pages in your browsing history'

        if (!entries.length) {
          content.innerHTML = '<div class="empty">No browsing history yet</div>'
          return
        }

        content.innerHTML = groupByDay(entries)
          .map(
            (group) =>
              '<section class="day-block">' +
              '<h2 class="day-label">' +
              escapeHtml(group.label) +
              '</h2>' +
              '<ul class="list">' +
              group.entries
                .map(
                  (entry) =>
                    '<li class="item">' +
                    '<button type="button" class="open" data-open="' +
                    escapeHtml(entry.url) +
                    '">' +
                    faviconHtml(entry) +
                    '<span class="meta">' +
                    '<div class="title">' +
                    escapeHtml(entry.title || entry.url) +
                    '</div>' +
                    '<div class="url">' +
                    escapeHtml(entry.url) +
                    '</div>' +
                    '</span>' +
                    '<span class="time">' +
                    escapeHtml(formatTime(entry.visitedAt)) +
                    '</span>' +
                    '</button>' +
                    '<button type="button" class="delete" data-delete="' +
                    escapeHtml(entry.id) +
                    '" aria-label="Delete">×</button>' +
                    '</li>'
                )
                .join('') +
              '</ul>' +
              '</section>'
          )
          .join('')
      }

      const refresh = async () => {
        const entries = await api.list()
        render(entries)
      }

      content.addEventListener('click', async (event) => {
        const target = event.target
        if (!(target instanceof Element)) return

        const deleteBtn = target.closest('[data-delete]')
        if (deleteBtn) {
          event.preventDefault()
          event.stopPropagation()
          const id = deleteBtn.getAttribute('data-delete')
          if (!id) return
          await api.remove(id)
          await refresh()
          return
        }

        const openBtn = target.closest('[data-open]')
        if (openBtn) {
          event.preventDefault()
          const url = openBtn.getAttribute('data-open')
          if (!url) return
          await api.open(url)
        }
      })

      clearBtn.addEventListener('click', (event) => {
        event.stopPropagation()
        if (clearBtn.disabled) return
        setMenuOpen(clearMenu.hidden)
      })

      clearMenu.addEventListener('click', async (event) => {
        const target = event.target
        if (!(target instanceof Element)) return
        const option = target.closest('[data-range]')
        if (!option) return
        const range = option.getAttribute('data-range')
        if (!range) return
        setMenuOpen(false)
        await api.clear(range)
        await refresh()
      })

      document.addEventListener('click', () => setMenuOpen(false))
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') setMenuOpen(false)
      })

      refresh().catch(() => {
        content.innerHTML = '<div class="empty">Could not load history</div>'
      })
    </script>
  </body>
</html>
`
