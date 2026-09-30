export const BOOKMARKS_PAGE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: https: http:;"
    />
    <title>Bookmarks</title>
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

      .header-actions {
        display: flex;
        gap: 8px;
        flex-shrink: 0;
      }

      .action-btn {
        appearance: none;
        border: 1px solid var(--border);
        background: var(--surface);
        color: var(--text);
        border-radius: 999px;
        padding: 8px 14px;
        font: inherit;
        font-size: 13px;
        font-weight: 550;
        cursor: pointer;
      }

      .action-btn:hover {
        background: var(--hover);
      }

      .action-btn:disabled {
        opacity: 0.45;
        cursor: default;
      }

      .tree {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .section {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 14px;
        overflow: hidden;
        margin-bottom: 12px;
      }

      .section-title {
        margin: 0;
        padding: 14px 16px 8px;
        font-size: 13px;
        font-weight: 650;
        color: var(--text-muted);
        letter-spacing: 0.02em;
        text-transform: uppercase;
      }

      .row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 8px;
        align-items: center;
        padding: 4px 8px 4px 0;
        border-top: 1px solid #eef1f4;
      }

      .row:first-child {
        border-top: 0;
      }

      .row-main {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        padding: 8px 8px 8px 0;
        border: 0;
        background: transparent;
        font: inherit;
        color: inherit;
        text-align: left;
        cursor: pointer;
        border-radius: 8px;
      }

      .row-main:hover {
        background: var(--hover);
      }

      .twist {
        width: 22px;
        height: 22px;
        display: grid;
        place-items: center;
        border: 0;
        background: transparent;
        color: var(--text-muted);
        border-radius: 6px;
        cursor: pointer;
        flex-shrink: 0;
      }

      .twist:hover {
        background: #e8eaed;
        color: var(--text);
      }

      .twist-spacer {
        width: 22px;
        flex-shrink: 0;
      }

      .indent {
        flex-shrink: 0;
      }

      .favicon,
      .favicon-fallback,
      .folder-icon {
        width: 18px;
        height: 18px;
        flex-shrink: 0;
      }

      .favicon {
        border-radius: 3px;
        object-fit: contain;
      }

      .favicon-fallback {
        display: grid;
        place-items: center;
        border-radius: 3px;
        background: #e8eaed;
        color: var(--text-muted);
        font-size: 10px;
        font-weight: 650;
      }

      .folder-icon {
        display: grid;
        place-items: center;
        color: #5f6b76;
      }

      .meta {
        min-width: 0;
      }

      .title {
        font-size: 14px;
        font-weight: 550;
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

      .row-actions {
        display: flex;
        gap: 4px;
        opacity: 0;
        transition: opacity 0.12s ease;
      }

      .row:hover .row-actions,
      .row:focus-within .row-actions {
        opacity: 1;
      }

      .row-actions button {
        appearance: none;
        border: 0;
        background: transparent;
        color: var(--text-muted);
        border-radius: 8px;
        padding: 6px 8px;
        font: inherit;
        font-size: 12px;
        cursor: pointer;
      }

      .row-actions button:hover {
        background: var(--hover);
        color: var(--text);
      }

      .row-actions button.danger:hover {
        background: #fce8e6;
        color: var(--danger);
      }

      .empty {
        padding: 48px 24px;
        text-align: center;
        color: var(--text-muted);
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 14px;
      }

      .dialog-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(31, 35, 40, 0.28);
        display: grid;
        place-items: center;
        padding: 24px;
        z-index: 20;
      }

      .dialog {
        width: min(420px, 100%);
        background: #fff;
        border-radius: 14px;
        border: 1px solid var(--border);
        box-shadow: 0 16px 40px rgba(31, 35, 40, 0.2);
        padding: 20px;
      }

      .dialog h2 {
        margin: 0 0 12px;
        font-size: 18px;
        font-weight: 650;
      }

      .dialog label {
        display: block;
        font-size: 12px;
        color: var(--text-muted);
        margin-bottom: 6px;
      }

      .dialog input,
      .dialog select {
        width: 100%;
        height: 36px;
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 0 10px;
        font: inherit;
        margin-bottom: 14px;
      }

      .dialog-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }

      .dialog-actions button {
        appearance: none;
        border: 1px solid var(--border);
        background: #fff;
        border-radius: 999px;
        padding: 8px 14px;
        font: inherit;
        font-size: 13px;
        cursor: pointer;
      }

      .dialog-actions .primary {
        background: var(--accent);
        border-color: var(--accent);
        color: #fff;
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <header>
        <div class="heading">
          <h1>Bookmarks</h1>
          <p class="subtitle" id="subtitle">Organize pages into folders</p>
        </div>
        <div class="header-actions">
          <button type="button" class="action-btn" id="new-folder">New folder</button>
        </div>
      </header>
      <div id="content">
        <div class="empty">Loading…</div>
      </div>
    </div>
    <div id="dialog-root"></div>
    <script>
      const content = document.getElementById('content')
      const subtitle = document.getElementById('subtitle')
      const dialogRoot = document.getElementById('dialog-root')
      const newFolderBtn = document.getElementById('new-folder')
      const api = window.lockinBookmarks
      const expanded = new Set()
      let state = null

      const escapeHtml = (value) =>
        String(value)
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;')

      const faviconHtml = (node) => {
        if (node.type === 'folder') {
          return (
            '<span class="folder-icon" aria-hidden="true">' +
            '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 4.5A1.5 1.5 0 0 1 3.5 3H6l1.2 1.2H12.5A1.5 1.5 0 0 1 14 5.7v5.8A1.5 1.5 0 0 1 12.5 13h-9A1.5 1.5 0 0 1 2 11.5v-7Z" fill="currentColor" opacity="0.75"/></svg>' +
            '</span>'
          )
        }
        if (node.favicon) {
          return '<img class="favicon" alt="" src="' + escapeHtml(node.favicon) + '" />'
        }
        const letter = (node.title || node.url || '?').trim().charAt(0).toUpperCase() || '?'
        return '<span class="favicon-fallback" aria-hidden="true">' + escapeHtml(letter) + '</span>'
      }

      const countBookmarks = (folderId) => {
        const folder = state.nodes[folderId]
        if (!folder || folder.type !== 'folder') return 0
        let total = 0
        for (const childId of folder.children) {
          const child = state.nodes[childId]
          if (!child) continue
          if (child.type === 'bookmark') total += 1
          else total += countBookmarks(child.id)
        }
        return total
      }

      const isProtected = (id) =>
        id === state.rootId || id === state.barId || id === state.otherId

      const closeDialog = () => {
        dialogRoot.innerHTML = ''
      }

      const showPrompt = ({ title, label, initialValue, confirmLabel }) =>
        new Promise((resolve) => {
          dialogRoot.innerHTML =
            '<div class="dialog-backdrop" role="presentation">' +
            '<div class="dialog" role="dialog" aria-modal="true">' +
            '<h2>' +
            escapeHtml(title) +
            '</h2>' +
            '<label for="dialog-input">' +
            escapeHtml(label) +
            '</label>' +
            '<input id="dialog-input" type="text" value="' +
            escapeHtml(initialValue || '') +
            '" />' +
            '<div class="dialog-actions">' +
            '<button type="button" id="dialog-cancel">Cancel</button>' +
            '<button type="button" class="primary" id="dialog-confirm">' +
            escapeHtml(confirmLabel || 'Save') +
            '</button>' +
            '</div></div></div>'

          const input = document.getElementById('dialog-input')
          const finish = (value) => {
            closeDialog()
            resolve(value)
          }
          document.getElementById('dialog-cancel').onclick = () => finish(null)
          document.getElementById('dialog-confirm').onclick = () => finish(input.value.trim())
          input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') finish(input.value.trim())
            if (event.key === 'Escape') finish(null)
          })
          input.focus()
          input.select()
        })

      const showMoveDialog = async (nodeId) => {
        const folders = await api.listFolders()
        const node = state.nodes[nodeId]
        if (!node) return

        const options = folders
          .filter((folder) => {
            if (folder.id === nodeId) return false
            if (node.type === 'folder') {
              // Exclude moving a folder into itself handled server-side; still hide self.
              return true
            }
            return true
          })
          .map(
            (folder) =>
              '<option value="' +
              escapeHtml(folder.id) +
              '"' +
              (folder.id === node.parentId ? ' selected' : '') +
              '>' +
              escapeHtml('  '.repeat(folder.depth) + folder.title) +
              '</option>'
          )
          .join('')

        dialogRoot.innerHTML =
          '<div class="dialog-backdrop" role="presentation">' +
          '<div class="dialog" role="dialog" aria-modal="true">' +
          '<h2>Move item</h2>' +
          '<label for="dialog-select">Destination folder</label>' +
          '<select id="dialog-select">' +
          options +
          '</select>' +
          '<div class="dialog-actions">' +
          '<button type="button" id="dialog-cancel">Cancel</button>' +
          '<button type="button" class="primary" id="dialog-confirm">Move</button>' +
          '</div></div></div>'

        return new Promise((resolve) => {
          const finish = (value) => {
            closeDialog()
            resolve(value)
          }
          document.getElementById('dialog-cancel').onclick = () => finish(null)
          document.getElementById('dialog-confirm').onclick = () => {
            const select = document.getElementById('dialog-select')
            finish(select.value)
          }
        })
      }

      const renderNode = (nodeId, depth) => {
        const node = state.nodes[nodeId]
        if (!node) return ''

        if (node.type === 'bookmark') {
          return (
            '<div class="row" data-id="' +
            escapeHtml(node.id) +
            '">' +
            '<button type="button" class="row-main" data-open="' +
            escapeHtml(node.url) +
            '">' +
            '<span class="indent" style="width:' +
            depth * 18 +
            'px"></span>' +
            '<span class="twist-spacer"></span>' +
            faviconHtml(node) +
            '<span class="meta">' +
            '<div class="title">' +
            escapeHtml(node.title || node.url) +
            '</div>' +
            '<div class="url">' +
            escapeHtml(node.url) +
            '</div>' +
            '</span>' +
            '</button>' +
            '<div class="row-actions">' +
            '<button type="button" data-rename="' +
            escapeHtml(node.id) +
            '">Rename</button>' +
            '<button type="button" data-move="' +
            escapeHtml(node.id) +
            '">Move</button>' +
            '<button type="button" class="danger" data-delete="' +
            escapeHtml(node.id) +
            '">Delete</button>' +
            '</div>' +
            '</div>'
          )
        }

        const isOpen = expanded.has(node.id)
        const childHtml = isOpen
          ? node.children.map((childId) => renderNode(childId, depth + 1)).join('')
          : ''

        const canDelete = !isProtected(node.id)

        return (
          '<div class="row" data-id="' +
          escapeHtml(node.id) +
          '">' +
          '<div class="row-main" style="cursor:default">' +
          '<span class="indent" style="width:' +
          depth * 18 +
          'px"></span>' +
          '<button type="button" class="twist" data-toggle="' +
          escapeHtml(node.id) +
          '" aria-label="' +
          (isOpen ? 'Collapse' : 'Expand') +
          '">' +
          (isOpen ? '▾' : '▸') +
          '</button>' +
          faviconHtml(node) +
          '<span class="meta">' +
          '<div class="title">' +
          escapeHtml(node.title) +
          '</div>' +
          '</span>' +
          '</div>' +
          '<div class="row-actions">' +
          '<button type="button" data-new-folder="' +
          escapeHtml(node.id) +
          '">New folder</button>' +
          '<button type="button" data-rename="' +
          escapeHtml(node.id) +
          '">Rename</button>' +
          (canDelete
            ? '<button type="button" data-move="' +
              escapeHtml(node.id) +
              '">Move</button>' +
              '<button type="button" class="danger" data-delete="' +
              escapeHtml(node.id) +
              '">Delete</button>'
            : '') +
          '</div>' +
          '</div>' +
          childHtml
        )
      }

      const render = () => {
        if (!state) {
          content.innerHTML = '<div class="empty">Could not load bookmarks</div>'
          return
        }

        const total = countBookmarks(state.rootId)
        subtitle.textContent =
          total === 0
            ? 'Organize pages into folders'
            : total === 1
              ? '1 bookmark'
              : total + ' bookmarks'

        const bar = state.nodes[state.barId]
        const other = state.nodes[state.otherId]
        if (!bar || !other) {
          content.innerHTML = '<div class="empty">Bookmarks are unavailable</div>'
          return
        }

        // Expand top-level folders by default once.
        if (!expanded.size) {
          expanded.add(state.barId)
          expanded.add(state.otherId)
        }

        content.innerHTML =
          '<section class="section">' +
          '<h2 class="section-title">' +
          escapeHtml(bar.title) +
          '</h2>' +
          '<div class="tree">' +
          (bar.children.length
            ? bar.children.map((id) => renderNode(id, 0)).join('')
            : '<div class="empty" style="border:0;border-radius:0;padding:24px">No bookmarks on the bar yet</div>') +
          '</div>' +
          '</section>' +
          '<section class="section">' +
          '<h2 class="section-title">' +
          escapeHtml(other.title) +
          '</h2>' +
          '<div class="tree">' +
          (other.children.length
            ? other.children.map((id) => renderNode(id, 0)).join('')
            : '<div class="empty" style="border:0;border-radius:0;padding:24px">No other bookmarks yet</div>') +
          '</div>' +
          '</section>'
      }

      const refresh = async () => {
        state = await api.getState()
        render()
      }

      content.addEventListener('click', async (event) => {
        const target = event.target
        if (!(target instanceof Element)) return

        const toggle = target.closest('[data-toggle]')
        if (toggle) {
          const id = toggle.getAttribute('data-toggle')
          if (!id) return
          if (expanded.has(id)) expanded.delete(id)
          else expanded.add(id)
          render()
          return
        }

        const openBtn = target.closest('[data-open]')
        if (openBtn) {
          const url = openBtn.getAttribute('data-open')
          if (url) await api.open(url)
          return
        }

        const renameBtn = target.closest('[data-rename]')
        if (renameBtn) {
          const id = renameBtn.getAttribute('data-rename')
          const node = id ? state.nodes[id] : null
          if (!node) return
          const next = await showPrompt({
            title: node.type === 'folder' ? 'Rename folder' : 'Rename bookmark',
            label: 'Name',
            initialValue: node.title,
            confirmLabel: 'Rename'
          })
          if (!next) return
          await api.rename(id, next)
          return
        }

        const moveBtn = target.closest('[data-move]')
        if (moveBtn) {
          const id = moveBtn.getAttribute('data-move')
          if (!id) return
          const parentId = await showMoveDialog(id)
          if (!parentId) return
          await api.move(id, parentId)
          expanded.add(parentId)
          return
        }

        const deleteBtn = target.closest('[data-delete]')
        if (deleteBtn) {
          const id = deleteBtn.getAttribute('data-delete')
          if (!id) return
          await api.remove(id)
          return
        }

        const newFolderBtnRow = target.closest('[data-new-folder]')
        if (newFolderBtnRow) {
          const parentId = newFolderBtnRow.getAttribute('data-new-folder')
          if (!parentId) return
          const title = await showPrompt({
            title: 'New folder',
            label: 'Folder name',
            initialValue: 'New folder',
            confirmLabel: 'Create'
          })
          if (!title) return
          await api.addFolder(title, parentId)
          expanded.add(parentId)
        }
      })

      newFolderBtn.addEventListener('click', async () => {
        if (!state) return
        const title = await showPrompt({
          title: 'New folder',
          label: 'Folder name',
          initialValue: 'New folder',
          confirmLabel: 'Create'
        })
        if (!title) return
        await api.addFolder(title, state.barId)
        expanded.add(state.barId)
      })

      api.onUpdated((next) => {
        state = next
        render()
      })

      refresh().catch(() => {
        content.innerHTML = '<div class="empty">Could not load bookmarks</div>'
      })
    </script>
  </body>
</html>
`
