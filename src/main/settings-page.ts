export const SETTINGS_PAGE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';"
    />
    <title>Settings</title>
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
        max-width: 720px;
        margin: 0 auto;
      }

      header {
        margin-bottom: 28px;
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

      .section {
        margin-bottom: 24px;
      }

      .section-title {
        margin: 0 0 10px;
        padding: 0 4px;
        font-size: 12px;
        font-weight: 650;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--text-muted);
      }

      .card {
        list-style: none;
        margin: 0;
        padding: 0;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 16px;
        overflow: hidden;
      }

      .row {
        display: grid;
        grid-template-columns: 40px minmax(0, 1fr) auto;
        gap: 12px;
        align-items: center;
        width: 100%;
        padding: 14px 16px;
        border: 0;
        border-bottom: 1px solid var(--border);
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
      }

      .row:last-child {
        border-bottom: 0;
      }

      .row:hover {
        background: var(--hover);
      }

      .row:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: -2px;
      }

      .icon {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        display: grid;
        place-items: center;
        background: var(--accent-soft);
        color: var(--accent);
        flex-shrink: 0;
      }

      .icon svg {
        width: 18px;
        height: 18px;
      }

      .meta {
        min-width: 0;
      }

      .label {
        font-size: 15px;
        font-weight: 600;
        letter-spacing: -0.01em;
      }

      .desc {
        margin-top: 2px;
        font-size: 12px;
        color: var(--text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .chevron {
        color: #9aa3ad;
        display: grid;
        place-items: center;
      }

      .chevron svg {
        width: 14px;
        height: 14px;
      }

      .about {
        padding: 16px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 16px;
      }

      .about-name {
        font-size: 16px;
        font-weight: 650;
        letter-spacing: -0.02em;
      }

      .about-meta {
        margin-top: 4px;
        font-size: 13px;
        color: var(--text-muted);
      }

      .ai-card {
        padding: 16px;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 16px;
      }

      .ai-status {
        margin: 0 0 12px;
        font-size: 13px;
        color: var(--text-muted);
      }

      .ai-status.is-configured {
        color: var(--accent);
        font-weight: 600;
      }

      .ai-label {
        display: block;
        margin-bottom: 6px;
        font-size: 13px;
        font-weight: 600;
      }

      .ai-input {
        width: 100%;
        box-sizing: border-box;
        padding: 10px 12px;
        border: 1px solid var(--border);
        border-radius: 10px;
        background: #fff;
        color: var(--text);
        font: inherit;
        font-size: 14px;
        outline: none;
      }

      .ai-input:focus {
        border-color: var(--accent);
        box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.12);
      }

      .ai-actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }

      .ai-btn {
        padding: 8px 14px;
        border-radius: 8px;
        border: 1px solid var(--border);
        background: #fff;
        color: var(--text);
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
      }

      .ai-btn:hover {
        background: var(--hover);
      }

      .ai-btn.primary {
        background: var(--accent);
        border-color: var(--accent);
        color: #fff;
      }

      .ai-btn.primary:hover {
        background: #0d9488;
      }

      .ai-btn:disabled {
        opacity: 0.45;
        cursor: default;
      }

      .ai-message {
        margin: 10px 0 0;
        font-size: 12px;
        color: var(--text-muted);
        min-height: 16px;
      }

      .ai-message.is-error {
        color: #b91c1c;
      }

      .ai-message.is-ok {
        color: var(--accent);
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <header>
        <h1>Settings</h1>
        <p class="subtitle">Manage Lockin and your browsing data</p>
      </header>

      <section class="section">
        <h2 class="section-title">Privacy &amp; data</h2>
        <ul class="card">
          <li>
            <button type="button" class="row" data-href="lockin://passwords">
              <span class="icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M7 11V8a5 5 0 0 1 10 0v3"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  />
                  <rect
                    x="5"
                    y="11"
                    width="14"
                    height="10"
                    rx="2.5"
                    stroke="currentColor"
                    stroke-width="1.8"
                  />
                </svg>
              </span>
              <span class="meta">
                <span class="label">Passwords</span>
                <span class="desc">View and manage saved sign-ins</span>
              </span>
              <span class="chevron" aria-hidden="true">
                <svg viewBox="0 0 12 12" fill="none">
                  <path
                    d="M4.5 2.5 L8 6 L4.5 9.5"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
            </button>
          </li>
          <li>
            <button type="button" class="row" data-href="lockin://history">
              <span class="icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="8.2" stroke="currentColor" stroke-width="1.8" />
                  <path
                    d="M12 8v4.4l2.8 1.6"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
              <span class="meta">
                <span class="label">Browsing history</span>
                <span class="desc">See and clear recently visited pages</span>
              </span>
              <span class="chevron" aria-hidden="true">
                <svg viewBox="0 0 12 12" fill="none">
                  <path
                    d="M4.5 2.5 L8 6 L4.5 9.5"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
            </button>
          </li>
          <li>
            <button type="button" class="row" data-href="lockin://screentime">
              <span class="icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 19V9.5M10 19V5M16 19v-7M22 19H2"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
              <span class="meta">
                <span class="label">Time Locked in</span>
                <span class="desc">Review how you spend time in the browser</span>
              </span>
              <span class="chevron" aria-hidden="true">
                <svg viewBox="0 0 12 12" fill="none">
                  <path
                    d="M4.5 2.5 L8 6 L4.5 9.5"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
            </button>
          </li>
        </ul>
      </section>

      <section class="section">
        <h2 class="section-title">Library</h2>
        <ul class="card">
          <li>
            <button type="button" class="row" data-href="lockin://bookmarks">
              <span class="icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M7 4.5h10a1.5 1.5 0 0 1 1.5 1.5v13.2l-6.5-3.6-6.5 3.6V6A1.5 1.5 0 0 1 7 4.5z"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
              <span class="meta">
                <span class="label">Bookmarks</span>
                <span class="desc">Organize saved pages and folders</span>
              </span>
              <span class="chevron" aria-hidden="true">
                <svg viewBox="0 0 12 12" fill="none">
                  <path
                    d="M4.5 2.5 L8 6 L4.5 9.5"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
            </button>
          </li>
          <li>
            <button type="button" class="row" data-href="lockin://todos">
              <span class="icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <rect
                    x="4.5"
                    y="4.5"
                    width="15"
                    height="15"
                    rx="3"
                    stroke="currentColor"
                    stroke-width="1.8"
                  />
                  <path
                    d="M8 12.2 10.6 14.8 16.2 9"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
              <span class="meta">
                <span class="label">Todos</span>
                <span class="desc">Keep tasks organized in folders</span>
              </span>
              <span class="chevron" aria-hidden="true">
                <svg viewBox="0 0 12 12" fill="none">
                  <path
                    d="M4.5 2.5 L8 6 L4.5 9.5"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
            </button>
          </li>
          <li>
            <button type="button" class="row" data-href="lockin://downloads">
              <span class="icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 4v10.5M8.2 11.2 12 15l3.8-3.8M5 19h14"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
              <span class="meta">
                <span class="label">Downloads</span>
                <span class="desc">Open and manage downloaded files</span>
              </span>
              <span class="chevron" aria-hidden="true">
                <svg viewBox="0 0 12 12" fill="none">
                  <path
                    d="M4.5 2.5 L8 6 L4.5 9.5"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
            </button>
          </li>
        </ul>
      </section>

      <section class="section">
        <h2 class="section-title">AI</h2>
        <div class="ai-card">
          <p id="ai-status" class="ai-status">Checking…</p>
          <label class="ai-label" for="claude-key">Claude API key</label>
          <input
            id="claude-key"
            class="ai-input"
            type="password"
            autocomplete="off"
            spellcheck="false"
            placeholder="sk-ant-…"
          />
          <div class="ai-actions">
            <button type="button" class="ai-btn primary" id="ai-save">Save key</button>
            <button type="button" class="ai-btn" id="ai-clear">Clear</button>
          </div>
          <p id="ai-message" class="ai-message" aria-live="polite"></p>
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">About</h2>
        <div class="about">
          <div class="about-name">Lockin</div>
          <div class="about-meta">Version 0.1.0 · A browser built for students</div>
        </div>
      </section>
    </div>
    <script>
      document.querySelectorAll('[data-href]').forEach((button) => {
        button.addEventListener('click', () => {
          const href = button.getAttribute('data-href')
          if (href) window.location.href = href
        })
      })

      const statusEl = document.getElementById('ai-status')
      const messageEl = document.getElementById('ai-message')
      const keyInput = document.getElementById('claude-key')
      const saveBtn = document.getElementById('ai-save')
      const clearBtn = document.getElementById('ai-clear')
      const api = window.lockinSettings

      function setStatus(configured) {
        statusEl.textContent = configured
          ? 'Claude API key is configured'
          : 'No Claude API key set'
        statusEl.classList.toggle('is-configured', configured)
        clearBtn.disabled = !configured
      }

      function setMessage(text, kind) {
        messageEl.textContent = text || ''
        messageEl.classList.toggle('is-error', kind === 'error')
        messageEl.classList.toggle('is-ok', kind === 'ok')
      }

      async function refreshStatus() {
        if (!api) {
          setStatus(false)
          setMessage('Settings API unavailable.', 'error')
          return
        }
        try {
          const status = await api.claudeStatus()
          setStatus(Boolean(status && status.configured))
        } catch {
          setStatus(false)
          setMessage('Could not read key status.', 'error')
        }
      }

      saveBtn.addEventListener('click', async () => {
        if (!api) return
        const key = keyInput.value.trim()
        if (!key) {
          setMessage('Enter an API key to save.', 'error')
          return
        }
        saveBtn.disabled = true
        try {
          const result = await api.setClaudeKey(key)
          if (result && result.configured) {
            keyInput.value = ''
            setStatus(true)
            setMessage('API key saved.', 'ok')
          } else {
            setMessage('Could not save key. Encryption may be unavailable.', 'error')
          }
        } catch {
          setMessage('Could not save key.', 'error')
        } finally {
          saveBtn.disabled = false
        }
      })

      clearBtn.addEventListener('click', async () => {
        if (!api) return
        clearBtn.disabled = true
        try {
          await api.clearClaudeKey()
          keyInput.value = ''
          setStatus(false)
          setMessage('API key cleared.', 'ok')
        } catch {
          setMessage('Could not clear key.', 'error')
          clearBtn.disabled = false
        }
      })

      keyInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          saveBtn.click()
        }
      })

      void refreshStatus()
    </script>
  </body>
</html>
`
