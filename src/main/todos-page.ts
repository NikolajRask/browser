export const TODOS_PAGE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';"
    />
    <title>Todos</title>
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
        max-width: 960px;
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

      .layout {
        display: grid;
        grid-template-columns: 240px minmax(0, 1fr);
        gap: 16px;
        align-items: start;
      }

      @media (max-width: 720px) {
        .layout {
          grid-template-columns: 1fr;
        }
      }

      .panel {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 14px;
        overflow: hidden;
      }

      .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 14px 14px 10px;
        border-bottom: 1px solid #eef1f4;
      }

      .panel-title {
        margin: 0;
        font-size: 13px;
        font-weight: 650;
        color: var(--text-muted);
        letter-spacing: 0.02em;
        text-transform: uppercase;
      }

      .action-btn {
        appearance: none;
        border: 1px solid var(--border);
        background: var(--surface);
        color: var(--text);
        border-radius: 999px;
        padding: 6px 12px;
        font: inherit;
        font-size: 12px;
        font-weight: 550;
        cursor: pointer;
      }

      .action-btn:hover {
        background: var(--hover);
      }

      .action-btn.primary {
        background: var(--accent);
        border-color: var(--accent);
        color: #fff;
      }

      .action-btn.primary:hover {
        filter: brightness(0.95);
      }

      .folder-list {
        display: flex;
        flex-direction: column;
        padding: 8px;
        gap: 2px;
      }

      .folder-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 4px;
        align-items: center;
        border-radius: 10px;
      }

      .folder-row.is-active {
        background: var(--accent-soft);
      }

      .folder-main {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        padding: 10px 10px;
        border: 0;
        background: transparent;
        font: inherit;
        color: inherit;
        text-align: left;
        cursor: pointer;
        border-radius: 10px;
      }

      .folder-row:not(.is-active) .folder-main:hover {
        background: var(--hover);
      }

      .folder-icon {
        width: 18px;
        height: 18px;
        flex-shrink: 0;
        color: #5f6b76;
        display: grid;
        place-items: center;
      }

      .folder-name {
        min-width: 0;
        font-size: 14px;
        font-weight: 550;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .folder-count {
        margin-left: auto;
        font-size: 12px;
        color: var(--text-muted);
        flex-shrink: 0;
      }

      .folder-actions {
        display: flex;
        gap: 2px;
        opacity: 0;
        padding-right: 4px;
        transition: opacity 0.12s ease;
      }

      .folder-row:hover .folder-actions,
      .folder-row:focus-within .folder-actions {
        opacity: 1;
      }

      .icon-btn {
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

      .icon-btn:hover {
        background: var(--hover);
        color: var(--text);
      }

      .icon-btn.danger:hover {
        background: #fce8e6;
        color: var(--danger);
      }

      .todos-body {
        padding: 14px;
      }

      .add-row {
        display: flex;
        gap: 8px;
        margin-bottom: 14px;
      }

      .add-row input {
        flex: 1;
        min-width: 0;
        height: 38px;
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 0 12px;
        font: inherit;
        font-size: 14px;
        background: #fff;
      }

      .add-row input:focus {
        outline: 2px solid var(--accent-soft);
        border-color: var(--accent);
      }

      .todo-list {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .todo-row {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        gap: 8px;
        align-items: center;
        padding: 8px 6px;
        border-radius: 10px;
      }

      .todo-row:hover {
        background: var(--hover);
      }

      .todo-row.is-completed .todo-title {
        color: var(--text-muted);
        text-decoration: line-through;
      }

      .check {
        width: 20px;
        height: 20px;
        border-radius: 6px;
        border: 1.5px solid #c5cbd3;
        background: #fff;
        display: grid;
        place-items: center;
        cursor: pointer;
        flex-shrink: 0;
        padding: 0;
        appearance: none;
        color: #fff;
      }

      .check.is-checked {
        background: var(--accent);
        border-color: var(--accent);
      }

      .todo-title {
        font-size: 14px;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .todo-actions {
        display: flex;
        gap: 2px;
        opacity: 0;
        transition: opacity 0.12s ease;
      }

      .todo-row:hover .todo-actions,
      .todo-row:focus-within .todo-actions {
        opacity: 1;
      }

      .empty {
        padding: 36px 20px;
        text-align: center;
        color: var(--text-muted);
        font-size: 14px;
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
        margin: 0 0 8px;
        font-size: 18px;
        font-weight: 650;
      }

      .dialog p {
        margin: 0 0 14px;
        color: var(--text-muted);
        font-size: 13px;
        line-height: 1.4;
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

      .dialog-actions .danger {
        background: var(--danger);
        border-color: var(--danger);
        color: #fff;
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <header>
        <div class="heading">
          <h1>Todos</h1>
          <p class="subtitle" id="subtitle">Organize tasks into folders</p>
        </div>
      </header>
      <div class="layout" id="content">
        <div class="panel">
          <div class="empty">Loading…</div>
        </div>
      </div>
    </div>
    <div id="dialog-root"></div>
    <script>
      const content = document.getElementById('content')
      const subtitle = document.getElementById('subtitle')
      const dialogRoot = document.getElementById('dialog-root')
      const api = window.lockinTodos
      let state = null
      let selectedFolderId = null

      const escapeHtml = (value) =>
        String(value)
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;')

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

      const showConfirm = ({ title, message, confirmLabel, danger }) =>
        new Promise((resolve) => {
          dialogRoot.innerHTML =
            '<div class="dialog-backdrop" role="presentation">' +
            '<div class="dialog" role="dialog" aria-modal="true">' +
            '<h2>' +
            escapeHtml(title) +
            '</h2>' +
            '<p>' +
            escapeHtml(message) +
            '</p>' +
            '<div class="dialog-actions">' +
            '<button type="button" id="dialog-cancel">Cancel</button>' +
            '<button type="button" class="' +
            (danger ? 'danger' : 'primary') +
            '" id="dialog-confirm">' +
            escapeHtml(confirmLabel || 'Confirm') +
            '</button>' +
            '</div></div></div>'

          const finish = (value) => {
            closeDialog()
            resolve(value)
          }
          document.getElementById('dialog-cancel').onclick = () => finish(false)
          document.getElementById('dialog-confirm').onclick = () => finish(true)
        })

      const showMoveDialog = (todoId) => {
        const todo = state.todos[todoId]
        if (!todo) return Promise.resolve(null)

        const options = state.folderOrder
          .map((id) => state.folders[id])
          .filter(Boolean)
          .map(
            (folder) =>
              '<option value="' +
              escapeHtml(folder.id) +
              '"' +
              (folder.id === todo.folderId ? ' selected' : '') +
              '>' +
              escapeHtml(folder.title) +
              '</option>'
          )
          .join('')

        dialogRoot.innerHTML =
          '<div class="dialog-backdrop" role="presentation">' +
          '<div class="dialog" role="dialog" aria-modal="true">' +
          '<h2>Move todo</h2>' +
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

      const todosInFolder = (folderId) => {
        const items = Object.values(state.todos).filter((todo) => todo.folderId === folderId)
        items.sort((a, b) => {
          if (a.completed !== b.completed) return a.completed ? 1 : -1
          return b.createdAt - a.createdAt
        })
        return items
      }

      const countOpen = (folderId) =>
        Object.values(state.todos).filter(
          (todo) => todo.folderId === folderId && !todo.completed
        ).length

      const ensureSelection = () => {
        if (selectedFolderId && state.folders[selectedFolderId]) return
        selectedFolderId = state.folderOrder.find((id) => state.folders[id]) || null
      }

      const folderIcon = () =>
        '<span class="folder-icon" aria-hidden="true">' +
        '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 4.5A1.5 1.5 0 0 1 3.5 3H6l1.2 1.2H12.5A1.5 1.5 0 0 1 14 5.7v5.8A1.5 1.5 0 0 1 12.5 13h-9A1.5 1.5 0 0 1 2 11.5v-7Z" fill="currentColor" opacity="0.75"/></svg>' +
        '</span>'

      const checkIcon = () =>
        '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.2 4.8 8.5 9.5 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'

      const render = () => {
        if (!state) {
          content.innerHTML = '<div class="panel"><div class="empty">Could not load todos</div></div>'
          return
        }

        ensureSelection()

        const totalOpen = Object.values(state.todos).filter((todo) => !todo.completed).length
        subtitle.textContent =
          totalOpen === 0
            ? 'Organize tasks into folders'
            : totalOpen === 1
              ? '1 open todo'
              : totalOpen + ' open todos'

        const foldersHtml = state.folderOrder
          .map((id) => state.folders[id])
          .filter(Boolean)
          .map((folder) => {
            const active = folder.id === selectedFolderId
            const canDelete = state.folderOrder.length > 1
            return (
              '<div class="folder-row' +
              (active ? ' is-active' : '') +
              '" data-folder-id="' +
              escapeHtml(folder.id) +
              '">' +
              '<button type="button" class="folder-main" data-select-folder="' +
              escapeHtml(folder.id) +
              '">' +
              folderIcon() +
              '<span class="folder-name">' +
              escapeHtml(folder.title) +
              '</span>' +
              '<span class="folder-count">' +
              countOpen(folder.id) +
              '</span>' +
              '</button>' +
              '<div class="folder-actions">' +
              '<button type="button" class="icon-btn" data-rename-folder="' +
              escapeHtml(folder.id) +
              '">Rename</button>' +
              (canDelete
                ? '<button type="button" class="icon-btn danger" data-delete-folder="' +
                  escapeHtml(folder.id) +
                  '">Delete</button>'
                : '') +
              '</div>' +
              '</div>'
            )
          })
          .join('')

        const selected = selectedFolderId ? state.folders[selectedFolderId] : null
        const todos = selected ? todosInFolder(selected.id) : []

        const todosHtml = !selected
          ? '<div class="empty">Create a folder to get started</div>'
          : todos.length === 0
            ? '<div class="empty">No todos in this folder yet</div>'
            : '<div class="todo-list">' +
              todos
                .map((todo) => {
                  return (
                    '<div class="todo-row' +
                    (todo.completed ? ' is-completed' : '') +
                    '" data-todo-id="' +
                    escapeHtml(todo.id) +
                    '">' +
                    '<button type="button" class="check' +
                    (todo.completed ? ' is-checked' : '') +
                    '" data-toggle-todo="' +
                    escapeHtml(todo.id) +
                    '" aria-label="' +
                    (todo.completed ? 'Mark incomplete' : 'Mark complete') +
                    '">' +
                    (todo.completed ? checkIcon() : '') +
                    '</button>' +
                    '<div class="todo-title">' +
                    escapeHtml(todo.title) +
                    '</div>' +
                    '<div class="todo-actions">' +
                    '<button type="button" class="icon-btn" data-rename-todo="' +
                    escapeHtml(todo.id) +
                    '">Rename</button>' +
                    '<button type="button" class="icon-btn" data-move-todo="' +
                    escapeHtml(todo.id) +
                    '">Move</button>' +
                    '<button type="button" class="icon-btn danger" data-delete-todo="' +
                    escapeHtml(todo.id) +
                    '">Delete</button>' +
                    '</div>' +
                    '</div>'
                  )
                })
                .join('') +
              '</div>'

        content.innerHTML =
          '<aside class="panel">' +
          '<div class="panel-header">' +
          '<h2 class="panel-title">Folders</h2>' +
          '<button type="button" class="action-btn" id="new-folder">New</button>' +
          '</div>' +
          '<div class="folder-list">' +
          (foldersHtml || '<div class="empty">No folders</div>') +
          '</div>' +
          '</aside>' +
          '<section class="panel">' +
          '<div class="panel-header">' +
          '<h2 class="panel-title">' +
          escapeHtml(selected ? selected.title : 'Todos') +
          '</h2>' +
          '</div>' +
          '<div class="todos-body">' +
          (selected
            ? '<form class="add-row" id="add-todo-form">' +
              '<input id="todo-input" type="text" placeholder="Add a todo…" autocomplete="off" />' +
              '<button type="submit" class="action-btn primary">Add</button>' +
              '</form>'
            : '') +
          todosHtml +
          '</div>' +
          '</section>'

        const form = document.getElementById('add-todo-form')
        const input = document.getElementById('todo-input')
        if (form && input && selected) {
          form.addEventListener('submit', async (event) => {
            event.preventDefault()
            const title = input.value.trim()
            if (!title) return
            input.value = ''
            await api.addTodo(selected.id, title)
            input.focus()
          })
        }

        const newFolderBtn = document.getElementById('new-folder')
        if (newFolderBtn) {
          newFolderBtn.addEventListener('click', async () => {
            const title = await showPrompt({
              title: 'New folder',
              label: 'Folder name',
              initialValue: 'New folder',
              confirmLabel: 'Create'
            })
            if (!title) return
            const folder = await api.addFolder(title)
            if (folder) selectedFolderId = folder.id
          })
        }
      }

      content.addEventListener('click', async (event) => {
        const target = event.target
        if (!(target instanceof Element)) return

        const selectBtn = target.closest('[data-select-folder]')
        if (selectBtn) {
          const id = selectBtn.getAttribute('data-select-folder')
          if (!id) return
          selectedFolderId = id
          render()
          return
        }

        const renameFolderBtn = target.closest('[data-rename-folder]')
        if (renameFolderBtn) {
          const id = renameFolderBtn.getAttribute('data-rename-folder')
          const folder = id ? state.folders[id] : null
          if (!folder) return
          const next = await showPrompt({
            title: 'Rename folder',
            label: 'Name',
            initialValue: folder.title,
            confirmLabel: 'Rename'
          })
          if (!next) return
          await api.renameFolder(id, next)
          return
        }

        const deleteFolderBtn = target.closest('[data-delete-folder]')
        if (deleteFolderBtn) {
          const id = deleteFolderBtn.getAttribute('data-delete-folder')
          const folder = id ? state.folders[id] : null
          if (!folder) return
          const ok = await showConfirm({
            title: 'Delete folder',
            message: 'Delete "' + folder.title + '" and all todos inside it?',
            confirmLabel: 'Delete',
            danger: true
          })
          if (!ok) return
          const removed = await api.removeFolder(id)
          if (removed && selectedFolderId === id) selectedFolderId = null
          return
        }

        const toggleBtn = target.closest('[data-toggle-todo]')
        if (toggleBtn) {
          const id = toggleBtn.getAttribute('data-toggle-todo')
          if (!id) return
          await api.toggleTodo(id)
          return
        }

        const renameTodoBtn = target.closest('[data-rename-todo]')
        if (renameTodoBtn) {
          const id = renameTodoBtn.getAttribute('data-rename-todo')
          const todo = id ? state.todos[id] : null
          if (!todo) return
          const next = await showPrompt({
            title: 'Rename todo',
            label: 'Title',
            initialValue: todo.title,
            confirmLabel: 'Rename'
          })
          if (!next) return
          await api.renameTodo(id, next)
          return
        }

        const moveTodoBtn = target.closest('[data-move-todo]')
        if (moveTodoBtn) {
          const id = moveTodoBtn.getAttribute('data-move-todo')
          if (!id) return
          const folderId = await showMoveDialog(id)
          if (!folderId) return
          await api.moveTodo(id, folderId)
          return
        }

        const deleteTodoBtn = target.closest('[data-delete-todo]')
        if (deleteTodoBtn) {
          const id = deleteTodoBtn.getAttribute('data-delete-todo')
          if (!id) return
          await api.removeTodo(id)
        }
      })

      api.onUpdated((next) => {
        state = next
        render()
      })

      const refresh = async () => {
        state = await api.getState()
        render()
      }

      refresh().catch(() => {
        content.innerHTML = '<div class="panel"><div class="empty">Could not load todos</div></div>'
      })
    </script>
  </body>
</html>
`
