export const PASSWORDS_PAGE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';"
    />
    <title>Passwords</title>
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
        padding: 48px 20px;
        text-align: center;
        color: var(--text-muted);
        font-size: 14px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 16px;
      }

      .list {
        list-style: none;
        margin: 0;
        padding: 0;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 16px;
        overflow: hidden;
      }

      .item {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 12px;
        align-items: start;
        padding: 14px 16px;
        border-bottom: 1px solid var(--border);
      }

      .item:last-child {
        border-bottom: 0;
      }

      .meta {
        min-width: 0;
      }

      .username {
        font-size: 15px;
        font-weight: 600;
        letter-spacing: -0.01em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .origin {
        margin-top: 2px;
        font-size: 12px;
        color: var(--text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .secret {
        margin-top: 8px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 13px;
        color: var(--text);
        word-break: break-all;
      }

      .secret.masked {
        letter-spacing: 0.12em;
        color: var(--text-muted);
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        justify-content: flex-end;
      }

      .actions button {
        appearance: none;
        border: 1px solid var(--border);
        background: var(--surface);
        color: var(--text);
        border-radius: 999px;
        padding: 6px 12px;
        font: inherit;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
      }

      .actions button:hover {
        background: var(--hover);
      }

      .actions button.danger {
        color: var(--danger);
        border-color: #f0c4c0;
      }

      .actions button.danger:hover {
        background: #fce8e6;
      }

      .actions button.copied {
        background: var(--accent-soft);
        border-color: #9fd8d0;
        color: var(--accent);
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <header>
        <div class="heading">
          <h1>Passwords</h1>
          <p class="subtitle" id="subtitle">Saved usernames and passwords</p>
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
      const api = window.lockinPasswords
      const revealed = new Map()

      const escapeHtml = (value) =>
        String(value)
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;')

      const render = (entries) => {
        clearBtn.disabled = entries.length === 0
        subtitle.textContent =
          entries.length === 0
            ? 'Saved usernames and passwords'
            : entries.length === 1
              ? '1 saved password'
              : entries.length + ' saved passwords'

        if (!entries.length) {
          content.innerHTML = '<div class="empty">No saved passwords yet</div>'
          return
        }

        content.innerHTML =
          '<ul class="list">' +
          entries
            .map((entry) => {
              const isRevealed = revealed.has(entry.id)
              const secret = isRevealed ? revealed.get(entry.id) : '••••••••'
              return (
                '<li class="item" data-id="' +
                escapeHtml(entry.id) +
                '">' +
                '<div class="meta">' +
                '<div class="username">' +
                escapeHtml(entry.username) +
                '</div>' +
                '<div class="origin">' +
                escapeHtml(entry.origin) +
                '</div>' +
                '<div class="secret' +
                (isRevealed ? '' : ' masked') +
                '">' +
                escapeHtml(secret) +
                '</div>' +
                '</div>' +
                '<div class="actions">' +
                '<button type="button" data-reveal="' +
                escapeHtml(entry.id) +
                '">' +
                (isRevealed ? 'Hide' : 'Reveal') +
                '</button>' +
                '<button type="button" data-copy="' +
                escapeHtml(entry.id) +
                '">Copy</button>' +
                '<button type="button" class="danger" data-delete="' +
                escapeHtml(entry.id) +
                '">Delete</button>' +
                '</div>' +
                '</li>'
              )
            })
            .join('') +
          '</ul>'
      }

      let latest = []

      const refresh = async () => {
        latest = await api.list()
        const ids = new Set(latest.map((entry) => entry.id))
        for (const id of revealed.keys()) {
          if (!ids.has(id)) revealed.delete(id)
        }
        render(latest)
      }

      content.addEventListener('click', async (event) => {
        const target = event.target
        if (!(target instanceof Element)) return

        const deleteBtn = target.closest('[data-delete]')
        if (deleteBtn) {
          const id = deleteBtn.getAttribute('data-delete')
          if (!id) return
          await api.remove(id)
          revealed.delete(id)
          await refresh()
          return
        }

        const revealBtn = target.closest('[data-reveal]')
        if (revealBtn) {
          const id = revealBtn.getAttribute('data-reveal')
          if (!id) return
          if (revealed.has(id)) {
            revealed.delete(id)
            render(latest)
            return
          }
          const password = await api.reveal(id)
          if (typeof password === 'string') {
            revealed.set(id, password)
            render(latest)
          }
          return
        }

        const copyBtn = target.closest('[data-copy]')
        if (copyBtn) {
          const id = copyBtn.getAttribute('data-copy')
          if (!id) return
          const ok = await api.copy(id)
          if (ok) {
            copyBtn.classList.add('copied')
            copyBtn.textContent = 'Copied'
            setTimeout(() => {
              copyBtn.classList.remove('copied')
              copyBtn.textContent = 'Copy'
            }, 1200)
          }
        }
      })

      clearBtn.addEventListener('click', async () => {
        if (clearBtn.disabled) return
        if (!window.confirm('Delete all saved passwords?')) return
        await api.clear()
        revealed.clear()
        await refresh()
      })

      refresh().catch(() => {
        content.innerHTML = '<div class="empty">Could not load passwords</div>'
      })
    </script>
  </body>
</html>
`
