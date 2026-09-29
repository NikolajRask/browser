export const DOWNLOADS_PAGE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';"
    />
    <title>Downloads</title>
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

      .clear-btn {
        appearance: none;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border: 1px solid var(--border);
        background: var(--surface);
        color: var(--text);
        border-radius: 999px;
        padding: 9px 16px;
        font: inherit;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        box-shadow: 0 1px 2px rgba(31, 35, 40, 0.04);
      }

      .clear-btn:hover:not(:disabled) {
        background: var(--hover);
        border-color: #c5ccd5;
      }

      .clear-btn:disabled {
        opacity: 0.45;
        cursor: default;
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
        gap: 8px;
        padding: 8px 10px;
        border-radius: 12px;
      }

      .item:hover {
        background: var(--hover);
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

      .status {
        margin-top: 2px;
        font-size: 12px;
        color: var(--text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .progress {
        margin-top: 8px;
        height: 4px;
        border-radius: 999px;
        background: #e8ecef;
        overflow: hidden;
      }

      .progress > span {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: var(--accent);
      }

      .actions {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
      }

      .actions button {
        appearance: none;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: var(--text-muted);
        font: inherit;
        font-size: 12px;
        font-weight: 500;
        padding: 6px 8px;
        cursor: pointer;
      }

      .actions button:hover {
        background: var(--accent-soft);
        color: var(--accent);
      }

      .actions button.danger:hover {
        background: #fce8e6;
        color: var(--danger);
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <header>
        <div class="heading">
          <h1>Downloads</h1>
          <p class="subtitle" id="subtitle">Files saved from the web</p>
        </div>
        <button type="button" class="clear-btn" id="clear" disabled>Clear all</button>
      </header>
      <div id="content">
        <div class="empty">Loading…</div>
      </div>
    </div>
    <script>
      const content = document.getElementById('content')
      const subtitle = document.getElementById('subtitle')
      const clearBtn = document.getElementById('clear')
      const api = window.lockinDownloads

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

      const formatBytes = (bytes) => {
        if (!bytes || bytes < 0) return ''
        const units = ['B', 'KB', 'MB', 'GB', 'TB']
        let value = bytes
        let unit = 0
        while (value >= 1024 && unit < units.length - 1) {
          value /= 1024
          unit += 1
        }
        const digits = unit === 0 ? 0 : value >= 10 ? 0 : 1
        return value.toFixed(digits) + ' ' + units[unit]
      }

      const progressPercent = (entry) => {
        if (entry.totalBytes <= 0) return 0
        return Math.min(100, Math.round((entry.receivedBytes / entry.totalBytes) * 100))
      }

      const statusText = (entry) => {
        if (entry.state === 'progressing') {
          if (entry.paused) return 'Paused · ' + formatBytes(entry.receivedBytes)
          const received = formatBytes(entry.receivedBytes)
          const total = formatBytes(entry.totalBytes)
          if (entry.totalBytes > 0) {
            return received + ' of ' + total + ' · ' + progressPercent(entry) + '%'
          }
          return received ? received + ' downloaded' : 'Downloading…'
        }
        if (entry.state === 'completed') {
          const size = formatBytes(entry.totalBytes || entry.receivedBytes)
          return size ? 'Completed · ' + size : 'Completed'
        }
        if (entry.state === 'cancelled') return 'Cancelled'
        return 'Interrupted'
      }

      const groupByDay = (entries) => {
        const groups = []
        const indexByKey = new Map()
        for (const entry of entries) {
          const key = String(startOfDay(entry.startedAt))
          let group = indexByKey.get(key)
          if (!group) {
            group = { key, label: dayLabel(entry.startedAt), entries: [] }
            indexByKey.set(key, group)
            groups.push(group)
          }
          group.entries.push(entry)
        }
        return groups
      }

      const actionButtons = (entry) => {
        const buttons = []
        if (entry.state === 'progressing') {
          if (entry.paused && entry.canResume) {
            buttons.push(
              '<button type="button" data-resume="' + escapeHtml(entry.id) + '">Resume</button>'
            )
          } else if (!entry.paused) {
            buttons.push(
              '<button type="button" data-pause="' + escapeHtml(entry.id) + '">Pause</button>'
            )
          }
          buttons.push(
            '<button type="button" class="danger" data-cancel="' +
              escapeHtml(entry.id) +
              '">Cancel</button>'
          )
        } else if (entry.state === 'completed') {
          buttons.push(
            '<button type="button" data-open="' + escapeHtml(entry.id) + '">Open</button>'
          )
          buttons.push(
            '<button type="button" data-show="' + escapeHtml(entry.id) + '">Show in folder</button>'
          )
        }
        buttons.push(
          '<button type="button" class="danger" data-remove="' +
            escapeHtml(entry.id) +
            '" aria-label="Remove">×</button>'
        )
        return buttons.join('')
      }

      const render = (entries) => {
        clearBtn.disabled = entries.length === 0
        subtitle.textContent =
          entries.length === 0
            ? 'Files saved from the web'
            : entries.length === 1
              ? '1 item in your download history'
              : entries.length + ' items in your download history'

        if (!entries.length) {
          content.innerHTML = '<div class="empty">No downloads yet</div>'
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
                .map((entry) => {
                  const progress =
                    entry.state === 'progressing'
                      ? '<div class="progress" aria-hidden="true"><span style="width:' +
                        progressPercent(entry) +
                        '%"></span></div>'
                      : ''
                  return (
                    '<li class="item">' +
                    '<div class="meta">' +
                    '<div class="title">' +
                    escapeHtml(entry.filename) +
                    '</div>' +
                    '<div class="status">' +
                    escapeHtml(statusText(entry)) +
                    '</div>' +
                    progress +
                    '</div>' +
                    '<div class="actions">' +
                    actionButtons(entry) +
                    '</div>' +
                    '</li>'
                  )
                })
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

        const button = target.closest('button[data-open], button[data-show], button[data-cancel], button[data-pause], button[data-resume], button[data-remove]')
        if (!button) return

        event.preventDefault()
        const openId = button.getAttribute('data-open')
        if (openId) {
          await api.open(openId)
          return
        }
        const showId = button.getAttribute('data-show')
        if (showId) {
          await api.showInFolder(showId)
          return
        }
        const cancelId = button.getAttribute('data-cancel')
        if (cancelId) {
          await api.cancel(cancelId)
          return
        }
        const pauseId = button.getAttribute('data-pause')
        if (pauseId) {
          await api.pause(pauseId)
          return
        }
        const resumeId = button.getAttribute('data-resume')
        if (resumeId) {
          await api.resume(resumeId)
          return
        }
        const removeId = button.getAttribute('data-remove')
        if (removeId) {
          await api.remove(removeId)
        }
      })

      clearBtn.addEventListener('click', async () => {
        if (clearBtn.disabled) return
        await api.clear()
        await refresh()
      })

      api.onUpdated((payload) => {
        render(payload.entries)
      })

      refresh().catch(() => {
        content.innerHTML = '<div class="empty">Could not load downloads</div>'
      })
    </script>
  </body>
</html>
`
