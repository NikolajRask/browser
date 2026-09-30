export const NEWTAB_PAGE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';"
    />
    <title>New Tab</title>
    <style>
      :root {
        color-scheme: light;
        --bg-top: #eef6f4;
        --bg-bottom: #f4f6f8;
        --surface: #ffffff;
        --border: #d7dce3;
        --text: #1f2328;
        --text-muted: #5f6b76;
        --accent: #0f766e;
        --accent-soft: #d8f3ef;
        --font: 'Segoe UI', 'SF Pro Text', system-ui, sans-serif;
        --display: 'Segoe UI Semibold', 'SF Pro Display', 'Segoe UI', system-ui, sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        min-height: 100%;
        height: 100%;
        color: var(--text);
        font-family: var(--font);
        background:
          radial-gradient(1000px 520px at 50% -8%, var(--bg-top), transparent 58%),
          radial-gradient(700px 360px at 88% 110%, #e7eef8, transparent 55%),
          linear-gradient(180deg, #f7fafb 0%, var(--bg-bottom) 100%);
      }

      body {
        display: grid;
        place-items: center;
        padding: 48px 24px;
      }

      .stage {
        width: min(560px, 100%);
        text-align: center;
        animation: rise 420ms ease-out both;
      }

      @keyframes rise {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .brand {
        margin: 0;
        font-family: var(--display);
        font-size: clamp(40px, 7vw, 56px);
        font-weight: 650;
        letter-spacing: -0.045em;
        line-height: 1;
        color: var(--text);
      }

      .tagline {
        margin: 12px 0 0;
        color: var(--text-muted);
        font-size: 15px;
        letter-spacing: -0.01em;
        animation: rise 420ms ease-out 80ms both;
      }

      form {
        margin-top: 36px;
        animation: rise 420ms ease-out 140ms both;
      }

      .search {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 14px 16px;
        border: 1px solid var(--border);
        border-radius: 999px;
        background: var(--surface);
        box-shadow: 0 1px 2px rgba(31, 35, 40, 0.04), 0 10px 28px rgba(15, 118, 110, 0.06);
        transition:
          border-color 160ms ease,
          box-shadow 160ms ease;
      }

      .search:focus-within {
        border-color: #9ec9c4;
        box-shadow: 0 0 0 3px var(--accent-soft), 0 10px 28px rgba(15, 118, 110, 0.08);
      }

      .search svg {
        flex-shrink: 0;
        color: #8a949e;
      }

      .search input {
        flex: 1;
        min-width: 0;
        border: 0;
        outline: none;
        background: transparent;
        color: var(--text);
        font: inherit;
        font-size: 15px;
      }

      .search input::placeholder {
        color: #9aa3ad;
      }

      .hints {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
        margin-top: 28px;
        animation: rise 420ms ease-out 200ms both;
      }

      .hint {
        appearance: none;
        border: 1px solid var(--border);
        background: rgba(255, 255, 255, 0.72);
        color: var(--text-muted);
        border-radius: 999px;
        padding: 8px 14px;
        font: inherit;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition:
          background 140ms ease,
          color 140ms ease,
          border-color 140ms ease;
      }

      .hint:hover {
        background: var(--surface);
        color: var(--text);
        border-color: #c5ccd5;
      }
    </style>
  </head>
  <body>
    <main class="stage">
      <h1 class="brand">Lockin</h1>
      <p class="tagline">Search the web or type a URL to get started</p>
      <form id="search-form" autocomplete="off">
        <label class="search">
          <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
            <circle
              cx="7"
              cy="7"
              r="4.4"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <path
              d="M10.4 10.4 13.2 13.2"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
          <input
            id="query"
            type="search"
            name="q"
            placeholder="Search Google or enter address"
            spellcheck="false"
            enterkeyhint="go"
          />
        </label>
      </form>
      <div class="hints">
        <button type="button" class="hint" data-href="lockin://bookmarks">Bookmarks</button>
        <button type="button" class="hint" data-href="lockin://todos">Todos</button>
        <button type="button" class="hint" data-href="lockin://history">History</button>
        <button type="button" class="hint" data-href="lockin://screentime">Time Locked in</button>
        <button type="button" class="hint" data-href="lockin://settings">Settings</button>
      </div>
    </main>
    <script>
      const form = document.getElementById('search-form')
      const input = document.getElementById('query')
      const api = window.lockinNewTab

      form.addEventListener('submit', (event) => {
        event.preventDefault()
        const value = input.value.trim()
        if (!value || !api) return
        void api.go(value)
      })

      document.querySelectorAll('[data-href]').forEach((button) => {
        button.addEventListener('click', () => {
          const href = button.getAttribute('data-href')
          if (href) window.location.href = href
        })
      })
    </script>
  </body>
</html>
`
